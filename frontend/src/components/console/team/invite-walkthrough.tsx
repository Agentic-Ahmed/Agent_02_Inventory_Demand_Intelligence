"use client";

import * as React from "react";
import { X, ArrowLeft, ArrowRight, Check, Loader2, Mail, ShieldCheck, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Session, TenantThresholds } from "@/lib/api/types";
import { createInvite } from "@/lib/api/client";
import { INVITABLE_ROLES, ROLE_META, approvalSummary } from "@/lib/roles";

const STEPS = [
  { id: "intro", eyebrow: "Add to workspace" },
  { id: "details", eyebrow: "Who & what" },
  { id: "permissions", eyebrow: "Access" },
  { id: "review", eyebrow: "Confirm & send" },
] as const;
const REVIEW = STEPS.length - 1; // last input step
const SENT = STEPS.length; // confirmation view

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invite Teammate wizard — a get-started-style modal. Steps: intro → email + roles
 * (multi-select) → what they can approve → review → sent. On send it records the full
 * role set to the backend (source of truth, since a Clerk membership is single-role);
 * the backend also delivers a real Clerk email invitation when a workspace is connected
 * (POST /api/team/invites — see backend/api/routes/team.py) and reports back whether
 * that delivery succeeded.
 */
export function InviteWalkthrough({
  session,
  thresholds,
  onClose,
  onInvited,
}: {
  session: Session;
  thresholds?: TenantThresholds;
  onClose: () => void;
  onInvited?: () => void;
}) {
  const [step, setStep] = React.useState(0);
  const [email, setEmail] = React.useState("");
  const [roles, setRoles] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  const headingRef = React.useRef<HTMLHeadingElement>(null);
  // Step 1 focuses its email input via autoFocus (re-mounts each entry); other
  // steps move focus to the heading so the change is announced.
  React.useEffect(() => {
    if (step !== 1) headingRef.current?.focus();
  }, [step]);

  const emailOk = EMAIL_RE.test(email.trim());
  const detailsOk = emailOk && roles.length > 0;

  function toggleRole(key: string) {
    setRoles((prev) => (prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]));
  }

  async function send() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const result = await createInvite(session, { email: email.trim(), roles });
      if (result.email_error) {
        setNote(`Recorded, but the email couldn't be sent: ${result.email_error}`);
      } else if (!result.email_sent) {
        setNote("Recorded. The email invitation sends once your workspace is connected to Clerk.");
      }
      onInvited?.();
      setStep(SENT);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the invite.");
    } finally {
      setBusy(false);
    }
  }

  function primary() {
    if (step === SENT) return onClose();
    if (step === REVIEW) return void send();
    if (step === 1 && !detailsOk) return;
    setStep((s) => s + 1);
  }

  function resetForAnother() {
    setEmail("");
    setRoles([]);
    setError(null);
    setNote(null);
    setStep(1);
  }

  const eyebrow = step < STEPS.length ? STEPS[step].eyebrow : "Done";
  const title =
    step === 0
      ? "Invite a teammate"
      : step === 1
        ? "Their email and roles"
        : step === 2
          ? "What they'll be able to approve"
          : step === 3
            ? "Review and send"
            : "Invitation sent";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Invite teammate"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) onClose();
      }}
    >
      <button
        aria-label="Close invite dialog"
        tabIndex={-1}
        className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-sm"
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div className="glass relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/15 bg-white/85 shadow-xl dark:border-white/10 dark:bg-slate-900/85">
        {/* header */}
        <div className="flex items-center justify-between px-6 pt-5">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
            <UserPlus className="size-4 text-primary" /> Invite teammate
          </span>
          <div className="flex items-center gap-3">
            {step < SENT && (
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                Step {step + 1} of {STEPS.length}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Close"
              onClick={onClose}
              disabled={busy}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* progress */}
        {step < SENT && (
          <div
            className="mt-4 flex gap-1.5 px-6"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={step + 1}
          >
            {STEPS.map((s, i) => (
              <span key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-border">
                <span
                  className={cn(
                    "block h-full origin-left rounded-full bg-primary transition-transform duration-300",
                    i <= step ? "scale-x-100" : "scale-x-0",
                  )}
                />
              </span>
            ))}
          </div>
        )}

        {/* body */}
        <div className="px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="mt-1.5 text-xl font-semibold tracking-tight text-foreground outline-none"
          >
            {title}
          </h2>

          <div className="mt-5 min-h-[9rem]">
            {step === 0 && <IntroStep />}
            {step === 1 && (
              <DetailsStep
                email={email}
                setEmail={setEmail}
                roles={roles}
                toggleRole={toggleRole}
                emailInvalid={email.length > 0 && !emailOk}
              />
            )}
            {step === 2 && <PermissionsStep roles={roles} thresholds={thresholds} />}
            {step === 3 && <ReviewStep email={email.trim()} roles={roles} />}
            {step === SENT && <SentStep email={email.trim()} note={note} />}
          </div>

          {error && (
            <p role="alert" className="mt-3 text-sm text-critical">
              {error}
            </p>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-6 py-4">
          {step === SENT ? (
            <>
              <Button variant="ghost" onClick={resetForAnother}>
                Invite another
              </Button>
              <Button onClick={onClose}>
                <Check className="size-4" /> Done
              </Button>
            </>
          ) : (
            <>
              {step > 0 ? (
                <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={busy}>
                  <ArrowLeft className="size-4" /> Back
                </Button>
              ) : (
                <span />
              )}
              <Button onClick={primary} disabled={(step === 1 && !detailsOk) || busy}>
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Sending…
                  </>
                ) : step === REVIEW ? (
                  <>
                    <Mail className="size-4" /> Send invite
                  </>
                ) : (
                  <>
                    Continue <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function IntroStep() {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
      <p>
        Invite someone to your Quorum workspace. They&rsquo;ll get an email to join, and the roles you
        assign decide which agent decisions they&rsquo;re allowed to approve.
      </p>
      <p>
        A teammate can hold more than one role — their approval authority is the union of all of them.
      </p>
    </div>
  );
}

function DetailsStep({
  email,
  setEmail,
  roles,
  toggleRole,
  emailInvalid,
}: {
  email: string;
  setEmail: (v: string) => void;
  roles: string[];
  toggleRole: (key: string) => void;
  emailInvalid: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="invite-email" className="text-sm font-medium text-foreground">
          Email address
        </label>
        <Input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@company.com"
          autoComplete="email"
          autoFocus
          aria-invalid={emailInvalid || undefined}
        />
        {emailInvalid && <p className="text-xs text-critical">Enter a valid email address.</p>}
      </div>
      <div className="space-y-2">
        <span className="text-sm font-medium text-foreground">
          Roles <span className="font-normal text-muted-foreground">— pick one or more</span>
        </span>
        <div className="grid gap-2 sm:grid-cols-2">
          {INVITABLE_ROLES.map((r) => {
            const on = roles.includes(r.key);
            return (
              <button
                key={r.key}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggleRole(r.key)}
                className={cn(
                  "flex flex-col items-start rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "border-primary bg-primary/10" : "border-border hover:bg-muted/60",
                )}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{r.label}</span>
                  {on && <Check className="size-4 shrink-0 text-primary" />}
                </span>
                <span className="mt-0.5 text-xs text-muted-foreground">{r.blurb}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PermissionsStep({ roles, thresholds }: { roles: string[]; thresholds?: TenantThresholds }) {
  const lines = approvalSummary(roles, thresholds);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        With {roles.length > 1 ? "these roles" : "this role"}, they&rsquo;ll be able to:
      </p>
      <ul className="space-y-2">
        {lines.length ? (
          lines.map((l, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{l}</span>
            </li>
          ))
        ) : (
          <li className="text-sm text-muted-foreground">Go back and pick at least one role.</li>
        )}
      </ul>
      <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        Everything else still routes to a human — agents never auto-execute a money or price action past
        your guardrails.
      </div>
    </div>
  );
}

function ReviewStep({ email, roles }: { email: string; roles: string[] }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</p>
        <p className="mt-0.5 text-sm font-medium text-foreground">{email || "—"}</p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Roles</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {roles.map((r) => (
            <span
              key={r}
              className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
            >
              {ROLE_META[r]?.label ?? r}
            </span>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        We&rsquo;ll email them an invitation to join your workspace.
      </p>
    </div>
  );
}

function SentStep({ email, note }: { email: string; note: string | null }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ok/15">
          <Check className="size-5 text-ok" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">{email} has been invited.</p>
          <p className="text-xs text-muted-foreground">They&rsquo;ll show under pending invites until they accept.</p>
        </div>
      </div>
      {note && (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">{note}</p>
      )}
    </div>
  );
}

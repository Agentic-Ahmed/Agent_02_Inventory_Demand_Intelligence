"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useOrganization, useOrganizationList } from "@clerk/nextjs";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * First-sign-in workspace provisioning (Clerk on only). A signed-in user with no
 * active organization is asked to name one; we create it and set it active, which
 * becomes their isolated tenant (ClerkSessionBridge reads the org slug/id). Users
 * who already belong to an org fall straight through to the console.
 *
 * Requires Clerk Organizations to be enabled with member-created orgs allowed.
 */
export function WorkspaceGate({ children }: { children: React.ReactNode }) {
  const { isLoaded: orgLoaded, organization } = useOrganization();
  const { isLoaded: listLoaded, createOrganization, setActive } = useOrganizationList();

  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Wait for Clerk to report org state; avoids flashing the form for members.
  if (!orgLoaded) return null;
  if (organization) return <>{children}</>;

  const canSubmit = listLoaded && !!createOrganization && !!setActive && !!name.trim() && !busy;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const workspaceName = name.trim();
    if (!workspaceName || !createOrganization || !setActive) return;
    setBusy(true);
    setError(null);
    try {
      const org = await createOrganization({ name: workspaceName });
      await setActive({ organization: org.id });
      // useOrganization now reports the active org -> children render.
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create your workspace. Please try again.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
          <h1 className="font-heading text-xl font-semibold text-foreground">
            Name your workspace
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            This is your team&rsquo;s home in Quorum. Your inventory, forecasts, and approvals
            stay isolated to it — you can rename it later in Settings.
          </p>
          <form onSubmit={handleCreate} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="workspace-name" className="text-sm font-medium text-foreground">
                Workspace name
              </label>
              <Input
                id="workspace-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Retail"
                autoFocus
                autoComplete="organization"
                maxLength={80}
                disabled={busy}
                aria-invalid={error ? true : undefined}
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-critical">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={!canSubmit}>
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating your workspace…
                </>
              ) : (
                "Create workspace"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { Download, Loader2, AlertTriangle } from "lucide-react";

import { useSession } from "@/lib/api/session";
import { getApprovals, getAudit } from "@/lib/api/client";
import { getPrefs, setPrefs } from "@/lib/prefs";
import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsCard, SectionHeader, Field } from "./ui";

const RETENTION = [
  { value: "90d", label: "90 days" },
  { value: "1y", label: "1 year" },
  { value: "2y", label: "2 years" },
  { value: "forever", label: "Forever" },
];

const selectClass =
  "h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function DataControlsSection() {
  const { tenantId, role, getToken } = useSession();
  const session = React.useMemo(() => ({ tenantId, role, getToken }), [tenantId, role, getToken]);
  const canManage = role === "manager" || role === "admin";

  const [busy, setBusy] = React.useState<string | null>(null);
  const [retention, setRetention] = React.useState("1y");
  const [confirmText, setConfirmText] = React.useState("");
  const [dangerNote, setDangerNote] = React.useState<string | null>(null);

  React.useEffect(() => {
    setRetention(getPrefs(tenantId, "data", { retention: "1y" }).retention);
  }, [tenantId]);

  async function exportData(kind: "approvals" | "audit") {
    setBusy(kind);
    try {
      const data =
        kind === "approvals" ? await getApprovals(session, "all") : await getAudit(session, 1000);
      downloadJson(`quorum-${tenantId}-${kind}.json`, data);
    } finally {
      setBusy(null);
    }
  }

  const changeRetention = (value: string) => {
    setRetention(value);
    setPrefs(tenantId, "data", { retention: value });
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="Data controls" description="Export your workspace data, set retention, and manage deletion." />

      {/* Export */}
      <SettingsCard>
        <CardHeader className="border-b pb-4">
          <CardTitle>Export</CardTitle>
          <CardDescription>Download a JSON copy of your workspace records.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 py-5">
          <Button variant="outline" onClick={() => exportData("approvals")} disabled={busy !== null}>
            {busy === "approvals" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Export approvals
          </Button>
          <Button variant="outline" onClick={() => exportData("audit")} disabled={busy !== null}>
            {busy === "audit" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Export audit log
          </Button>
        </CardContent>
      </SettingsCard>

      {/* Retention */}
      <SettingsCard>
        <CardHeader className="border-b pb-4">
          <CardTitle>Retention</CardTitle>
          <CardDescription>How long the audit trail is kept before it&rsquo;s purged.</CardDescription>
        </CardHeader>
        <CardContent className="py-5">
          <Field label="Keep audit history for" htmlFor="retention">
            <select
              id="retention"
              className={selectClass}
              value={retention}
              onChange={(e) => changeRetention(e.target.value)}
              disabled={!canManage}
            >
              {RETENTION.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
        </CardContent>
      </SettingsCard>

      {/* Danger zone */}
      <SettingsCard className="border-critical/30">
        <CardHeader className="border-b border-critical/20 pb-4">
          <CardTitle className="flex items-center gap-2 text-critical">
            <AlertTriangle className="size-4" />
            Danger zone
          </CardTitle>
          <CardDescription>Deleting a workspace removes its data for everyone. This can&rsquo;t be undone.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 py-5">
          {canManage ? (
            <>
              <Field label={`Type "${tenantId}" to confirm`} htmlFor="confirm-delete">
                <Input
                  id="confirm-delete"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={tenantId}
                  className="max-w-xs"
                  autoComplete="off"
                />
              </Field>
              <Button
                variant="destructive"
                disabled={confirmText !== tenantId}
                onClick={() => setDangerNote("Workspace deletion isn't wired to the backend yet — this is where it would run.")}
              >
                Delete this workspace
              </Button>
              {dangerNote ? (
                <p role="status" className="text-sm text-muted-foreground">
                  {dangerNote}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Only an Inventory Manager or Admin can delete the workspace.</p>
          )}
        </CardContent>
      </SettingsCard>
    </div>
  );
}

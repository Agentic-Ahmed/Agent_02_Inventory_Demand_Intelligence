import { ShieldAlert } from "lucide-react";
import { Brand } from "@/components/brand";

/**
 * Fail-closed screen for a production build shipped without an auth provider.
 * Rendered instead of the console when `authMisconfigured` is true (see
 * lib/auth/clerk.ts) so a missing Clerk config can never silently expose tenant
 * data. Deliberately static — no Clerk context exists in this state.
 */
export function AuthNotConfigured() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center text-foreground">
      <Brand />
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <ShieldAlert className="size-7" aria-hidden="true" />
      </span>
      <div className="max-w-md space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">Sign-in isn&apos;t configured</h1>
        <p className="text-sm text-muted-foreground">
          This workspace is locked because the deployment has no authentication provider
          set up. Add the Clerk keys to this environment to enable sign-in, then reload.
        </p>
      </div>
      <p className="max-w-md text-xs text-muted-foreground">
        Set <code className="rounded bg-muted px-1.5 py-0.5">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>{" "}
        (and the backend&apos;s Clerk vars), or explicitly allow the open dev session with{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">NEXT_PUBLIC_ALLOW_INSECURE_DEV_AUTH=true</code>.
      </p>
    </main>
  );
}

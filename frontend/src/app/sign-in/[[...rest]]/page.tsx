import { redirect } from "next/navigation";
import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

import { clerkEnabled } from "@/lib/auth/clerk";

export const metadata = { title: "Log in" };

/** Clerk hosted log-in. Clerk itself shows "Couldn't find your account" when the
 *  entered email has no account; the prompt below makes the sign-up path obvious.
 *  When Clerk is off this route is unused — send to /app. */
export default function SignInPage() {
  if (!clerkEnabled) redirect("/app");
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background p-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Log in to Quorum
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No account yet?{" "}
          <Link href="/sign-up" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </p>
      </div>
      <SignIn signUpUrl="/sign-up" forceRedirectUrl="/app" />
    </div>
  );
}

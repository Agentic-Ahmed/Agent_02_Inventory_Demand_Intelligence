import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";

import { clerkEnabled } from "@/lib/auth/clerk";

export const metadata = { title: "Sign in" };

/** Clerk hosted sign-in. When Clerk is off this route is unused — send to /app. */
export default function SignInPage() {
  if (!clerkEnabled) redirect("/app");
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <SignIn signUpUrl="/sign-up" forceRedirectUrl="/app" />
    </div>
  );
}

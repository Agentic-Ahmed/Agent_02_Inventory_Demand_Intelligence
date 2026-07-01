import { redirect } from "next/navigation";
import { SignUp } from "@clerk/nextjs";

import { clerkEnabled } from "@/lib/auth/clerk";

export const metadata = { title: "Start free" };

/** Clerk hosted sign-up. When Clerk is off this route is unused — send to /app. */
export default function SignUpPage() {
  if (!clerkEnabled) redirect("/app");
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <SignUp signInUrl="/sign-in" forceRedirectUrl="/app" />
    </div>
  );
}

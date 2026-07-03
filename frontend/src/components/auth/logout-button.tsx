"use client";

import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Explicit "Log out" action for the console sidebar. Clerk's <UserButton /> also
 * offers sign-out, but a labelled button is clearer. Signs out then returns to the
 * landing page. Only mount this when Clerk is on (it uses the Clerk context).
 */
export function LogoutButton({ onDone }: { onDone?: () => void }) {
  const { signOut } = useClerk();
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
      onClick={() => {
        onDone?.();
        void signOut(() => router.push("/"));
      }}
    >
      <LogOut className="size-4 shrink-0" aria-hidden />
      Log out
    </Button>
  );
}

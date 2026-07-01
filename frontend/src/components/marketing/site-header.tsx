"use client";

import * as React from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Brand } from "@/components/brand";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { clerkEnabled } from "@/lib/auth/clerk";

const NAV = [
  { label: "How it works", href: "#how" },
  { label: "Agents", href: "#agents" },
  { label: "Control", href: "#control" },
];

// With Clerk on, the buttons go to real sign-in/up; in dev they enter the
// console (which gates first-timers into the onboarding tour).
const SIGN_IN_HREF = clerkEnabled ? "/sign-in" : "/app?intent=signin";
const START_HREF = clerkEnabled ? "/sign-up" : "/app?intent=start";

export function SiteHeader() {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0">
          <Brand />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <ButtonLink
              key={item.href}
              href={item.href}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              {item.label}
            </ButtonLink>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <ModeToggle />
          <ButtonLink
            href={SIGN_IN_HREF}
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
          >
            Sign in
          </ButtonLink>
          <ButtonLink
            href={START_HREF}
            size="sm"
            className="hidden sm:inline-flex"
          >
            Start free
          </ButtonLink>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Open menu"
                >
                  <Menu className="size-5" />
                </Button>
              }
            />
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="text-left">
                  <Brand />
                </SheetTitle>
              </SheetHeader>
              <div className="mt-2 flex flex-col gap-1 px-4">
                {NAV.map((item) => (
                  <ButtonLink
                    key={item.href}
                    href={item.href}
                    variant="ghost"
                    className="justify-start"
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </ButtonLink>
                ))}
                <div className="mt-4 flex flex-col gap-2">
                  <ButtonLink
                    href={SIGN_IN_HREF}
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Sign in
                  </ButtonLink>
                  <ButtonLink
                    href={START_HREF}
                    onClick={() => setOpen(false)}
                  >
                    Start free
                  </ButtonLink>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Brand } from "@/components/brand";
import { ButtonLink } from "@/components/ui/button-link";
import { Magnetic } from "@/components/v2/magnetic";
import { Reveal } from "@/components/reveal";

export function CtaV2() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <Reveal>
          {/* dark closing panel so the brand glow pops in both themes */}
          <div className="dark relative overflow-hidden rounded-[2rem] border border-border bg-background px-6 py-20 text-center text-foreground lg:px-12 lg:py-28">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_70%_at_50%_0%,color-mix(in_oklch,var(--color-primary),transparent_82%),transparent_70%)]"
            />
            <h2 className="relative mx-auto max-w-2xl text-balance text-4xl font-semibold tracking-tight text-foreground lg:text-6xl">
              Stop guessing what to order.
            </h2>
            <p className="relative mx-auto mt-5 max-w-md text-lg text-muted-foreground">
              Put your inventory on autopilot, with you holding the keys.
            </p>
            <div className="relative mt-9 flex justify-center">
              <Magnetic strength={0.5}>
                <ButtonLink href="/app" size="lg" className="group h-12 px-7 text-base">
                  Start free
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </ButtonLink>
              </Magnetic>
            </div>
          </div>
        </Reveal>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
          <Brand />
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="#how" className="hover:text-foreground">How it works</Link>
            <Link href="#agents" className="hover:text-foreground">Agents</Link>
            <Link href="/app" className="hover:text-foreground">Sign in</Link>
          </nav>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Quorum</p>
        </div>
      </div>
    </footer>
  );
}

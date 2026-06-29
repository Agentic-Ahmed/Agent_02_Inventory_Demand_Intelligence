import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Brand } from "@/components/brand";
import { ButtonLink } from "@/components/ui/button-link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/30">
      {/* closing CTA */}
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-14 text-center lg:px-12 lg:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,var(--color-primary)/10%,transparent_70%)]"
          />
          <h2 className="relative mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight text-foreground lg:text-4xl">
            Stop guessing what to order.
          </h2>
          <p className="relative mx-auto mt-4 max-w-md text-lg text-muted-foreground">
            Put your inventory on autopilot, with you holding the keys.
          </p>
          <div className="relative mt-8 flex justify-center">
            <ButtonLink href="/app" size="lg" className="group">
              Start free
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </ButtonLink>
          </div>
        </div>
      </div>

      {/* footer base */}
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
          <Brand />
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="#how" className="hover:text-foreground">
              How it works
            </Link>
            <Link href="#agents" className="hover:text-foreground">
              Agents
            </Link>
            <Link href="/app" className="hover:text-foreground">
              Sign in
            </Link>
          </nav>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Quorum
          </p>
        </div>
      </div>
    </footer>
  );
}

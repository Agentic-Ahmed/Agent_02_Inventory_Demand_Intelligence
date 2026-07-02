"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PageContainer, PageHeader } from "@/components/console/page-shell";
import { SETTINGS_NAV, isSettingsActive } from "@/components/console/settings/nav";
import { cn } from "@/lib/utils";

/** Settings shell: a persistent sub-nav (rail on desktop, scroll row on mobile)
 *  beside the active section. */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <PageContainer>
      <PageHeader title="Settings" description="Your workspace, guardrails, integrations, and billing." />

      <div className="grid gap-6 lg:grid-cols-[13rem_1fr]">
        <nav
          aria-label="Settings sections"
          className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
        >
          {SETTINGS_NAV.map((item) => {
            const active = isSettingsActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="min-w-0">{children}</div>
      </div>
    </PageContainer>
  );
}

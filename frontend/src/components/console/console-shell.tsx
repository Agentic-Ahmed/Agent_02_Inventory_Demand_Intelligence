"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { Brand } from "@/components/brand";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useSession } from "@/lib/api/session";
import { useQuery } from "@/lib/api/use-query";
import { getApprovals, IS_LIVE } from "@/lib/api/client";
import { clerkEnabled } from "@/lib/auth/clerk";
import { ClerkOrgControls } from "@/components/auth/clerk-org-controls";
import { cn } from "@/lib/utils";
import { NAV, isActive } from "./nav";
import { TenantSwitcher } from "./tenant-switcher";

function NavList({
  pendingCount,
  onNavigate,
}: {
  pendingCount?: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Console">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4.5 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.badge === "approvals" && pendingCount ? (
              <Badge variant={active ? "default" : "secondary"} className="tabular-nums">
                {pendingCount}
              </Badge>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter() {
  return (
    <div className="flex flex-col gap-2 border-t border-border/60 p-3">
      {clerkEnabled ? <ClerkOrgControls /> : <TenantSwitcher />}
      <div className="flex items-center justify-between px-1">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-medium",
            IS_LIVE ? "text-ok" : "text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              IS_LIVE ? "bg-ok" : "bg-muted-foreground/60",
            )}
          />
          {IS_LIVE ? "Live API" : "Demo data"}
        </span>
        <ModeToggle />
      </div>
    </div>
  );
}

/** The console chrome wrapping all /app/* screens: persistent sidebar on desktop,
 *  a slide-over on mobile. Content scrolls independently of the nav. */
export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const { tenantId, role, getToken, clerkActive } = useSession();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { data: pending } = useQuery(
    () => getApprovals({ tenantId, role, getToken }, "pending"),
    [tenantId, role, clerkActive],
  );
  const pendingCount = pending?.length;

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border/60 bg-card/30 md:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/app" aria-label="Quorum dashboard">
            <Brand />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <NavList pendingCount={pendingCount} />
        </div>
        <SidebarFooter />
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl md:hidden">
          <Link href="/app" aria-label="Quorum dashboard">
            <Brand />
          </Link>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Open navigation">
                  <Menu className="size-5" />
                </Button>
              }
            />
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="h-16 justify-center px-5">
                <SheetTitle className="text-left">
                  <Brand />
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-3 py-2">
                <NavList pendingCount={pendingCount} onNavigate={() => setMobileOpen(false)} />
              </div>
              <SidebarFooter />
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

import {
  LayoutDashboard,
  Inbox,
  MessageSquare,
  TrendingUp,
  ScrollText,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Show the live pending-approvals count as a badge. */
  badge?: "approvals";
}

/** The six console screens (CLAUDE.md S8), in sidebar order. */
export const NAV: NavItem[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/approvals", label: "Approvals", icon: Inbox, badge: "approvals" },
  { href: "/app/chat", label: "Ask Quorum", icon: MessageSquare },
  { href: "/app/forecasts", label: "Forecasts", icon: TrendingUp },
  { href: "/app/audit", label: "Audit log", icon: ScrollText },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/app" ? pathname === "/app" : pathname.startsWith(href);
}

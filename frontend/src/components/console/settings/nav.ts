import {
  SlidersHorizontal,
  ShieldCheck,
  Users,
  Bell,
  Plug,
  CreditCard,
  Database,
  type LucideIcon,
} from "lucide-react";

export interface SettingsNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

export const SETTINGS_NAV: SettingsNavItem[] = [
  { href: "/app/settings", label: "General", icon: SlidersHorizontal, exact: true },
  { href: "/app/settings/guardrails", label: "Guardrails", icon: ShieldCheck },
  { href: "/app/settings/team", label: "Team & roles", icon: Users },
  { href: "/app/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/app/settings/integrations", label: "Integrations", icon: Plug },
  { href: "/app/settings/billing", label: "Billing & usage", icon: CreditCard },
  { href: "/app/settings/data", label: "Data controls", icon: Database },
];

export function isSettingsActive(pathname: string, item: SettingsNavItem): boolean {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

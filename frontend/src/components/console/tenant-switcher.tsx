"use client";

import * as React from "react";
import { Building2, Check, ChevronsUpDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/lib/api/session";
import { ROLE_LABEL, ROLES } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const TENANTS = [
  { id: "acme", name: "Acme Retail" },
  { id: "cornershop", name: "Corner Shop" },
];

/**
 * Switches the active tenant + role (the dev X-Tenant-Id / X-User-Role identity).
 * Multi-tenancy is non-negotiable (CLAUDE.md S9): every screen rescopes its data
 * when this changes, and approval authority follows the selected role.
 */
export function TenantSwitcher() {
  const { tenantId, role, setTenant, setRole } = useSession();
  const tenantName = TENANTS.find((t) => t.id === tenantId)?.name ?? tenantId;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card/50 px-2.5 py-2 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Building2 className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-foreground">{tenantName}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {ROLE_LABEL[role] ?? role}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-60" sideOffset={6}>
        <DropdownMenuLabel>Business</DropdownMenuLabel>
        {TENANTS.map((t) => (
          <DropdownMenuItem key={t.id} onClick={() => setTenant(t.id)}>
            <Building2 className="text-muted-foreground" />
            <span className="flex-1">{t.name}</span>
            {t.id === tenantId && <Check className="text-primary" />}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Sign in as (role)</DropdownMenuLabel>
        {ROLES.map((r) => (
          <DropdownMenuItem key={r} onClick={() => setRole(r)}>
            <span className={cn("flex-1", r === role && "font-medium text-foreground")}>
              {ROLE_LABEL[r]}
            </span>
            {r === role && <Check className="text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

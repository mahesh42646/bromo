"use client";

import { useState } from "react";
import { Check, Lock, Shield, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Permission =
  | "users.view" | "users.edit" | "users.delete"
  | "content.view" | "content.edit" | "content.publish"
  | "analytics.view"
  | "settings.view" | "settings.edit"
  | "billing.view" | "billing.edit"
  | "admins.manage";

type Role = "super_admin" | "admin" | "viewer";

const PERMISSION_GROUPS: { group: string; perms: { id: Permission; label: string }[] }[] = [
  {
    group: "Users",
    perms: [
      { id: "users.view", label: "View users" },
      { id: "users.edit", label: "Edit users" },
      { id: "users.delete", label: "Delete users" },
    ],
  },
  {
    group: "Content",
    perms: [
      { id: "content.view", label: "View content" },
      { id: "content.edit", label: "Edit content" },
      { id: "content.publish", label: "Publish content" },
    ],
  },
  {
    group: "Analytics",
    perms: [{ id: "analytics.view", label: "View analytics" }],
  },
  {
    group: "Settings",
    perms: [
      { id: "settings.view", label: "View settings" },
      { id: "settings.edit", label: "Edit settings" },
    ],
  },
  {
    group: "Billing",
    perms: [
      { id: "billing.view", label: "View billing" },
      { id: "billing.edit", label: "Manage billing" },
    ],
  },
  {
    group: "Administration",
    perms: [{ id: "admins.manage", label: "Manage admins" }],
  },
];

const DEFAULT_MATRIX: Record<Role, Set<Permission>> = {
  super_admin: new Set<Permission>([
    "users.view", "users.edit", "users.delete",
    "content.view", "content.edit", "content.publish",
    "analytics.view", "settings.view", "settings.edit",
    "billing.view", "billing.edit", "admins.manage",
  ]),
  admin: new Set<Permission>([
    "users.view", "users.edit",
    "content.view", "content.edit", "content.publish",
    "analytics.view", "settings.view",
    "billing.view",
  ]),
  viewer: new Set<Permission>(["users.view", "content.view", "analytics.view", "settings.view"]),
};

const ROLE_META: Record<Role, { label: string; desc: string; color: string }> = {
  super_admin: { label: "Super Admin", desc: "Full platform access, including admin management.", color: "text-accent bg-accent/15" },
  admin: { label: "Admin", desc: "Operational access without admin management.", color: "text-foreground bg-muted" },
  viewer: { label: "Viewer", desc: "Read-only access to platform data.", color: "text-muted-foreground bg-muted/50" },
};

export function AdminRoles() {
  const [matrix, setMatrix] = useState(DEFAULT_MATRIX);
  const [activeRole, setActiveRole] = useState<Role>("admin");

  function toggle(role: Role, perm: Permission) {
    if (role === "super_admin") return;
    setMatrix((prev) => {
      const copy = new Set(prev[role]);
      if (copy.has(perm)) copy.delete(perm);
      else copy.add(perm);
      return { ...prev, [role]: copy };
    });
  }

  const roles: Role[] = ["super_admin", "admin", "viewer"];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Roles & permissions</h1>
        <p className="text-muted-foreground mt-1 text-sm">RBAC matrix — configure what each role can access.</p>
      </div>

      {/* Role cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {roles.map((role) => {
          const meta = ROLE_META[role];
          const permCount = matrix[role].size;
          const totalPerms = PERMISSION_GROUPS.flatMap((g) => g.perms).length;
          return (
            <button
              key={role}
              onClick={() => setActiveRole(role)}
              className={cn(
                "border-border brand-surface rounded-2xl border p-4 text-left shadow-sm transition-all",
                activeRole === role ? "ring-2 ring-ring" : "hover:bg-muted/40",
                "bg-muted/30",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={cn("rounded-xl px-2.5 py-1 text-xs font-semibold", meta.color)}>
                  {meta.label}
                </span>
                {role === "super_admin" && <Lock className="text-muted-foreground size-4" />}
              </div>
              <p className="text-muted-foreground mt-3 text-xs">{meta.desc}</p>
              <p className="text-foreground mt-3 text-sm font-medium">
                {permCount} / {totalPerms} permissions
              </p>
            </button>
          );
        })}
      </div>

      {/* Permission matrix */}
      <div className="border-border bg-background brand-surface rounded-2xl border shadow-sm">
        <div className="border-border border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <Shield className="text-accent size-4" />
            <span className="text-foreground font-semibold">
              {ROLE_META[activeRole].label} — permission matrix
            </span>
            {activeRole === "super_admin" && (
              <span className="text-muted-foreground text-xs">Locked — super admin always has all permissions</span>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="text-muted-foreground px-6 py-3 text-left text-xs font-medium uppercase tracking-wide">Permission</th>
                {roles.map((r) => (
                  <th key={r} className="text-muted-foreground px-4 py-3 text-center text-xs font-medium uppercase tracking-wide">
                    {ROLE_META[r].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map((group) => (
                <>
                  <tr key={`group-${group.group}`} className="bg-muted/20">
                    <td colSpan={4} className="text-muted-foreground px-6 py-2 text-xs font-semibold uppercase tracking-wider">
                      {group.group}
                    </td>
                  </tr>
                  {group.perms.map((perm) => (
                    <tr key={perm.id} className="border-border border-b hover:bg-muted/20 transition-colors">
                      <td className="text-foreground px-6 py-3">{perm.label}</td>
                      {roles.map((role) => {
                        const has = matrix[role].has(perm.id);
                        const locked = role === "super_admin";
                        return (
                          <td key={role} className="px-4 py-3 text-center">
                            <button
                              onClick={() => toggle(role, perm.id)}
                              disabled={locked}
                              className={cn(
                                "mx-auto flex size-6 items-center justify-center rounded-lg transition-colors",
                                has
                                  ? "bg-success/15 text-success"
                                  : "bg-muted text-muted-foreground",
                                !locked && "hover:scale-110",
                                locked && "cursor-not-allowed opacity-60",
                              )}
                            >
                              {has ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-border border-t px-6 py-4">
          <button className="bg-accent text-accent-foreground rounded-xl px-5 py-2 text-sm font-medium transition-opacity hover:opacity-90">
            Save permissions
          </button>
        </div>
      </div>
    </div>
  );
}

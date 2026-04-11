"use client";

import { useState } from "react";
import { Mail, MoreHorizontal, Plus, Shield, UserCog, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "admin";
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const MOCK_ADMINS: AdminUser[] = [
  { id: "1", name: "Super Admin", email: "admin@gmail.com", role: "super_admin", isActive: true, lastLoginAt: new Date().toISOString(), createdAt: "2024-01-01T00:00:00Z" },
  { id: "2", name: "Content Manager", email: "content@bromo.app", role: "admin", isActive: true, lastLoginAt: new Date(Date.now() - 86400000).toISOString(), createdAt: "2024-03-15T00:00:00Z" },
  { id: "3", name: "Support Lead", email: "support@bromo.app", role: "admin", isActive: false, lastLoginAt: null, createdAt: "2024-06-01T00:00:00Z" },
];

function RoleBadge({ role }: { role: AdminUser["role"] }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
      role === "super_admin" ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground",
    )}>
      <Shield className="size-3" />
      {role === "super_admin" ? "Super admin" : "Admin"}
    </span>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "super_admin">("admin");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-overlay fixed inset-0" onClick={onClose} />
      <div className="border-border bg-background brand-surface relative w-full max-w-sm rounded-2xl border p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-foreground font-semibold">Invite admin</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground rounded-lg p-1">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase tracking-wide">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@company.com"
              className="border-input bg-background text-foreground placeholder:text-placeholder w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase tracking-wide">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "super_admin")}
              className="border-input bg-background text-foreground w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <button
            className="bg-accent text-accent-foreground w-full rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
          >
            Send invite
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminAdmins() {
  const [admins, setAdmins] = useState(MOCK_ADMINS);
  const [showInvite, setShowInvite] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  function toggleStatus(id: string) {
    setAdmins((prev) => prev.map((a) => a.id === id ? { ...a, isActive: !a.isActive } : a));
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">Admin users</h1>
          <p className="text-muted-foreground mt-1 text-sm">Internal operator accounts and their access levels.</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="bg-accent text-accent-foreground flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" />
          Invite admin
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total admins", value: admins.length },
          { label: "Active", value: admins.filter((a) => a.isActive).length },
          { label: "Super admins", value: admins.filter((a) => a.role === "super_admin").length },
        ].map(({ label, value }) => (
          <div key={label} className="border-border bg-muted/30 brand-surface rounded-2xl border p-4 shadow-sm">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
            <p className="text-foreground mt-2 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="border-border bg-background brand-surface rounded-2xl border shadow-sm">
        <div className="border-border border-b px-4 py-3">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">All administrators</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border border-b">
                {["Administrator", "Email", "Role", "Status", "Last login", "Actions"].map((h) => (
                  <th key={h} className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-accent/15 text-accent flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                        {admin.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <span className="text-foreground font-medium">{admin.name}</span>
                    </div>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">{admin.email}</td>
                  <td className="px-4 py-3"><RoleBadge role={admin.role} /></td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                      admin.isActive ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                    )}>
                      {admin.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-xs">
                    {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString() : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenu(openMenu === admin.id ? null : admin.id)}
                        className="text-muted-foreground hover:text-foreground rounded-lg p-1.5 transition-colors"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                      {openMenu === admin.id && (
                        <div className="border-border bg-background absolute right-0 z-10 mt-1 w-40 rounded-xl border shadow-lg">
                          <button
                            onClick={() => { toggleStatus(admin.id); setOpenMenu(null); }}
                            className="text-foreground hover:bg-muted/60 flex w-full items-center gap-2 px-3 py-2 text-sm"
                          >
                            <UserCog className="size-4" />
                            {admin.isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            className="text-foreground hover:bg-muted/60 flex w-full items-center gap-2 px-3 py-2 text-sm"
                            onClick={() => setOpenMenu(null)}
                          >
                            <Mail className="size-4" />
                            Send reset link
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}

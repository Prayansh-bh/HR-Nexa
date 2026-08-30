import React, { useState, useMemo, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { usersService, UserAccount } from "../../../services/users.service";
import { employeeSyncService } from "../../../services/employee-sync.service";
import { useUIStore } from "../../../store/uiStore";

const cardCls =
  "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-elevated)]";
const inputCls =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
const btnCls =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition hover:brightness-110 px-3 py-1.5 text-xs bg-primary text-white";

function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="flex gap-2">{action}</div>}
    </div>
  );
}

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "amber" | "rose" | "indigo" | "sky";
}) {
  const tones = {
    slate: "bg-muted text-muted-foreground",
    green: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
    amber: "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
    rose: "bg-destructive/15 text-destructive",
    indigo: "bg-primary/15 text-primary",
    sky: "bg-[color:var(--color-info)]/15 text-[color:var(--color-info)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function extractUsersArray(res: any): UserAccount[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.items)) return res.items;
  if (Array.isArray(res.users)) return res.users;
  return [];
}

function normalize(val?: string | null): string {
  if (!val) return "";
  return String(val).trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
}

export function UserManagementPage({ toast }: { toast?: any }) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [manageUser, setManageUser] = useState<UserAccount | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserAccount | null>(null);
  const [filterCompany, setFilterCompany] = useState("All");
  const [filterRole, setFilterRole] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await usersService.deleteUser(userToDelete.id);
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      if (toast) toast(`User "${userToDelete.name}" deleted successfully`, "success");
      setUserToDelete(null);
    } catch (err: any) {
      if (toast) toast(err?.message || "Failed to delete user", "error");
    }
  };

  useEffect(() => {
    loadUsers();
    const unsubscribe = employeeSyncService.subscribe(() => {
      loadUsers();
    });
    return unsubscribe;
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await usersService.getAllUsers();
      setUsers(extractUsersArray(data));
    } catch (err) {
      toast?.("Failed to load users", "error");
    } finally {
      setLoading(false);
    }
  };

  const companyOptions = useMemo(() => {
    if (!Array.isArray(users)) return ["All Companies"];
    const set = new Set<string>();
    users.forEach((u) => {
      if (u && u.company && typeof u.company === "string" && u.company.trim()) {
        set.add(u.company.trim());
      }
    });
    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
    return ["All Companies", ...sorted];
  }, [users]);

  const filtered = useMemo(() => {
    if (!Array.isArray(users)) return [];
    return users.filter((u) => {
      if (!u) return false;
      const compNorm = normalize(u.company);
      const roleNorm = normalize(u.role);
      const statusNorm = normalize(u.status);

      if (
        filterCompany !== "All Companies" &&
        filterCompany !== "All" &&
        compNorm !== normalize(filterCompany)
      ) {
        return false;
      }
      if (filterRole !== "All" && roleNorm !== normalize(filterRole)) {
        return false;
      }
      if (filterStatus !== "All" && statusNorm !== normalize(filterStatus)) {
        return false;
      }
      return true;
    });
  }, [users, filterCompany, filterRole, filterStatus]);

  const handleForceLogout = (id: string, name: string) => {
    useUIStore.getState().setConfirmState({
      open: true,
      title: "Force-Logout & Lock Account",
      message: `Are you sure you want to force-logout "${name}"? This will lock their account and revoke all active sessions immediately.`,
      confirmText: "Force Logout",
      cancelText: "Cancel",
      confirmVariant: "danger",
      onConfirm: async () => {
        try {
          await usersService.forceLogout(id);
          const refreshed = await usersService.getAllUsers();
          setUsers(extractUsersArray(refreshed));
          if (toast) toast(`"${name}" has been force-logged out and account locked`, "success");
        } catch (err: any) {
          toast?.(err?.message || "Failed to force logout user", "error");
        }
      },
    });
  };

  const handleSaveManage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manageUser) return;

    try {
      await usersService.updateUser(manageUser.id, manageUser.role, manageUser.status);
      const refreshed = await usersService.getAllUsers();
      setUsers(extractUsersArray(refreshed));
      toast?.(`User ${manageUser.name} updated successfully`, "success");
      setManageUser(null);
    } catch (err: any) {
      toast?.(err?.message || "Failed to update user", "error");
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Global User Management"
          subtitle="Manage user accounts across all tenant companies"
        />
        <div className="flex h-60 items-center justify-center">
          <div className="text-muted-foreground">Loading users...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Global User Management"
        subtitle="Manage user accounts across all tenant companies"
      />

      <div className={cardCls + " p-0 overflow-hidden"}>
        <div className="p-4 border-b border-border flex flex-wrap items-center gap-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-semibold text-muted-foreground">Company:</span>
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs sm:text-sm outline-none"
            >
              {companyOptions.map((c) => (
                <option key={c} value={c === "All Companies" ? "All" : c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-semibold text-muted-foreground">Role:</span>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs sm:text-sm outline-none"
            >
              <option value="All">All Roles</option>
              <option value="Super Admin">Super Admin</option>
              <option value="HR Admin">HR Admin</option>
              <option value="Manager">Manager</option>
              <option value="Employee">Employee</option>
              <option value="Accountant">Accountant</option>
              <option value="Recruiter">Recruiter</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-semibold text-muted-foreground">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs sm:text-sm outline-none"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Locked">Locked</option>
              <option value="Disabled">Disabled</option>
              <option value="Logged Out">Logged Out</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm border-collapse">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-4 font-semibold">User</th>
                <th className="p-4 font-semibold">Company</th>
                <th className="p-4 font-semibold">Role</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Last Login</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No user accounts found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30 transition">
                    <td className="p-4">
                      <div className="font-semibold">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="p-4 font-medium">{u.company}</td>
                    <td className="p-4">{u.role}</td>
                    <td className="p-4">
                      <Badge
                        tone={
                          u.status === "Active"
                            ? "green"
                            : u.status === "Locked"
                              ? "amber"
                              : u.status === "Logged Out"
                                ? "rose"
                                : "slate"
                        }
                      >
                        {u.status}
                      </Badge>
                    </td>
                    <td className="p-4">{u.lastLogin}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-3 items-center whitespace-nowrap">
                        <button
                          onClick={() => setManageUser({ ...u })}
                          className="text-primary hover:underline text-xs font-semibold"
                        >
                          Manage
                        </button>
                        <button
                          onClick={() => handleForceLogout(u.id, u.name)}
                          className="text-amber-500 hover:underline text-xs font-semibold"
                        >
                          Force Logout
                        </button>
                        <button
                          onClick={() => setUserToDelete(u)}
                          className="text-destructive hover:underline text-xs font-semibold"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {manageUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card p-6 shadow-2xl overflow-y-auto animate-in zoom-in-95">
            <h3 className="text-xl font-bold mb-4">Manage User Account</h3>
            <form onSubmit={handleSaveManage} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-muted-foreground block mb-1">
                  User Name
                </label>
                <input value={manageUser.name} disabled className={inputCls + " opacity-60"} />
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground block mb-1">
                  Email
                </label>
                <input value={manageUser.email} disabled className={inputCls + " opacity-60"} />
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground block mb-1">
                  Role
                </label>
                <select
                  value={manageUser.role}
                  onChange={(e) => setManageUser({ ...manageUser, role: e.target.value })}
                  className={inputCls}
                >
                  <option value="Super Admin">Super Admin</option>
                  <option value="HR Admin">HR Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="Employee">Employee</option>
                  <option value="Accountant">Accountant</option>
                  <option value="Recruiter">Recruiter</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground block mb-1">
                  Status
                </label>
                <select
                  value={manageUser.status}
                  onChange={(e) => setManageUser({ ...manageUser, status: e.target.value })}
                  className={inputCls}
                >
                  <option value="Active">Active</option>
                  <option value="Locked">Locked</option>
                  <option value="Disabled">Disabled</option>
                  <option value="Logged Out">Logged Out</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setManageUser(null)}
                  className={btnCls + " !bg-secondary !text-secondary-foreground"}
                >
                  Cancel
                </button>
                <button type="submit" className={btnCls}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl border border-destructive/30 bg-card p-6 shadow-2xl overflow-y-auto animate-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-destructive/10">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Delete User Account</h3>
                <p className="text-xs text-muted-foreground">Permanent user removal</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to delete user account <strong>{userToDelete.name}</strong> (
              {userToDelete.email})?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className={btnCls + " !bg-secondary !text-secondary-foreground"}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                className={btnCls + " !bg-destructive !text-destructive-foreground"}
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

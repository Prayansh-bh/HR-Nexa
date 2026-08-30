import React from "react";
import { Clock, MessageSquare } from "lucide-react";
import { SaaSCompany } from "../../types/superAdmin.types";

function Btn({
  children,
  onClick,
  variant = "primary",
  size = "md",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "outline";
  size?: "sm" | "md";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition duration-200 hover:-translate-y-0.5";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
  const variants = {
    primary: "btn-gradient hover:brightness-110 text-white",
    ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
    outline: "border border-border bg-card hover:border-primary hover:text-primary text-foreground",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "bg-muted text-muted-foreground",
    green: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
    amber: "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
    rose: "bg-destructive/15 text-destructive",
    indigo: "bg-primary/15 text-primary",
    sky: "bg-[color:var(--color-info)]/15 text-[color:var(--color-info)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone] || tones.slate}`}
    >
      {children}
    </span>
  );
}

interface RenewalsAndAnnouncementsProps {
  companies: SaaSCompany[];
  announcements: any[];
  onRenewalAction: (companyId: string) => void;
}

export const RenewalsAndAnnouncements: React.FC<RenewalsAndAnnouncementsProps> = ({
  companies,
  announcements,
  onRenewalAction,
}) => {
  const upcomingRenewals = companies
    .filter((c) => c.status === "Active" || c.status === "Trial")
    .slice(0, 4);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Upcoming Renewals Table */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm flex items-center gap-2 text-foreground">
            <Clock className="w-4 h-4 text-amber-500" /> Upcoming Renewals & Expiries
          </h3>
          <span className="text-xs text-muted-foreground font-semibold">Next 30 Days</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-xs border-collapse">
            <thead className="bg-muted/40 font-bold text-muted-foreground border-b border-border">
              <tr>
                <th className="p-2.5">Company</th>
                <th className="p-2.5">Plan</th>
                <th className="p-2.5">Expiry Date</th>
                <th className="p-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {upcomingRenewals.map((c) => (
                <tr key={c.id} className="hover:bg-muted/20 transition">
                  <td className="p-2.5 font-bold">{c.name}</td>
                  <td className="p-2.5">
                    <Badge tone="indigo">{c.plan}</Badge>
                  </td>
                  <td className="p-2.5 font-mono text-muted-foreground">
                    {c.expiryDate || "2026-08-30"}
                  </td>
                  <td className="p-2.5 text-right">
                    <Btn
                      onClick={() => onRenewalAction(c.id)}
                      variant="outline"
                      size="sm"
                      className="shrink-0 h-7 text-[10px]"
                    >
                      Renew
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Announcements */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm flex items-center gap-2 text-foreground">
            <MessageSquare className="w-4 h-4 text-primary" /> Active Platform Broadcasts
          </h3>
          <Badge tone="sky">{announcements.length} Active</Badge>
        </div>
        <div className="space-y-3">
          {announcements.slice(0, 3).map((a, idx) => (
            <div key={a.id || idx} className="p-3 rounded-xl border border-border bg-muted/20 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-foreground">{a.title || a.t || "Announcement"}</span>
                <Badge
                  tone={a.type === "Security" ? "rose" : a.type === "Release" ? "green" : "amber"}
                >
                  {a.type || "Notice"}
                </Badge>
              </div>
              {(a.scheduledFor || a.duration) && (
                <div className="flex items-center gap-2 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                  <Clock className="w-3 h-3" />
                  {a.scheduledFor && <span>Start: {new Date(a.scheduledFor).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                  {a.duration && <span>({a.duration})</span>}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground line-clamp-2">{a.content || a.d || ""}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

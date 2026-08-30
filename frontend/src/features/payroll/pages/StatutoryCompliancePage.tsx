import React from "react";
import { CalendarCheck, ShieldCheck, FileText, Info } from "lucide-react";

const cardCls =
  "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-elevated)]";

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

export function StatutoryCompliancePage() {
  const complianceSchedules = [
    {
      id: "C1",
      name: "EPF Monthly Electronic Challan-cum-Return (ECR)",
      act: "Employees' Provident Funds and Miscellaneous Provisions Act, 1952",
      cycle: "Monthly",
      dueDay: "15th of following month",
      status: "Active Rule (12% capped @ ₹1,800)",
      tone: "green",
    },
    {
      id: "C2",
      name: "ESIC Contribution & Return",
      act: "Employees' State Insurance Act, 1948",
      cycle: "Monthly",
      dueDay: "15th of following month",
      status: "Active Rule (0.75% for Gross ≤ ₹21,000)",
      tone: "green",
    },
    {
      id: "C3",
      name: "Professional Tax (PT) Monthly Remittance",
      act: "State-specific Tax on Professions, Trades, Callings Act",
      cycle: "Monthly",
      dueDay: "Last day of month",
      status: "State Slabs Enforced",
      tone: "green",
    },
    {
      id: "C4",
      name: "TDS Quarterly Return (Form 24Q)",
      act: "Income Tax Act, 1961 (Section 192)",
      cycle: "Quarterly",
      dueDay: "31st of month following quarter end",
      status: "Tax Deductions Deducted",
      tone: "indigo",
    },
    {
      id: "C5",
      name: "Annual Salary TDS Certificate (Form 16 Part A & B)",
      act: "Income Tax Act, 1961",
      cycle: "Annual",
      dueDay: "June 15th of following fiscal year",
      status: "Generated post Fiscal Year Close",
      tone: "slate",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Statutory Compliance Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Official statutory remittance timelines, filing cycles, and regulatory deduction rules.
          </p>
        </div>
        <Badge tone="green">Statutory Rules Active</Badge>
      </div>

      <div className={cardCls + " !p-0 overflow-hidden"}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <th className="px-6 py-4">Statutory Head & Filing Register</th>
              <th className="px-6 py-4">Governing Legislation</th>
              <th className="px-6 py-4">Filing Frequency</th>
              <th className="px-6 py-4">Regulatory Due Date</th>
              <th className="px-6 py-4 text-right">Engine Status</th>
            </tr>
          </thead>
          <tbody>
            {complianceSchedules.map((s) => (
              <tr
                key={s.id}
                className="border-b border-border/60 hover:bg-muted/40 text-xs"
              >
                <td className="px-6 py-4 font-bold text-sm text-foreground">
                  <div className="flex items-center gap-2">
                    <CalendarCheck size={16} className="text-primary shrink-0" />
                    {s.name}
                  </div>
                </td>
                <td className="px-6 py-4 text-muted-foreground">{s.act}</td>
                <td className="px-6 py-4 font-semibold">{s.cycle}</td>
                <td className="px-6 py-4 text-foreground font-mono">{s.dueDay}</td>
                <td className="px-6 py-4 text-right">
                  <Badge tone={s.tone}>{s.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] space-y-2">
        <div className="flex items-center gap-2 font-bold text-sm text-foreground">
          <Info size={16} className="text-primary" /> Statutory Calculation Notice
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Statutory deductions (EPF, Professional Tax, TDS) are calculated in real-time during each monthly payroll batch run. 
          To generate itemized deduction reconciliations and payroll registers, navigate to <strong>Payroll Reports</strong> and export the monthly summary.
        </p>
      </div>
    </div>
  );
}

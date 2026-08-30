import React, { useState } from "react";
import { Field, Btn, cardCls } from "../../../components/ui/DashboardPrimitives";

export function ManagerShiftRosterPage({ toast }: { toast: (m: string) => void }) {
  const [roster, setRoster] = useState([
    { id: "S1", name: "Aarav Sharma", shift: "General Shift (09:00 - 18:00)" },
    { id: "S2", name: "Devon Chen", shift: "Night Shift (22:00 - 06:00)" },
  ]);

  const update = (id: string, nextShift: string) => {
    setRoster(roster.map((r) => (r.id === id ? { ...r, shift: nextShift } : r)));
    toast("Staff shift assignments adjusted successfully");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Shift & Roster Management</h1>
        <p className="text-sm text-muted-foreground">
          Assign and adjust active work shifts for direct reports.
        </p>
      </div>

      <div className={cardCls + " !p-0 overflow-hidden"}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <th className="px-6 py-4">Team Member</th>
              <th className="px-6 py-4">Assigned Shift</th>
              <th className="px-6 py-4 text-right">Adjust Shift</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((r) => (
              <tr key={r.id} className="border-b border-border/60 hover:bg-muted/40">
                <td className="px-6 py-4 font-semibold">{r.name}</td>
                <td className="px-6 py-4 text-muted-foreground">{r.shift}</td>
                <td className="px-6 py-4 text-right">
                  <select
                    value={r.shift}
                    onChange={(e) => update(r.id, e.target.value)}
                    className="h-8 rounded-lg border border-input bg-background px-2 text-xs outline-none focus:border-primary"
                  >
                    <option>General Shift (09:00 - 18:00)</option>
                    <option>Morning Shift (06:00 - 15:00)</option>
                    <option>Evening Shift (14:00 - 23:00)</option>
                    <option>Night Shift (22:00 - 06:00)</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export default ManagerShiftRosterPage;

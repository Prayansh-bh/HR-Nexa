import React from "react";
import { XCircle } from "lucide-react";

function Btn({
  children,
  onClick,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition duration-200 px-4 py-2 text-sm";
  const variants = {
    primary: "btn-gradient hover:brightness-110 text-white",
    outline: "border border-border bg-card hover:border-primary hover:text-primary text-foreground",
  };
  return (
    <button type="button" onClick={onClick} className={`${base} ${variants[variant]}`}>
      {children}
    </button>
  );
}

function LocalModalShell({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 sm:px-6 py-4 shrink-0">
          <div className="text-base sm:text-lg font-bold">{title}</div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted transition"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

interface ViewAuditLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditLogs: any[];
}

export const ViewAuditLogsModal: React.FC<ViewAuditLogsModalProps> = ({
  isOpen,
  onClose,
  auditLogs,
}) => {
  if (!isOpen) return null;

  return (
    <LocalModalShell title="System Audit Logs" onClose={onClose} wide>
      <div className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px] text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 font-bold text-muted-foreground">
                <th className="p-3">Timestamp</th>
                <th className="p-3">Action</th>
                <th className="p-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(auditLogs) ? auditLogs : []).map((log) => (
                <tr key={log.id} className="border-b border-border hover:bg-muted/10">
                  <td className="p-3 text-muted-foreground">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="p-3 font-semibold text-primary">{log.action}</td>
                  <td className="p-3 text-foreground">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end pt-4">
          <Btn onClick={onClose} variant="outline">
            Close Logs
          </Btn>
        </div>
      </div>
    </LocalModalShell>
  );
};

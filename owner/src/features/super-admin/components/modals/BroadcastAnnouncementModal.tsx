import React from "react";
import { XCircle } from "lucide-react";

const inputCls =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function Btn({
  children,
  onClick,
  variant = "primary",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline";
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition duration-200 px-4 py-2 text-sm";
  const variants = {
    primary: "btn-gradient hover:brightness-110 text-white",
    outline: "border border-border bg-card hover:border-primary hover:text-primary text-foreground",
  };
  return (
    <button type={type} onClick={onClick} className={`${base} ${variants[variant]}`}>
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}

function LocalModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
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

interface BroadcastAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  newAnnouncement: {
    type: string;
    title: string;
    content: string;
    scheduledFor?: string;
    duration?: string;
  };
  setNewAnnouncement: React.Dispatch<
    React.SetStateAction<{
      type: string;
      title: string;
      content: string;
      scheduledFor?: string;
      duration?: string;
    }>
  >;
  onSubmit: (e: React.FormEvent) => void;
}

export const BroadcastAnnouncementModal: React.FC<BroadcastAnnouncementModalProps> = ({
  isOpen,
  onClose,
  newAnnouncement,
  setNewAnnouncement,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <LocalModalShell title="Broadcast Tenant Announcement" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Announcement Category">
          <select
            value={newAnnouncement.type}
            onChange={(e) => setNewAnnouncement({ ...newAnnouncement, type: e.target.value })}
            className={inputCls}
          >
            <option value="Maintenance">Platform Maintenance</option>
            <option value="Release">Release Updates</option>
            <option value="Security">Security Advisory</option>
          </select>
        </Field>
        <Field label="Announcement Title">
          <input
            type="text"
            value={newAnnouncement.title}
            onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
            className={inputCls}
            placeholder="Planned System Downtime"
            required
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Field label="Scheduled Start (Date & Time)">
            <input
              type="datetime-local"
              value={newAnnouncement.scheduledFor || ""}
              onChange={(e) =>
                setNewAnnouncement({ ...newAnnouncement, scheduledFor: e.target.value })
              }
              className={inputCls}
            />
          </Field>
          <Field label="Maintenance Duration">
            <select
              value={newAnnouncement.duration || "2 Hours"}
              onChange={(e) => setNewAnnouncement({ ...newAnnouncement, duration: e.target.value })}
              className={inputCls}
            >
              <option value="1 Hour">1 Hour</option>
              <option value="2 Hours">2 Hours</option>
              <option value="4 Hours">4 Hours</option>
              <option value="6 Hours">6 Hours</option>
              <option value="12 Hours">12 Hours</option>
              <option value="1 Day">1 Day (24 Hours)</option>
              <option value="2 Days">2 Days (48 Hours)</option>
              <option value="3 Days">3 Days (72 Hours)</option>
            </select>
          </Field>
        </div>
        <Field label="Detailed Content (Message)">
          <textarea
            value={newAnnouncement.content}
            onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
            className="w-full min-h-[100px] bg-background border border-input rounded-lg p-3 text-xs outline-none focus:border-primary"
            placeholder="Write detailed notice here..."
            required
          />
        </Field>
        <div className="flex justify-end gap-2 pt-4">
          <Btn onClick={onClose} variant="outline">
            Cancel
          </Btn>
          <Btn type="submit" variant="primary">
            Broadcast Notice
          </Btn>
        </div>
      </form>
    </LocalModalShell>
  );
};

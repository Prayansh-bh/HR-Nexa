import React from "react";
import { ShieldAlert, ArrowUpRight, Users, Sparkles } from "lucide-react";
import { ModalShell, Btn } from "../../../components/ui";
import { useUIStore } from "../../../store";

interface SeatLimitModalProps {
  onClose: () => void;
  message?: string;
  purchasedSeats?: number;
  usedSeats?: number;
}

export function SeatLimitModal({
  onClose,
  message,
  purchasedSeats = 50,
  usedSeats = 50,
}: SeatLimitModalProps) {
  const setActive = useUIStore((s) => s.setActive);

  const handleUpgrade = () => {
    onClose();
    setActive("helpdesk");
  };

  return (
    <ModalShell title="" onClose={onClose}>
      <div className="flex flex-col items-center text-center p-2">
        {/* Header Icon Badge */}
        <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 shadow-xl shadow-amber-500/10">
          <ShieldAlert className="h-10 w-10 animate-bounce" />
          <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-black">
            <Sparkles className="h-3.5 w-3.5 fill-current" />
          </div>
        </div>

        {/* Title & Description */}
        <h3 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl mb-2">
          Seat Limit Reached
        </h3>

        <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
          {message ||
            "Your company has reached its employee seat limit. Upgrade your subscription or free an existing seat before adding another employee."}
        </p>

        {/* Seat Metrics Display Card */}
        <div className="w-full mb-6 rounded-xl border border-border bg-card/60 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-primary" /> Seat Capacity Utilization
            </span>
            <span className="text-amber-500 font-bold">100% Full</span>
          </div>

          <div className="h-3 w-full overflow-hidden rounded-full bg-muted/60 p-0.5">
            <div className="h-full w-full rounded-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-500" />
          </div>

          <div className="mt-3 flex justify-between text-xs text-muted-foreground">
            <span>
              Used Seats: <strong className="text-foreground">{usedSeats}</strong>
            </span>
            <span>
              Allotted Limit: <strong className="text-foreground">{purchasedSeats}</strong>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex w-full flex-col sm:flex-row gap-3">
          <Btn variant="outline" onClick={onClose} className="w-full sm:w-1/2">
            Cancel
          </Btn>
          <Btn
            onClick={handleUpgrade}
            className="w-full sm:w-1/2 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-semibold shadow-lg shadow-rose-500/20"
          >
            <span>Upgrade Plan</span>
            <ArrowUpRight className="h-4 w-4 ml-1" />
          </Btn>
        </div>
      </div>
    </ModalShell>
  );
}

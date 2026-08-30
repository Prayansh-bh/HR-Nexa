import React from "react";
import { AuthUser } from "../../types";
import { useImpersonation } from "../../hooks/useImpersonation";

interface ImpersonationBannerProps {
  user: AuthUser;
  setUser: (u: AuthUser | null) => void;
}

export function ImpersonationBanner({ user, setUser }: ImpersonationBannerProps) {
  const { isImpersonating, impersonatedCompany, exitImpersonation, isExiting } = useImpersonation(setUser);

  if (!isImpersonating || !user || user.role !== "HRAdmin") return null;

  return (
    <div className="sticky top-0 z-[70] bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-white flex items-center justify-between text-xs md:text-sm font-bold shadow-md">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
        <span>
          Impersonating {impersonatedCompany} (HR Admin Portal - {user.name})
        </span>
      </div>
      <button
        onClick={exitImpersonation}
        disabled={isExiting}
        className="bg-white/10 hover:bg-white/20 transition px-3 py-1 rounded-md text-xs font-bold border border-white/20 hover:border-white/40 disabled:opacity-50"
      >
        {isExiting ? "Exiting Impersonation..." : "Exit Impersonation"}
      </button>
    </div>
  );
}


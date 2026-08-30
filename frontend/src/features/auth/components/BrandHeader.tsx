import React from "react";
import { Logo } from "../../../components/ui";

interface BrandHeaderProps {
  variant?: "hero" | "default";
  showTagline?: boolean;
  className?: string;
}

/**
 * BrandHeader Component
 * Single Responsibility: Present the brand logo and identity with an elegant, professional container.
 */
export const BrandHeader: React.FC<BrandHeaderProps> = ({
  variant = "default",
  showTagline = true,
  className = "",
}) => {
  if (variant === "hero") {
    return (
      <div className={`relative flex items-center gap-3.5 text-primary-foreground ${className}`}>
        {/* Glassmorphic Logo Container with subtle border & depth */}
        <div className="relative group flex shrink-0 items-center justify-center p-2.5 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 shadow-lg shadow-black/10 transition-all duration-300 hover:bg-white/25 hover:border-white/40 hover:shadow-xl">
          <div className="absolute inset-0 rounded-2xl bg-white/10 blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <Logo className="h-10 w-auto filter drop-shadow-sm transition-transform duration-300 group-hover:scale-105" />
        </div>

        {/* Brand Typography */}
        <div className="flex flex-col">
          <span className="text-xl font-bold tracking-tight text-white drop-shadow-sm">
            HR Nexa
          </span>
          {showTagline && (
            <span className="text-xs text-white/85 font-medium tracking-wide">
              Empowering People, Elevating Business
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Modern Card Badge Container */}
      <div className="flex shrink-0 items-center justify-center p-2 rounded-xl bg-primary/10 border border-primary/20 shadow-sm transition-all duration-200 hover:bg-primary/15">
        <Logo className="h-8 w-auto" />
      </div>

      {/* Brand Typography */}
      <div className="flex flex-col">
        <span className="text-base font-bold text-foreground tracking-tight">HR Nexa</span>
        {showTagline && (
          <span className="text-[11px] text-muted-foreground font-medium">
            Empowering People, Elevating Business
          </span>
        )}
      </div>
    </div>
  );
};

import React from "react";

interface LogoProps {
  className?: string;
  size?: number | string;
  alt?: string;
}

export const Logo: React.FC<LogoProps> = ({
  className = "h-9 w-auto object-contain",
  size,
  alt = "HR Nexa Logo",
}) => {
  const style = size
    ? { width: size, height: typeof size === "number" ? `${size}px` : size }
    : undefined;

  return (
    <img src="/logo.svg" alt={alt} className={`shrink-0 select-none ${className}`} style={style} />
  );
};

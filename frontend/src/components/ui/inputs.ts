import type React from "react";

export const inputCls =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

export function nameInputProps(value: string, onChange: (v: string) => void) {
  return {
    value,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (/[0-9]/.test(e.key)) e.preventDefault();
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const cleaned = e.target.value.replace(/[0-9]/g, "");
      onChange(cleaned);
    },
    inputMode: "text" as const,
    autoComplete: "off",
  };
}

export function dateInputProps(value: string, onChange: (v: string) => void) {
  return {
    type: "date" as const,
    value,
    max: "9999-12-31",
    min: "1900-01-01",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      let v = e.target.value;
      const m = v.match(/^(\d+)-(\d{2})-(\d{2})$/);
      if (m && m[1].length > 4) v = m[1].slice(0, 4) + "-" + m[2] + "-" + m[3];
      onChange(v);
    },
  };
}

import { PERMISSIONS } from "../auth/permissions";

export const TICKET_STATUS_TONES: Record<
  string,
  "rose" | "amber" | "green" | "slate" | "indigo" | "sky"
> = {
  Open: "rose",
  "In Progress": "sky",
  Resolved: "green",
  Closed: "slate",
};

export function getStatusTone(status?: string | null): "rose" | "amber" | "green" | "slate" | "indigo" | "sky" {
  if (!status) return "slate";
  return TICKET_STATUS_TONES[status] || "indigo";
}

export interface StatusPermissionFlags {
  canStatus: boolean;
  canResolve: boolean;
  canClose: boolean;
}

/**
 * Pure permission-driven utility to calculate available ticket status options.
 * Consumes pre-evaluated capability flags from the authorization engine.
 */
export function getAvailableStatusOptions(
  currentStatus: string,
  flags: StatusPermissionFlags,
): string[] {
  const options: string[] = [];

  if (flags?.canStatus) {
    options.push("Open", "In Progress");
  }

  if (flags?.canResolve) {
    options.push("Resolved");
  }

  if (flags?.canClose) {
    options.push("Closed");
  }

  if (currentStatus && !options.includes(currentStatus)) {
    options.unshift(currentStatus);
  }

  return Array.from(new Set(options));
}

const TIMEZONE_MAP: Record<string, string> = {
  "UTC (Coordinated Universal Time)": "UTC",
  "UTC": "UTC",
  "IST (Indian Standard Time)": "Asia/Kolkata",
  "Asia/Kolkata": "Asia/Kolkata",
  "EST (Eastern Standard Time)": "America/New_York",
  "America/New_York": "America/New_York",
  "PST (Pacific Standard Time)": "America/Los_Angeles",
  "America/Los_Angeles": "America/Los_Angeles",
  "Europe/London": "Europe/London",
  "GMT": "Europe/London",
  "Asia/Dubai": "Asia/Dubai",
  "GST": "Asia/Dubai",
};

export function resolveIanaTimezone(tzStr?: string): string {
  if (!tzStr) return "Asia/Kolkata";
  if (TIMEZONE_MAP[tzStr]) return TIMEZONE_MAP[tzStr];
  try {
    // Validate if tzStr is a valid IANA timezone supported by the browser
    Intl.DateTimeFormat(undefined, { timeZone: tzStr });
    return tzStr;
  } catch {
    return "Asia/Kolkata";
  }
}

export function getBusinessDateString(date: Date = new Date(), timeZoneStr?: string): string {
  const timeZone = resolveIanaTimezone(timeZoneStr);
  return date.toLocaleDateString("en-CA", { timeZone });
}

export function formatDate(
  dateInput: Date | string | number | null | undefined,
  formatPattern: string = "YYYY-MM-DD",
  timeZoneStr?: string
): string {
  if (!dateInput) return "";
  const d = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return String(dateInput);

  const timeZone = resolveIanaTimezone(timeZoneStr);

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value || "1970";
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";

  if (formatPattern === "DD/MM/YYYY") {
    return `${day}/${month}/${year}`;
  }
  if (formatPattern === "MM/DD/YYYY") {
    return `${month}/${day}/${year}`;
  }
  return `${year}-${month}-${day}`;
}

export function formatDateTime(
  dateInput: Date | string | number | null | undefined,
  formatPattern: string = "YYYY-MM-DD",
  timeZoneStr?: string
): string {
  if (!dateInput) return "";
  const d = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return String(dateInput);

  const dateStr = formatDate(d, formatPattern, timeZoneStr);
  const timeZone = resolveIanaTimezone(timeZoneStr);

  const timeStr = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(d);

  return `${dateStr} ${timeStr}`;
}

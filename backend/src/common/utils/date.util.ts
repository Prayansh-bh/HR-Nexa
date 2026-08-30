const TIMEZONE_MAP: Record<string, string> = {
  "UTC (Coordinated Universal Time)": "UTC",
  "UTC": "UTC",
  "IST (Indian Standard Time)": "Asia/Kolkata",
  "Asia/Kolkata": "Asia/Kolkata",
  "EST (Eastern Standard Time)": "America/New_York",
  "America/New_York": "America/New_York",
  "PST (Pacific Standard Time)": "America/Los_Angeles",
  "America/Los_Angeles": "America/Los_Angeles",
};

export function resolveIanaTimezone(tzStr?: string): string {
  if (!tzStr) return "Asia/Kolkata";
  return TIMEZONE_MAP[tzStr] || "Asia/Kolkata";
}

export function getBusinessDateString(date: Date = new Date(), timeZoneStr?: string): string {
  const timeZone = resolveIanaTimezone(timeZoneStr);
  return date.toLocaleDateString("en-CA", { timeZone });
}

export function getBusinessTimeString(
  date: Date = new Date(),
  timeZoneStr?: string,
): string {
  const timeZone = resolveIanaTimezone(timeZoneStr);

  return date.toLocaleTimeString("en-GB", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type ParsedPayrollMonth = {
  year: number;
  monthNum: number;
  monthIndex: number;
  daysInMonth: number;
};

export function parsePayrollMonth(monthInput: string): ParsedPayrollMonth {
  const { BadRequestException } = require('@nestjs/common');
  if (!monthInput || typeof monthInput !== 'string') {
    throw new BadRequestException('Payroll month input must be a non-empty string.');
  }

  const trimmed = monthInput.trim();
  let year: number;
  let monthNum: number;

  if (/^\d{4}-\d{1,2}$/.test(trimmed)) {
    const parts = trimmed.split('-');
    year = parseInt(parts[0], 10);
    monthNum = parseInt(parts[1], 10);
    if (monthNum < 1 || monthNum > 12 || year < 1900 || year > 2100) {
      throw new BadRequestException(
        `Invalid month string "${monthInput}". Month number must be between 01 and 12 and year between 1900 and 2100.`,
      );
    }
  } else {
    const MONTH_NAME_MAP: Record<string, number> = {
      january: 1, jan: 1,
      february: 2, feb: 2,
      march: 3, mar: 3,
      april: 4, apr: 4,
      may: 5,
      june: 6, jun: 6,
      july: 7, jul: 7,
      august: 8, aug: 8,
      september: 9, sep: 9, sept: 9,
      october: 10, oct: 10,
      november: 11, nov: 11,
      december: 12, dec: 12,
    };
    const match = trimmed.match(/^([a-zA-Z]+)\s+(\d{4})$/);
    if (!match) {
      throw new BadRequestException(
        `Invalid month format "${monthInput}". Expected format e.g. "2026-07" or "July 2026".`,
      );
    }
    const mName = match[1].toLowerCase();
    year = parseInt(match[2], 10);
    if (year < 1900 || year > 2100) {
      throw new BadRequestException(`Year ${year} out of valid range (1900-2100).`);
    }
    monthNum = MONTH_NAME_MAP[mName];
    if (!monthNum) {
      throw new BadRequestException(
        `Invalid month name "${match[1]}" in month string "${monthInput}".`,
      );
    }
  }

  const daysInMonth = new Date(year, monthNum, 0).getDate();
  return {
    year,
    monthNum,
    monthIndex: monthNum - 1,
    daysInMonth,
  };
}

/**
 * Accurately calculates subscription expiry date (YYYY-MM-DD) from an authoritative start date,
 * clamping month-end and leap-year boundaries without day-overflow bugs.
 * Strictly validates YYYY-MM-DD calendar inputs against impossible dates.
 */
export function calculateSubscriptionExpiry(
  startDateStr: string,
  cycle: string,
  trialDays: number = 14,
): string {
  if (!startDateStr || typeof startDateStr !== 'string') {
    throw new Error(`Invalid start date string: expected non-empty YYYY-MM-DD string.`);
  }

  const cleanStart = startDateStr.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanStart)) {
    throw new Error(`Invalid start date string format "${startDateStr}". Expected YYYY-MM-DD.`);
  }

  const [year, month, day] = cleanStart.split('-').map((n) => parseInt(n, 10));

  if (
    isNaN(year) ||
    isNaN(month) ||
    isNaN(day) ||
    year < 1900 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1
  ) {
    throw new Error(`Invalid start date "${startDateStr}": out of valid calendar range.`);
  }

  const maxDays = new Date(year, month, 0).getDate();
  if (day > maxDays) {
    throw new Error(
      `Invalid calendar date "${startDateStr}": month ${month} only has ${maxDays} days in year ${year}.`,
    );
  }

  const normCycle = (cycle || 'Monthly').trim().toLowerCase();

  if (normCycle === 'annual') {
    const targetYear = year + 1;
    if (month === 2 && day === 29) {
      const isNextLeap =
        (targetYear % 4 === 0 && targetYear % 100 !== 0) || targetYear % 400 === 0;
      const targetDay = isNextLeap ? 29 : 28;
      return `${targetYear}-02-${String(targetDay).padStart(2, '0')}`;
    }
    return `${targetYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  if (normCycle === 'monthly') {
    let targetYear = year;
    let targetMonth = month + 1;
    if (targetMonth > 12) {
      targetYear += 1;
      targetMonth = 1;
    }
    const maxDaysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
    const targetDay = Math.min(day, maxDaysInTargetMonth);
    return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
  }

  // Trial / Day-based addition (pure calendar arithmetic in UTC to prevent timezone skew)
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + trialDays);
  return d.toISOString().slice(0, 10);
}

export const DAY_NAME_TO_INDEX: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

export const INDEX_TO_FULL_DAY_NAME: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

/**
 * Authoritative Week-Off Parser & Resolver
 *
 * Normalizes raw weekOffs config string or array (e.g. "Saturday, Sunday", ["Sat", "Sun"])
 * into a Set of 0-6 day indexes (0=Sunday, 6=Saturday).
 * Defaults to Sunday (0) & Saturday (6) if input is empty or invalid.
 */
export function parseWeekOffDays(rawWeekOffs?: string | string[] | null): Set<number> {
  const result = new Set<number>();

  if (!rawWeekOffs) {
    result.add(0); // Sunday
    result.add(6); // Saturday
    return result;
  }

  const tokens = Array.isArray(rawWeekOffs)
    ? rawWeekOffs
    : typeof rawWeekOffs === 'string'
      ? rawWeekOffs.split(',')
      : [];

  for (const token of tokens) {
    if (typeof token !== 'string') continue;
    const clean = token.trim().toLowerCase();
    if (clean && clean in DAY_NAME_TO_INDEX) {
      result.add(DAY_NAME_TO_INDEX[clean]);
    }
  }

  if (result.size === 0) {
    result.add(0); // Sunday default fallback
  }

  return result;
}

/**
 * Checks whether a given Date object (or date string YYYY-MM-DD) falls on a configured week-off day.
 */
export function isWeekOffDate(
  date: Date | string,
  weekOffsConfig?: string | string[] | null,
): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return false;
  const dayIndex = dateObj.getDay();
  const weekOffSet = parseWeekOffDays(weekOffsConfig);
  return weekOffSet.has(dayIndex);
}

/**
 * Parses a YYYY-MM-DD string into explicit calendar components (year, monthIndex, day).
 */
export function parseDateOnly(dateStr?: string | null): { year: number; monthIndex: number; day: number } | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.trim().split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return { year, monthIndex: month - 1, day };
}

/**
 * Calculates the number of eligible working days between startDate and endDate (inclusive),
 * excluding configured week-offs and public holidays.
 *
 * Fully timezone-safe: uses explicit calendar component parsing to avoid UTC vs local day shifts.
 */
export function calculateWorkingDaysInRange(
  startDateStr: string,
  endDateStr: string,
  weekOffsConfig?: string | string[] | null,
  holidaysList: string[] = [],
): number {
  const startParts = parseDateOnly(startDateStr);
  const endParts = parseDateOnly(endDateStr);
  if (!startParts || !endParts) {
    return 0;
  }

  const startUtc = Date.UTC(startParts.year, startParts.monthIndex, startParts.day);
  const endUtc = Date.UTC(endParts.year, endParts.monthIndex, endParts.day);

  if (endUtc < startUtc) {
    return 0;
  }

  const weekOffSet = parseWeekOffDays(weekOffsConfig);
  let workingDays = 0;

  let currentUtc = startUtc;
  const oneDayMs = 24 * 60 * 60 * 1000;

  while (currentUtc <= endUtc) {
    const d = new Date(currentUtc);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dayNum = String(d.getUTCDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${dayNum}`;

    const isWeekend = weekOffSet.has(d.getUTCDay());
    const isHoliday = holidaysList.includes(dateStr);

    if (!isWeekend && !isHoliday) {
      workingDays++;
    }

    currentUtc += oneDayMs;
  }

  return workingDays;
}



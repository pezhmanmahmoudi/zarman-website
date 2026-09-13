// AUSTRAC IFTI-DRA reports must be given to AUSTRAC within 10 business days
// after the day money/property is received from (outgoing) or made
// available to (incoming) the customer. This module is the single source of
// truth for that "10 business day" deadline math — pure, dependency-free,
// and safe to unit test without a database.
//
// Business-day calculation skips weekends and the fixed-date + Easter-based
// national Australian public holidays. State-specific public holidays
// (e.g. Labour Day, King's Birthday) are NOT included since they vary by
// state/territory — extend `nationalPublicHolidays()` below if a specific
// state's calendar must be honoured.

export const AUSTRAC_REPORTING_BUSINESS_DAYS = 10;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function utcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return utcDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days);
}

/** Parses a "YYYY-MM-DD" string, or takes the date portion of a full timestamp. */
export function parseAustracDate(value: string): Date {
  const raw = value.trim();
  const isoDay = ISO_DATE.test(raw) ? raw : raw.slice(0, 10);
  if (!ISO_DATE.test(isoDay)) throw new Error(`Invalid date: ${value}`);
  const [year, month, day] = isoDay.split("-").map(Number);
  const date = utcDate(year, month - 1, day);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
  return date;
}

/** Easter Sunday (Anonymous Gregorian algorithm) — needed for Good Friday/Easter Monday. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcDate(year, month - 1, day);
}

/** National (fixed-date + Easter-based) Australian public holidays for a given year. */
function nationalPublicHolidays(year: number): Set<string> {
  const easter = easterSunday(year);
  return new Set([
    toIsoDate(utcDate(year, 0, 1)), // New Year's Day
    toIsoDate(utcDate(year, 0, 26)), // Australia Day
    toIsoDate(addDays(easter, -2)), // Good Friday
    toIsoDate(addDays(easter, 1)), // Easter Monday
    toIsoDate(utcDate(year, 3, 25)), // Anzac Day
    toIsoDate(utcDate(year, 11, 25)), // Christmas Day
    toIsoDate(utcDate(year, 11, 26)), // Boxing Day
  ]);
}

const holidayCache = new Map<number, Set<string>>();
function publicHolidaysForYear(year: number): Set<string> {
  let cached = holidayCache.get(year);
  if (!cached) {
    cached = nationalPublicHolidays(year);
    holidayCache.set(year, cached);
  }
  return cached;
}

export function isAustralianBusinessDay(date: Date): boolean {
  const weekday = date.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  return !publicHolidaysForYear(date.getUTCFullYear()).has(toIsoDate(date));
}

export function addBusinessDays(date: Date, days: number): Date {
  let cursor = date;
  let remaining = days;
  while (remaining > 0) {
    cursor = addDays(cursor, 1);
    if (isAustralianBusinessDay(cursor)) remaining -= 1;
  }
  return cursor;
}

/** The AUSTRAC submission deadline for a transaction dated `referenceDateIso`. */
export function calcAustracDueDate(referenceDateIso: string): string {
  const reference = parseAustracDate(referenceDateIso);
  return toIsoDate(addBusinessDays(reference, AUSTRAC_REPORTING_BUSINESS_DAYS));
}

/**
 * Business days remaining until `dueDateIso`, relative to `nowIso` (defaults
 * to today). 0 = due today, positive = days left, negative = business days
 * overdue.
 */
export function calcBusinessDaysRemaining(dueDateIso: string, nowIso?: string): number {
  const due = parseAustracDate(dueDateIso);
  const now = parseAustracDate(nowIso ?? toIsoDate(new Date()));
  if (due.getTime() === now.getTime()) return 0;

  let count = 0;
  if (now < due) {
    let cursor = addDays(now, 1);
    while (cursor <= due) {
      if (isAustralianBusinessDay(cursor)) count += 1;
      cursor = addDays(cursor, 1);
    }
    return count;
  }

  let cursor = addDays(due, 1);
  while (cursor <= now) {
    if (isAustralianBusinessDay(cursor)) count += 1;
    cursor = addDays(cursor, 1);
  }
  return -count;
}

export type AustracUrgency = "overdue" | "urgent" | "soon" | "ok";

/** overdue: past due · urgent: due today/tomorrow · soon: within 3 business days · ok: otherwise. */
export function classifyAustracUrgency(daysRemaining: number): AustracUrgency {
  if (daysRemaining < 0) return "overdue";
  if (daysRemaining <= 1) return "urgent";
  if (daysRemaining <= 3) return "soon";
  return "ok";
}

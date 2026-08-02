import type { ReportPeriod, ReportPreset } from "./types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CUSTOM_DAYS = 731;

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function parseIsoDate(value: string): Date {
  if (!ISO_DATE.test(value)) throw new Error("Invalid report date.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || iso(date) !== value) throw new Error("Invalid report date.");
  return date;
}

export function resolveReportPeriod(
  presetValue?: string,
  customStart?: string,
  customEnd?: string,
  now = new Date(),
): ReportPeriod {
  const allowed: ReportPreset[] = ["this-month", "last-month", "quarter", "year", "custom"];
  const preset = allowed.includes(presetValue as ReportPreset) ? (presetValue as ReportPreset) : "this-month";
  const today = utcDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let start: Date;
  let end: Date;

  if (preset === "custom") {
    if (!customStart || !customEnd) throw new Error("Custom reports require a start and end date.");
    start = parseIsoDate(customStart);
    end = parseIsoDate(customEnd);
  } else if (preset === "last-month") {
    start = utcDate(today.getUTCFullYear(), today.getUTCMonth() - 1, 1);
    end = utcDate(today.getUTCFullYear(), today.getUTCMonth(), 0);
  } else if (preset === "quarter") {
    const quarterMonth = Math.floor(today.getUTCMonth() / 3) * 3;
    start = utcDate(today.getUTCFullYear(), quarterMonth, 1);
    end = today;
  } else if (preset === "year") {
    start = utcDate(today.getUTCFullYear(), 0, 1);
    end = today;
  } else {
    start = utcDate(today.getUTCFullYear(), today.getUTCMonth(), 1);
    end = today;
  }

  if (start > end) throw new Error("Report start date must be before the end date.");
  const spanDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (spanDays > MAX_CUSTOM_DAYS) throw new Error("Report ranges cannot exceed two years.");

  const previousEnd = addDays(start, -1);
  const previousStart = addDays(previousEnd, -(spanDays - 1));
  return {
    preset,
    start: iso(start),
    end: iso(end),
    previousStart: iso(previousStart),
    previousEnd: iso(previousEnd),
    label: `${iso(start)} to ${iso(end)}`,
  };
}
import { TFieldType } from "../models/TFieldType";

export type DateFieldKind = "date" | "datetime" | "time";

const DATE_TYPES = new Set<number>([TFieldType.ftDate]);
const TIME_TYPES = new Set<number>([TFieldType.ftTime]);
const DATETIME_TYPES = new Set<number>([
  TFieldType.ftDateTime,
  TFieldType.ftTimeStamp,
  TFieldType.ftOraTimeStamp,
  TFieldType.ftTimeStampOffset,
]);

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^\d{2}:\d{2}(?::\d{2})?$/;
const DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/;

const DELPHI_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

function toNumericFieldType(fieldType: unknown): number | undefined {
  if (typeof fieldType === "number") return fieldType;
  if (typeof fieldType === "string") {
    const trimmed = fieldType.trim();
    if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
    const lookup = (TFieldType as unknown as Record<string, number>)[trimmed];
    if (typeof lookup === "number") return lookup;
  }
  return undefined;
}

export function detectDateFieldKind(fieldType: unknown): DateFieldKind | null {
  const numeric = toNumericFieldType(fieldType);
  if (numeric === undefined) return null;
  if (DATE_TYPES.has(numeric)) return "date";
  if (TIME_TYPES.has(numeric)) return "time";
  if (DATETIME_TYPES.has(numeric)) return "datetime";
  return null;
}

export function detectCalculatedFieldKind(dataType: unknown): DateFieldKind | null {
  if (typeof dataType !== "string") return null;
  switch (dataType) {
    case "Date":
      return "date";
    case "Time":
      return "time";
    case "DateTime":
      return "datetime";
    default:
      return null;
  }
}

export function expectedFormatLabel(kind: DateFieldKind): string {
  switch (kind) {
    case "date":
      return "YYYY-MM-DD";
    case "time":
      return "HH:mm:ss";
    case "datetime":
      return "YYYY-MM-DDTHH:mm:ss";
  }
}

export function isValidIsoForKind(value: unknown, kind: DateFieldKind): boolean {
  if (typeof value !== "string") return false;
  const regex =
    kind === "date" ? DATE_REGEX : kind === "time" ? TIME_REGEX : DATETIME_REGEX;
  if (!regex.test(value)) return false;

  if (kind === "date") {
    const [y, m, d] = value.split("-").map(Number) as [number, number, number];
    return isValidCalendarDate(y, m, d);
  }
  if (kind === "time") {
    const [h, min, s = "0"] = value.split(":") as [string, string, string?];
    return isValidTimeOfDay(Number(h), Number(min), Number(s));
  }
  const [datePart, timePart] = value.split("T") as [string, string];
  const [y, m, d] = datePart.split("-").map(Number) as [number, number, number];
  if (!isValidCalendarDate(y, m, d)) return false;
  const [hh, mm, rest = "0"] = timePart.split(":") as [string, string, string?];
  const seconds = parseFloat(rest);
  return isValidTimeOfDay(Number(hh), Number(mm), seconds);
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const utc = Date.UTC(year, month - 1, day);
  const back = new Date(utc);
  return (
    back.getUTCFullYear() === year &&
    back.getUTCMonth() === month - 1 &&
    back.getUTCDate() === day
  );
}

function isValidTimeOfDay(h: number, m: number, s: number): boolean {
  return (
    Number.isFinite(h) &&
    Number.isFinite(m) &&
    Number.isFinite(s) &&
    h >= 0 && h <= 23 &&
    m >= 0 && m <= 59 &&
    s >= 0 && s < 60
  );
}

export function isoToDelphi(value: string, kind: DateFieldKind): number {
  if (kind === "time") {
    const [h, m, s = "0"] = value.split(":") as [string, string, string?];
    return timeOfDayToFraction(Number(h), Number(m), parseFloat(s));
  }

  if (kind === "date") {
    const [y, mo, d] = value.split("-").map(Number) as [number, number, number];
    return daysSinceDelphiEpoch(y, mo, d);
  }

  const [datePart, timePart] = value.split("T") as [string, string];
  const [y, mo, d] = datePart.split("-").map(Number) as [number, number, number];
  const [h, m, rest = "0"] = timePart.split(":") as [string, string, string?];
  const days = daysSinceDelphiEpoch(y, mo, d);
  const frac = timeOfDayToFraction(Number(h), Number(m), parseFloat(rest));
  return days + frac;
}

function daysSinceDelphiEpoch(year: number, month: number, day: number): number {
  const utc = Date.UTC(year, month - 1, day);
  return Math.round((utc - DELPHI_EPOCH_MS) / MS_PER_DAY);
}

function timeOfDayToFraction(h: number, m: number, s: number): number {
  const totalSeconds = h * 3600 + m * 60 + s;
  return totalSeconds / 86_400;
}

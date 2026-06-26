export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatCivilDate(date: CivilDate): string {
  return `${date.year.toString().padStart(4, "0")}-${date.month.toString().padStart(2, "0")}-${date.day.toString().padStart(2, "0")}`;
}

export function parseCivilDate(value: string): CivilDate | null {
  const match = DATE_PATTERN.exec(value);
  if (match === null) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!isValidCivilDate(year, month, day)) {
    return null;
  }

  return { year, month, day };
}

export function todayLocalCivilDate(now = new Date()): CivilDate {
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

export function addCivilDays(date: CivilDate, days: number): CivilDate {
  const utcDate = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: utcDate.getUTCFullYear(),
    month: utcDate.getUTCMonth() + 1,
    day: utcDate.getUTCDate(),
  };
}

export function compareCivilDates(a: CivilDate, b: CivilDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

export function buildInclusiveDateWindow(to: CivilDate, days: number): CivilDate[] {
  return Array.from({ length: days }, (_, index) => addCivilDays(to, index - days + 1));
}

function isValidCivilDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

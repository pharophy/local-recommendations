import { addDays, differenceInCalendarDays, isValid, parse, parseISO, startOfDay } from 'date-fns';

const DATE_FORMATS = ['MMMM d, yyyy', 'MMM d, yyyy', 'M/d/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'];

export function parseLooseDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const direct = parseISO(value);
  if (isValid(direct)) {
    return direct;
  }

  for (const format of DATE_FORMATS) {
    const parsed = parse(value, format, new Date());
    if (isValid(parsed)) {
      return parsed;
    }
  }

  const dayRangeBeforeMonthMatch = value.match(
    /\b(\d{1,2})\s*-\s*\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b/i,
  );
  if (dayRangeBeforeMonthMatch) {
    const day = dayRangeBeforeMonthMatch[1];
    const month = dayRangeBeforeMonthMatch[2];
    if (day && month) {
      const parsed = parseDayMonth(day, month);
      if (parsed) {
        return parsed;
      }
    }
  }

  const dayMonthRangeMatch = value.match(
    /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)(?:\s*-\s*\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec))?\b/i,
  );
  if (dayMonthRangeMatch) {
    const day = dayMonthRangeMatch[1];
    const month = dayMonthRangeMatch[2];
    if (day && month) {
      const parsed = parseDayMonth(day, month);
      if (parsed) {
        return parsed;
      }
    }
  }

  const monthDayRangeMatch = value.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+\d{1,2}\s*-\s*\d{1,2}\b/i,
  )?.[0];
  if (monthDayRangeMatch) {
    const firstPart = monthDayRangeMatch.match(
      /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+\d{1,2}/i,
    )?.[0];
    if (firstPart) {
      for (const format of ['MMMM d', 'MMM d']) {
        const parsed = parse(firstPart, format, new Date());
        if (isValid(parsed)) {
          return parsed;
        }
      }
    }
  }

  const regex = /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+\d{1,2}(?:,\s+\d{4})?/i;
  const match = value.match(regex)?.[0];
  if (!match) {
    return null;
  }

  for (const format of ['MMMM d, yyyy', 'MMM d, yyyy', 'MMMM d', 'MMM d']) {
    const parsed = parse(match, format, new Date());
    if (isValid(parsed)) {
      return parsed;
    }
  }

  return null;
}

function parseDayMonth(day: string, month: string): Date | null {
  const baseYear = new Date().getFullYear();
  const candidate = parse(`${day} ${month} ${baseYear}`, 'd MMM yyyy', new Date());
  if (isValid(candidate)) {
    return candidate;
  }

  const withLongMonth = parse(`${day} ${month} ${baseYear}`, 'd MMMM yyyy', new Date());
  return isValid(withLongMonth) ? withLongMonth : null;
}

export function isDateWithinDays(value: string | undefined, days: number, now = new Date()): boolean {
  const parsed = parseLooseDate(value);
  if (!parsed) {
    return false;
  }

  const start = startOfDay(now);
  const end = addDays(start, days);
  return parsed >= start && parsed <= end;
}

export function recencyBoost(value: string | undefined, windowDays: number, now = new Date()): number {
  const parsed = parseLooseDate(value);
  if (!parsed) {
    return 0;
  }

  const delta = differenceInCalendarDays(parsed, startOfDay(now));
  if (delta < 0 || delta > windowDays) {
    return -3;
  }

  return Math.max(0, 8 - delta / 4);
}

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

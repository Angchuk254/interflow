
export const APP_TIMEZONE = 'Asia/Kolkata' as const;


export function toLocalDateString(date: Date): string {
  return new Date(date).toLocaleDateString('en-CA', { timeZone: APP_TIMEZONE });
}


export function subtractCalendarDaysIST(isoDateStr: string, days: number): string {
  const d = new Date(`${isoDateStr}T12:00:00+05:30`);
  d.setDate(d.getDate() - days);
  return toLocalDateString(d);
}

export function startOfDayInAppTimezoneUtc(isoDateStr: string): Date {
  return new Date(`${isoDateStr}T00:00:00+05:30`);
}


export function startOfDayAppTimezoneDaysAgo(daysAgo: number): Date {
  const todayIst = toLocalDateString(new Date());
  const startStr = subtractCalendarDaysIST(todayIst, daysAgo);
  return startOfDayInAppTimezoneUtc(startStr);
}


export function lastNCalendarDaysIST(n: number): string[] {
  const today = toLocalDateString(new Date());
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(subtractCalendarDaysIST(today, i));
  }
  return out;
}


export function shortWeekdayLabelIST(isoDateStr: string): string {
  return startOfDayInAppTimezoneUtc(isoDateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    timeZone: APP_TIMEZONE,
  });
}

export function addCalendarDaysIST(isoDateStr: string, days: number): string {
  const d = new Date(`${isoDateStr}T12:00:00+05:30`);
  d.setDate(d.getDate() + days);
  return toLocalDateString(d);
}

const IST_WEEKDAY_TO_OFFSET: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};


export function startOfWeekSundayIST(): string {
  const today = toLocalDateString(new Date());
  const noon = new Date(`${today}T12:00:00+05:30`);
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    weekday: 'short',
  }).format(noon);
  const idx = IST_WEEKDAY_TO_OFFSET[wd] ?? 0;
  return subtractCalendarDaysIST(today, idx);
}

export function firstDayOfCurrentMonthIST(): string {
  const today = toLocalDateString(new Date());
  return `${today.slice(0, 7)}-01`;
}

export function firstDayOfCurrentYearIST(): string {
  const today = toLocalDateString(new Date());
  return `${today.slice(0, 4)}-01-01`;
}

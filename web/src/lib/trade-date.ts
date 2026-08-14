// Journal OS is always anchored to the America/New_York trading session,
// never the server's local time or a hardcoded UTC offset (DST-unsafe).
// See LEGACY_JOURNAL_OS_V7_4_3_REFERENCE.md §18.

const TRADE_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getCurrentTradeDateET(): string {
  // en-CA formats as YYYY-MM-DD, which is what the `date` column expects.
  return TRADE_DATE_FORMATTER.format(new Date());
}

/** Same as getCurrentTradeDateET but for an arbitrary ISO instant (e.g. a broker fill's executed_at). */
export function getTradeDateForInstant(isoInstant: string): string {
  return TRADE_DATE_FORMATTER.format(new Date(isoInstant));
}

const TRADE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidTradeDate(value: string): boolean {
  return TRADE_DATE_PATTERN.test(value);
}

// Plain calendar-day arithmetic on a YYYY-MM-DD string. Deliberately not
// timezone-aware — once a trade_date is stored it's just a calendar date,
// independent of America/New_York wall-clock time.
export function shiftTradeDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The Monday-Friday trading week (both YYYY-MM-DD) containing `dateStr`. */
export function getTradingWeekBounds(dateStr: string): { weekStart: string; weekEnd: string } {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(date);
  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);
  const friday = new Date(monday);
  friday.setUTCDate(friday.getUTCDate() + 4);
  return { weekStart: monday.toISOString().slice(0, 10), weekEnd: friday.toISOString().slice(0, 10) };
}

/** Shifts a week_start (Monday) by whole weeks, staying Monday-aligned. */
export function shiftTradingWeek(weekStartStr: string, weeks: number): string {
  return shiftTradeDate(weekStartStr, weeks * 7);
}

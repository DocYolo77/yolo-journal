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

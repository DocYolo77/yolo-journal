// Converts an IBKR Flex "dateTime" attribute (format "YYYYMMDD;HHMMSS")
// into a real UTC ISO instant.
//
// The wall-clock timezone of that string is America/New_York — verified
// empirically, not assumed: a real YOLO_JOURNAL_TRADES statement's fill
// timestamps all fall within 09:30-16:00 when read as ET (consistent
// with this account's RTH ORB-based methodology); reading the same
// values as UTC would place most fills in pre-market, which doesn't
// match. DST-safe: derives the actual UTC offset for each date from
// Intl rather than a hardcoded -4/-5.

const ET_OFFSET_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  timeZoneName: "shortOffset",
});

/** Minutes America/New_York is BEHIND UTC at the given instant (240 for EDT, 300 for EST). */
function etOffsetMinutesAt(instant: Date): number {
  const part = ET_OFFSET_FORMATTER.formatToParts(instant).find((p) => p.type === "timeZoneName")?.value;
  const match = part?.match(/GMT([+-]\d{1,2})/);
  const offsetHours = match ? Number(match[1]) : -5;
  return -offsetHours * 60;
}

/**
 * `ibkrDateTime` like "20260807;102358" — date and time both America/
 * New_York wall-clock. Returns a real UTC ISO instant.
 */
export function parseIbkrEtDateTimeToIso(ibkrDateTime: string): string {
  const [datePart, timePart = "000000"] = ibkrDateTime.split(";");
  const year = Number(datePart.slice(0, 4));
  const month = Number(datePart.slice(4, 6));
  const day = Number(datePart.slice(6, 8));
  const hour = Number(timePart.slice(0, 2));
  const minute = Number(timePart.slice(2, 4));
  const second = Number(timePart.slice(4, 6)) || 0;

  // Treat the wall-clock numbers as if they were UTC, then correct by
  // the real ET-vs-UTC offset for that calendar date/time.
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetMinutes = etOffsetMinutesAt(new Date(naiveUtcMs));
  const realUtcMs = naiveUtcMs + offsetMinutes * 60_000;
  return new Date(realUtcMs).toISOString();
}

/** `ibkrDate` like "20260813" -> "2026-08-13". */
export function parseIbkrDateToIsoDate(ibkrDate: string): string {
  return `${ibkrDate.slice(0, 4)}-${ibkrDate.slice(4, 6)}-${ibkrDate.slice(6, 8)}`;
}

export function formatDateTime(value: string | null): string {
  if (!value) return "–";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatNumber(
  value: number | null | undefined,
  fractionDigits = 2
): string {
  if (value == null) return "–";
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

// Assumes USD until per-account currency is wired through trade P&L display.
export function formatCurrency(
  value: number | null | undefined,
  currency = "USD"
): string {
  if (value == null) return "–";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function toDatetimeLocalValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Minimal attribute-only XML element extractor — no XML parsing library
// dependency (same "hand-rolled, pure" style as the rest of this app).
// Every element this app reads from a Flex statement (TradeConfirm,
// EquitySummaryByReportDateInBase, CashReportCurrency, OpenPosition,
// FIFOPerformanceSummaryUnderlying, FlexStatement) is a self-closing or
// simple tag whose only content is `attr="value"` pairs — no nested
// children, no text content — so a full XML parser isn't needed.

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

function decodeXmlEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m] ?? m);
}

function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrPattern = /([\w:]+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = attrPattern.exec(attrString)) !== null) {
    attrs[match[1]] = decodeXmlEntities(match[2]);
  }
  return attrs;
}

/**
 * Finds every `<tagName ...attrs.../>` or `<tagName ...attrs...>` (open
 * tag, ignoring any children/closing tag — fine for this app's purposes
 * since every attribute we need is on the opening tag itself) in `xml`
 * and returns each as a plain attribute map.
 */
export function extractElements(xml: string, tagName: string): Record<string, string>[] {
  const pattern = new RegExp(`<${tagName}\\s+([^>]*?)\\/?>`, "g");
  const results: Record<string, string>[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    results.push(parseAttributes(match[1]));
  }
  return results;
}

/** Convenience for elements expected to appear at most once (e.g. FlexStatement). */
export function extractFirstElement(xml: string, tagName: string): Record<string, string> | null {
  return extractElements(xml, tagName)[0] ?? null;
}

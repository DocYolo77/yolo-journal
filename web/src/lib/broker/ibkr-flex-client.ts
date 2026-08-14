// IBKR Flex Web Service client — the two-step SendRequest/GetStatement
// flow and its outer <FlexStatementResponse> envelope
// (Status/ReferenceCode/ErrorCode/ErrorMessage/Url) are IBKR's stable,
// publicly documented protocol and are implemented here directly. The
// INNER statement content once ready (<FlexQueryResponse> with its
// Trade/OpenPosition/CashReport-etc. elements) is deliberately NOT
// parsed in this file — those attribute names depend on which optional
// columns the user configured in their own Flex Query definition inside
// IBKR Account Management, so per explicit instruction they are parsed
// only in lib/broker/ibkr-flex-normalize.ts, built against a real
// captured response rather than guessed.
//
// Server-only. IBKR_FLEX_TOKEN is never logged, returned, or included in
// any thrown error message.

const SEND_REQUEST_URL = "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/SendRequest";
const GET_STATEMENT_URL = "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement";

const POLL_MAX_ATTEMPTS = 8;
const POLL_DELAY_MS = 3000;

export type FlexQueryType = "trades" | "activity";

function requireEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} ist nicht gesetzt.`);
  }
  return value;
}

function queryIdFor(type: FlexQueryType): string {
  return type === "trades"
    ? requireEnvVar("IBKR_FLEX_TRADES_QUERY_ID")
    : requireEnvVar("IBKR_FLEX_ACTIVITY_QUERY_ID");
}

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match ? match[1].trim() : null;
}

type StatementResponseEnvelope =
  | { status: "success"; referenceCode: string; statementUrl: string }
  | { status: "fail"; errorCode: string; errorMessage: string };

/**
 * Parses a <FlexStatementResponse> envelope — returned by SendRequest
 * always, and by GetStatement whenever the statement isn't ready yet or
 * the request failed. Once the statement IS ready, GetStatement returns
 * a completely different root element (<FlexQueryResponse>), which this
 * function is not used for — see isFlexQueryResponse below.
 */
function parseStatementResponseEnvelope(xml: string): StatementResponseEnvelope {
  const status = extractTag(xml, "Status");
  if (status === "Success") {
    const referenceCode = extractTag(xml, "ReferenceCode");
    const statementUrl = extractTag(xml, "Url") ?? GET_STATEMENT_URL;
    if (!referenceCode) {
      throw new Error("IBKR Flex SendRequest: Status war 'Success', aber kein ReferenceCode in der Antwort.");
    }
    return { status: "success", referenceCode, statementUrl };
  }
  return {
    status: "fail",
    errorCode: extractTag(xml, "ErrorCode") ?? "unknown",
    errorMessage: extractTag(xml, "ErrorMessage") ?? "Unbekannter Fehler ohne ErrorMessage in der IBKR-Antwort.",
  };
}

function isFlexQueryResponse(xml: string): boolean {
  return xml.includes("<FlexQueryResponse");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendRequest(token: string, queryId: string): Promise<StatementResponseEnvelope> {
  const url = `${SEND_REQUEST_URL}?t=${encodeURIComponent(token)}&q=${encodeURIComponent(queryId)}&v=3`;
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`IBKR Flex SendRequest: HTTP ${res.status}.`);
  }
  return parseStatementResponseEnvelope(text);
}

/**
 * Polls GetStatement until the real statement XML is returned. IBKR
 * generates Flex statements asynchronously — a fresh ReferenceCode
 * typically isn't ready for a few seconds, and GetStatement reports that
 * via the same fail-envelope shape as a real error (e.g. "generation in
 * progress"). Since the exact "still generating" error code isn't
 * something to guess either, this retries on ANY fail envelope up to
 * POLL_MAX_ATTEMPTS and only then surfaces the last error — a genuinely
 * fatal error (bad token, unknown query id) just takes a few extra
 * seconds to report instead of a wrong "still generating" special case.
 */
async function pollGetStatement(token: string, referenceCode: string, statementUrl: string): Promise<string> {
  let lastError: StatementResponseEnvelope | null = null;

  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(POLL_DELAY_MS);
    }

    const url = `${statementUrl}?q=${encodeURIComponent(referenceCode)}&t=${encodeURIComponent(token)}&v=3`;
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();

    if (!res.ok) {
      lastError = { status: "fail", errorCode: `http_${res.status}`, errorMessage: `HTTP ${res.status}.` };
      continue;
    }

    if (isFlexQueryResponse(text)) {
      return text;
    }

    const envelope = parseStatementResponseEnvelope(text);
    if (envelope.status === "success") {
      // SendRequest-shaped success from GetStatement would be unexpected
      // but isn't a FlexQueryResponse yet — treat as "not ready" and retry.
      lastError = { status: "fail", errorCode: "unexpected_envelope", errorMessage: "Unerwartete Antwortform." };
      continue;
    }
    lastError = envelope;
  }

  throw new Error(
    lastError
      ? `IBKR Flex GetStatement: ${lastError.errorMessage} (Code ${lastError.errorCode}) — auch nach ${POLL_MAX_ATTEMPTS} Versuchen nicht bereit.`
      : `IBKR Flex GetStatement: Zeitüberschreitung nach ${POLL_MAX_ATTEMPTS} Versuchen.`
  );
}

/**
 * Runs the full SendRequest -> poll GetStatement flow for one of the two
 * configured Flex Queries and returns the raw <FlexQueryResponse> XML
 * text, unparsed.
 */
export async function fetchFlexStatementXml(type: FlexQueryType): Promise<string> {
  const token = requireEnvVar("IBKR_FLEX_TOKEN");
  const queryId = queryIdFor(type);

  const sent = await sendRequest(token, queryId);
  if (sent.status === "fail") {
    throw new Error(`IBKR Flex SendRequest fehlgeschlagen: ${sent.errorMessage} (Code ${sent.errorCode})`);
  }

  return pollGetStatement(token, sent.referenceCode, sent.statementUrl);
}

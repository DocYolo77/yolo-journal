import { NextResponse } from "next/server";
import { fetchFlexStatementXml, type FlexQueryType } from "@/lib/broker/ibkr-flex-client";

// Temporary, auth-gated (proxy.ts protects every route, this one is no
// exception) diagnostic endpoint: fetches a real IBKR Flex statement and
// returns the raw XML verbatim so its actual field names can be read and
// used to build the real parser (lib/broker/ibkr-flex-normalize.ts),
// instead of guessing at Trade/OpenPosition/CashReport attribute names.
// Delete once that parser exists and has been verified against this
// output. Never logs IBKR_FLEX_TOKEN.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (type !== "trades" && type !== "activity") {
    return NextResponse.json({ error: "Query-Parameter 'type' muss 'trades' oder 'activity' sein." }, { status: 400 });
  }

  try {
    const xml = await fetchFlexStatementXml(type as FlexQueryType);
    return new NextResponse(xml, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (e) {
    console.error("debug-flex failed", e instanceof Error ? e.message : e);
    const message = e instanceof Error ? e.message : "Unbekannter Fehler beim Abrufen des Flex-Statements.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

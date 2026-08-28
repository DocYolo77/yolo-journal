import Anthropic from "@anthropic-ai/sdk";
import type { CommitmentWithChildren } from "@/lib/data/commitments";
import type { DailyReportCampaign } from "@/lib/supabase/types";
import type { DailyReviewInput } from "@/lib/validation/daily-review";

// Server-only. Single Messages API call, no tools/agent loop — a daily
// coaching summary is pure text generation over already-structured
// review data, nothing that needs an agentic loop. ANTHROPIC_API_KEY is
// read from the environment by the SDK's zero-arg constructor and never
// logged, returned, or exposed to the client.

const SYSTEM_PROMPT = `Du bist ein nüchterner Trading-Coach für einen erfahrenen Daytrader.
Schreibe ein kurzes, faktenbasiertes Fazit (3-6 Sätze, Deutsch) für den heutigen Trading-Tag,
ausschließlich auf Basis der bereitgestellten Daten — keine erfundenen Fakten, keine erfundenen
Zahlen, keine psychologischen Diagnosen (nur beschreiben, was die Daten hergeben, nicht
interpretieren oder pathologisieren). Struktur: Was ist heute passiert (Ergebnis, Trades),
was wurde regelkonform eingehalten bzw. verletzt (Guardrails), was sollte konkret verbessert
werden. Kein Blabla, keine Floskeln, keine Anrede, keine Überschrift — nur der Fließtext.`;

function formatCurrency(value: number | null): string {
  return value == null ? "–" : `${value.toFixed(2)} $`;
}

function buildPrompt(params: {
  tradeDate: string;
  review: DailyReviewInput;
  commitment: CommitmentWithChildren | null;
  campaigns: DailyReportCampaign[];
}): string {
  const { tradeDate, review, commitment, campaigns } = params;

  const lines: string[] = [`Trade-Datum: ${tradeDate}`];

  lines.push(`NLV: ${formatCurrency(review.net_liquidation_value)} · Daily P&L: ${formatCurrency(review.daily_pnl)}`);

  if (commitment) {
    lines.push(
      `Premarket-Plan (gelockt): Committed-Risiko ${commitment.committed_risk_pct ?? "–"}%, Operativer Plan: ${commitment.operational_plan || "–"}`
    );
  } else {
    lines.push("Kein gelocktes Premarket-Commitment für diesen Tag.");
  }

  if (campaigns.length > 0) {
    lines.push("Campaigns heute:");
    for (const c of campaigns) {
      const entry = c.fills[0];
      const exit = c.status === "closed" && c.fills.length > 1 ? c.fills[c.fills.length - 1] : null;
      lines.push(
        `- ${c.symbol} (${c.direction ?? "?"}, ${c.status}): Entry ${entry ? `${formatCurrency(entry.price)} x ${entry.quantity}` : "–"}` +
          (exit ? `, Exit ${formatCurrency(exit.price)} x ${exit.quantity}` : "") +
          (c.realized_pnl != null ? `, Realized ${formatCurrency(c.realized_pnl)}` : "")
      );
    }
  } else {
    lines.push("Keine Campaigns für diesen Tag synchronisiert.");
  }

  const violatedGuardrails = review.guardrails.filter((g) => g.status === "Verletzt");
  if (violatedGuardrails.length > 0) {
    lines.push("Verletzte Guardrails:");
    for (const g of violatedGuardrails) {
      lines.push(`- ${g.guardrail}${g.comment ? `: ${g.comment}` : ""}`);
    }
  } else {
    lines.push("Keine verletzten Guardrails erfasst.");
  }

  if (review.market_thought) lines.push(`Sessionverlauf: ${review.market_thought}`);
  if (review.market_environment) lines.push(`Marktumgebung: ${review.market_environment}`);
  if (review.positive) lines.push(`Positive: ${review.positive}`);
  if (review.weakness) lines.push(`Weakness: ${review.weakness}`);
  if (review.operational_todos.length > 0) {
    lines.push(`Verbesserungspunkte: ${review.operational_todos.join("; ")}`);
  }
  if (review.shadowlist_comment) lines.push(`Shadowlist-Kommentar: ${review.shadowlist_comment}`);

  if (review.ticker_reviews.length > 0) {
    lines.push("Ticker Reviews:");
    for (const t of review.ticker_reviews) {
      const parts = [t.setup, t.entry_tactic, t.qullamaggie_rating, t.management_grade, t.rule_status]
        .filter(Boolean)
        .join(" / ");
      lines.push(`- ${t.ticker}: ${parts || "–"}${t.notes ? ` — ${t.notes}` : ""}`);
    }
  }

  return lines.join("\n");
}

export async function generateCoachSummary(params: {
  tradeDate: string;
  review: DailyReviewInput;
  commitment: CommitmentWithChildren | null;
  campaigns: DailyReportCampaign[];
}): Promise<{ text: string; error: null } | { text: null; error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      text: null,
      error: "ANTHROPIC_API_KEY ist nicht konfiguriert — KI-Fazit ist erst nach Einrichtung des API-Keys verfügbar.",
    };
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      // Plain text synthesis over already-structured data, not complex
      // reasoning — low effort keeps this fast (avoids Vercel serverless
      // function timeouts blowing up the request) without sacrificing
      // quality for a task this straightforward.
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildPrompt(params) }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text" || !textBlock.text.trim()) {
      return { text: null, error: "Keine Textantwort vom Modell erhalten." };
    }

    return { text: textBlock.text.trim(), error: null };
  } catch (e) {
    console.error("generateCoachSummary failed", e);
    if (e instanceof Anthropic.AuthenticationError) {
      return { text: null, error: "Ungültiger ANTHROPIC_API_KEY." };
    }
    if (e instanceof Anthropic.RateLimitError) {
      return { text: null, error: "Rate-Limit erreicht — bitte in Kürze erneut versuchen." };
    }
    const message = e instanceof Error ? e.message : "KI-Fazit konnte nicht generiert werden.";
    return { text: null, error: message };
  }
}

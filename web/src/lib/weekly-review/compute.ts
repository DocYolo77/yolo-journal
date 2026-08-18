// Pure aggregation math for the Weekly Review — no I/O (see fetch.ts for
// that), so this is unit-testable with fixture data. Every metric that
// needs data this app doesn't yet have (R-multiples — campaigns carry
// no stop price; shadow-model comparisons — shadow_model_results/
// committed_focus_audit are unpopulated tables) resolves to `null`
// ("nicht verfügbar") rather than a guess, per the spec's explicit
// instruction.

import { CANONICAL_GUARDRAILS } from "@/lib/validation/daily-review";
import { computeCampaignRealizedPnl } from "@/lib/campaigns/realized-pnl";
import type {
  CampaignRow,
  GuardrailEntry,
  WeeklyAggregation,
  WeeklyBalance,
  WeeklyBreakdownGroup,
  WeeklyCooldown,
  WeeklyDiagnosticCheck,
  WeeklyEnforcement,
  WeeklyEvidence,
  WeeklyEvidenceCampaign,
  WeeklyMissedMove,
  WeeklyPreconditions,
  WeeklySetupBreakdown,
  WeeklyShadowLog,
  WeeklyStateStat,
  WeeklySummary,
} from "@/lib/supabase/types";
import type { WeeklyRawData } from "./fetch";

function avg(values: number[]): number | null {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

type ClosedCampaignPnl = { campaign: CampaignRow; pnl: number };

function computeClosedCampaignPnls(raw: WeeklyRawData): ClosedCampaignPnl[] {
  return raw.campaigns
    .filter((c) => c.status === "closed")
    .map((c) => ({ campaign: c, pnl: computeCampaignRealizedPnl(raw.fillsByCampaignId.get(c.id) ?? []) }))
    .filter((c): c is ClosedCampaignPnl => c.pnl !== null);
}

function computeSummary(raw: WeeklyRawData): WeeklySummary {
  const startNlv = raw.previousAccountSnapshot?.net_liquidation_value ?? null;
  const endNlv =
    raw.accountSnapshotsInWeek.length > 0
      ? raw.accountSnapshotsInWeek[raw.accountSnapshotsInWeek.length - 1].net_liquidation_value
      : null;
  const nlvChangeDollar = startNlv != null && endNlv != null ? endNlv - startNlv : null;
  const nlvChangePct = nlvChangeDollar != null && startNlv ? (nlvChangeDollar / startNlv) * 100 : null;

  const closedPnls = computeClosedCampaignPnls(raw);
  const closedCount = raw.campaigns.filter((c) => c.status === "closed").length;
  const realizedPnlDollar = closedCount > 0 ? closedPnls.reduce((sum, c) => sum + c.pnl, 0) : null;

  const unrealizedChange =
    raw.positionsUnrealizedInWeek?.total_unrealized_pnl != null && raw.positionsUnrealizedBeforeWeek?.total_unrealized_pnl != null
      ? raw.positionsUnrealizedInWeek.total_unrealized_pnl - raw.positionsUnrealizedBeforeWeek.total_unrealized_pnl
      : null;

  const entryDayCount = raw.dailyReviews.filter((r) => r.review_type === "ENTRY").length;
  const managementOrZeroDayCount = raw.dailyReviews.filter((r) => r.review_type !== "ENTRY").length;

  const committedRiskValues = raw.lockedCommitments.map((c) => c.committed_risk_pct).filter((v): v is number => v != null);

  const sortedCommitments = [...raw.lockedCommitments].sort((a, b) => a.trade_date.localeCompare(b.trade_date));
  let losingStreakStart: string | null = null;
  let losingStreakEnd: string | null = null;
  for (const c of sortedCommitments) {
    if (!losingStreakStart && c.loss_state_reduced_size_mode) {
      losingStreakStart = c.trade_date;
      continue;
    }
    if (losingStreakStart && !losingStreakEnd && !c.loss_state_reduced_size_mode) {
      losingStreakEnd = c.trade_date;
    }
  }

  return {
    week_start: raw.weekStart,
    week_end: raw.weekEnd,
    start_nlv: startNlv,
    end_nlv: endNlv,
    nlv_change_dollar: nlvChangeDollar,
    nlv_change_pct: nlvChangePct,
    realized_pnl_dollar: realizedPnlDollar,
    unrealized_pnl_change_dollar: unrealizedChange,
    daily_review_count: raw.dailyReviews.length,
    entry_day_count: entryDayCount,
    management_or_zero_day_count: managementOrZeroDayCount,
    // Scope: campaigns whose trade_date (start day) falls in this week —
    // consistent for both counts, matches this app's same-day-campaign
    // methodology (campaigns rarely span a week boundary).
    new_campaign_count: raw.campaigns.length,
    closed_campaign_count: closedCount,
    actually_traded_ticker_count: new Set(raw.campaigns.map((c) => c.symbol)).size,
    execution_count: Array.from(raw.fillsByCampaignId.values()).reduce((sum, fills) => sum + fills.length, 0),
    avg_committed_risk_pct: avg(committedRiskValues),
    risk_mode_by_day: sortedCommitments.map((c) => ({
      trade_date: c.trade_date,
      committed_risk_pct: c.committed_risk_pct,
      reduced_size_mode: c.loss_state_reduced_size_mode,
    })),
    losing_streak_start: losingStreakStart,
    losing_streak_end: losingStreakEnd,
  };
}

function computePreconditions(raw: WeeklyRawData): WeeklyPreconditions {
  return {
    index_context: raw.indexContext,
    daily_market_environment: raw.dailyReviews.map((r) => ({
      trade_date: r.trade_date,
      market_environment: r.market_environment,
    })),
    committed_risk_by_day: raw.lockedCommitments.map((c) => ({
      trade_date: c.trade_date,
      committed_risk_pct: c.committed_risk_pct,
    })),
    mtd_status_by_day: raw.lockedCommitments.map((c) => ({
      trade_date: c.trade_date,
      mtd_pause_threshold_reached: c.mtd_pause_threshold_reached,
      mtd_manual_pct: c.mtd_manual_pct,
    })),
    reduced_size_days: raw.lockedCommitments.filter((c) => c.loss_state_reduced_size_mode).map((c) => c.trade_date),
    losing_streak_review_trigger_days: raw.lockedCommitments
      .filter((c) => c.loss_state_review_trigger_reached)
      .map((c) => c.trade_date),
  };
}

function computeBalance(raw: WeeklyRawData, closedPnls: ClosedCampaignPnl[]): WeeklyBalance {
  const pnls = closedPnls.map((c) => c.pnl);
  const winners = pnls.filter((p) => p > 0);
  const losers = pnls.filter((p) => p < 0);
  const winRatePct = winners.length + losers.length > 0 ? (winners.length / (winners.length + losers.length)) * 100 : null;
  const avgWinner = avg(winners);
  const avgLoser = avg(losers);
  const sumWinners = winners.reduce((a, b) => a + b, 0);
  const sumLosers = losers.reduce((a, b) => a + b, 0);

  return {
    nlv_series: raw.accountSnapshotsInWeek.map((s) => ({
      trading_date: s.trading_date,
      net_liquidation_value: s.net_liquidation_value,
    })),
    winner_count: pnls.length > 0 ? winners.length : null,
    loser_count: pnls.length > 0 ? losers.length : null,
    win_rate_pct: winRatePct,
    avg_winner_dollar: avgWinner,
    avg_loser_dollar: avgLoser,
    total_realized_dollar: pnls.length > 0 ? pnls.reduce((a, b) => a + b, 0) : null,
    profit_factor: losers.length > 0 && sumLosers !== 0 ? sumWinners / Math.abs(sumLosers) : null,
    payoff_ratio: avgWinner != null && avgLoser != null && avgLoser !== 0 ? avgWinner / Math.abs(avgLoser) : null,
    expectancy_dollar:
      winRatePct != null && avgWinner != null && avgLoser != null
        ? (winRatePct / 100) * avgWinner + (1 - winRatePct / 100) * avgLoser
        : null,
    max_winner_dollar: winners.length > 0 ? Math.max(...winners) : null,
    max_loser_dollar: losers.length > 0 ? Math.min(...losers) : null,
    r_multiples_available: false,
  };
}

function computeEnforcement(raw: WeeklyRawData): WeeklyEnforcement {
  const guardrails = CANONICAL_GUARDRAILS.map((canonical) => {
    let eingehalten = 0;
    let verletzt = 0;
    let nichtAnwendbar = 0;

    for (const review of raw.dailyReviews) {
      const entry = (review.guardrails as GuardrailEntry[]).find((g) => g.guardrail_id === canonical.id);
      if (!entry) continue;
      if (entry.status === "Eingehalten") eingehalten++;
      else if (entry.status === "Verletzt") verletzt++;
      else if (entry.status === "Nicht anwendbar") nichtAnwendbar++;
    }

    const relevant = eingehalten + verletzt;
    return {
      guardrail_id: canonical.id,
      guardrail: canonical.label,
      checked_count: eingehalten + verletzt + nichtAnwendbar,
      eingehalten_count: eingehalten,
      verletzt_count: verletzt,
      nicht_anwendbar_count: nichtAnwendbar,
      compliance_rate_pct: relevant > 0 ? (eingehalten / relevant) * 100 : null,
    };
  });

  return {
    guardrails,
    reviews_with_guardrails_confirmed: raw.dailyReviews.filter((r) => r.guardrails_reviewed).length,
    reviews_total: raw.dailyReviews.length,
  };
}

function tally(values: string[]): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

function computeEvidence(raw: WeeklyRawData, closedPnls: ClosedCampaignPnl[]): WeeklyEvidence {
  const asEvidence = (c: ClosedCampaignPnl): WeeklyEvidenceCampaign => ({
    campaign_id: c.campaign.id,
    symbol: c.campaign.symbol,
    trade_date: c.campaign.trade_date,
    direction: c.campaign.direction ?? "long",
    realized_pnl_dollar: c.pnl,
  });

  const sorted = [...closedPnls].sort((a, b) => b.pnl - a.pnl);
  const bestCampaigns = sorted.slice(0, 3).filter((c) => c.pnl > 0).map(asEvidence);
  const worstCampaigns = [...sorted]
    .reverse()
    .slice(0, 3)
    .filter((c) => c.pnl < 0)
    .map(asEvidence);

  const allTickerReviews = raw.dailyReviews.flatMap((r) => r.ticker_reviews);

  return {
    best_campaigns: bestCampaigns,
    worst_campaigns: worstCampaigns,
    management_grades: tally(allTickerReviews.map((t) => t.management_grade)),
    rule_statuses: tally(allTickerReviews.map((t) => t.rule_status)),
    setups: tally(allTickerReviews.map((t) => t.setup)),
    structures: tally(allTickerReviews.map((t) => t.structure)),
    entry_tactics: tally(allTickerReviews.map((t) => t.entry_tactic)),
  };
}

function computeShadowLog(raw: WeeklyRawData): WeeklyShadowLog {
  const committedSlots = raw.shadowlistDecisions.length;
  const primeDecisions = raw.shadowlistDecisions.filter((d) => d.list_type === "Prime");
  const genommen = raw.shadowlistDecisions.filter((d) => d.decision === "Genommen").length;
  const primeGenommen = primeDecisions.filter((d) => d.decision === "Genommen").length;

  return {
    committed_slots: committedSlots,
    prime_slots: primeDecisions.length,
    genommen,
    nicht_genommen: raw.shadowlistDecisions.filter((d) => d.decision === "Nicht genommen").length,
    take_rate_pct: committedSlots > 0 ? (genommen / committedSlots) * 100 : null,
    prime_take_rate_pct: primeDecisions.length > 0 ? (primeGenommen / primeDecisions.length) * 100 : null,
    actually_traded_tickers: Array.from(new Set(raw.campaigns.map((c) => c.symbol))).sort(),
    shadow_model_available: false,
  };
}

/**
 * Without a populated shadow model (modeled/MFE R), there's no
 * magnitude to rank "largest" by — returning a pick anyway would be a
 * guess dressed up as a metric, exactly what the spec forbids.
 */
function computeLargestMissedMove(): WeeklyMissedMove {
  return null;
}

type TickerDatePnlLookup = Map<string, { pnl: number; isWin: boolean }[]>;

function buildTickerDatePnlLookup(closedPnls: ClosedCampaignPnl[]): TickerDatePnlLookup {
  const lookup: TickerDatePnlLookup = new Map();
  for (const c of closedPnls) {
    const key = `${c.campaign.symbol}|${c.campaign.trade_date}`;
    if (!lookup.has(key)) lookup.set(key, []);
    lookup.get(key)!.push({ pnl: c.pnl, isWin: c.pnl > 0 });
  }
  return lookup;
}

function computeSetupBreakdown(raw: WeeklyRawData, lookup: TickerDatePnlLookup): WeeklySetupBreakdown {
  function groupBy(field: "setup" | "structure" | "entry_tactic"): WeeklyBreakdownGroup[] {
    const byValue = new Map<string, { pnls: number[] }>();
    for (const review of raw.dailyReviews) {
      for (const tr of review.ticker_reviews) {
        const value = tr[field];
        if (!value) continue;
        if (!byValue.has(value)) byValue.set(value, { pnls: [] });
        const matches = lookup.get(`${tr.ticker}|${review.trade_date}`) ?? [];
        byValue.get(value)!.pnls.push(...matches.map((m) => m.pnl));
      }
    }

    return Array.from(byValue.entries())
      .map(([value, { pnls }]) => {
        const wins = pnls.filter((p) => p > 0).length;
        return {
          value,
          count: pnls.length > 0 ? pnls.length : 0,
          win_rate_pct: pnls.length > 0 ? (wins / pnls.length) * 100 : null,
          avg_r: null,
          avg_dollar: avg(pnls),
          total_dollar: pnls.length > 0 ? pnls.reduce((a, b) => a + b, 0) : null,
        };
      })
      .sort((a, b) => b.count - a.count);
  }

  // Setup/Structure/Entry-Taktik counts should reflect how often each
  // was USED (ticker review rows), independent of whether a matching
  // closed campaign with computable P&L exists — recompute counts from
  // raw usage, keep the P&L-derived fields from groupBy's lookup pass.
  function withUsageCounts(field: "setup" | "structure" | "entry_tactic"): WeeklyBreakdownGroup[] {
    const usage = tally(raw.dailyReviews.flatMap((r) => r.ticker_reviews.map((t) => t[field])));
    const pnlGroups = new Map(groupBy(field).map((g) => [g.value, g]));
    return usage.map((u) => {
      const pnlGroup = pnlGroups.get(u.value);
      return {
        value: u.value,
        count: u.count,
        win_rate_pct: pnlGroup?.win_rate_pct ?? null,
        avg_r: null,
        avg_dollar: pnlGroup?.avg_dollar ?? null,
        total_dollar: pnlGroup?.total_dollar ?? null,
      };
    });
  }

  return {
    by_setup: withUsageCounts("setup"),
    by_structure: withUsageCounts("structure"),
    by_entry_tactic: withUsageCounts("entry_tactic"),
  };
}

function computeCooldown(raw: WeeklyRawData, closedPnls: ClosedCampaignPnl[]): WeeklyCooldown {
  const sorted = [...closedPnls].sort(
    (a, b) => (a.campaign.ended_at ?? "").localeCompare(b.campaign.ended_at ?? "")
  );

  const guardrailViolationsByDate = new Map<string, number>();
  for (const review of raw.dailyReviews) {
    const violations = (review.guardrails as GuardrailEntry[]).filter((g) => g.status === "Verletzt").length;
    guardrailViolationsByDate.set(review.trade_date, violations);
  }

  const afterWinner: { pnl: number; date: string }[] = [];
  const afterLoser: { pnl: number; date: string }[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev.pnl > 0) afterWinner.push({ pnl: curr.pnl, date: curr.campaign.trade_date });
    else if (prev.pnl < 0) afterLoser.push({ pnl: curr.pnl, date: curr.campaign.trade_date });
  }

  function groupStats(label: "after_winner" | "after_loser", entries: { pnl: number; date: string }[]) {
    const wins = entries.filter((e) => e.pnl > 0).length;
    const dates = new Set(entries.map((e) => e.date));
    const violations = Array.from(dates).reduce((sum, d) => sum + (guardrailViolationsByDate.get(d) ?? 0), 0);
    return {
      label,
      entry_count: entries.length,
      win_rate_pct: entries.length > 0 ? (wins / entries.length) * 100 : null,
      avg_dollar: avg(entries.map((e) => e.pnl)),
      guardrail_violation_count: violations,
    };
  }

  const available = afterWinner.length + afterLoser.length >= 2;

  return {
    groups: [groupStats("after_winner", afterWinner), groupStats("after_loser", afterLoser)],
    available,
    note: available ? null : "Nicht genug abgeschlossene Campaigns mit berechenbarem P&L diese Woche für einen Cooldown-Vergleich.",
  };
}

function computeDiagnostics(raw: WeeklyRawData, enforcement: WeeklyEnforcement, cooldown: WeeklyCooldown): WeeklyDiagnosticCheck[] {
  const checks: WeeklyDiagnosticCheck[] = [];
  const allTickerReviews = raw.dailyReviews.flatMap((r) => r.ticker_reviews);
  const guardrailByI = (id: string) => enforcement.guardrails.find((g) => g.guardrail_id === id);

  const shadowUnavailable = "Shadow-Modell (M5/M15/M30) noch nicht befüllt — kein MFE/modeled R für diesen Check verfügbar.";

  // --- Selection ---
  const primeTakeRate = computeShadowLog(raw).prime_take_rate_pct;
  checks.push({
    category: "selection",
    check_id: "low_prime_take_rate",
    label: "Niedrige Prime Take Rate",
    triggered: primeTakeRate != null ? primeTakeRate < 50 : null,
    detail: primeTakeRate != null ? `Prime Take Rate: ${primeTakeRate.toFixed(0)}%` : "Keine Prime-Slots diese Woche.",
  });

  const uebersehenCount = raw.shadowlistDecisions.filter((d) => d.reason === "Übersehen").length;
  checks.push({
    category: "selection",
    check_id: "frequent_uebersehen",
    label: `Häufige „Übersehen"-Entscheidungen`,
    triggered: uebersehenCount >= 2,
    detail: `${uebersehenCount} „Übersehen"-Entscheidung(en) diese Woche.`,
  });

  checks.push({
    category: "selection",
    check_id: "profitable_names_not_taken",
    label: "Profitable committed Namen nicht genommen",
    triggered: null,
    detail: shadowUnavailable,
  });

  // --- Execution ---
  const ruleIssueCount = allTickerReviews.filter((t) =>
    ["Organisatorischer Fehler", "Regelbruch"].includes(t.rule_status)
  ).length;
  checks.push({
    category: "execution",
    check_id: "repeated_rule_status_issues",
    label: "Wiederholte Rule-Status-Probleme",
    triggered: ruleIssueCount >= 2,
    detail: `${ruleIssueCount} Ticker-Review(s) mit Organisatorischer Fehler/Regelbruch.`,
  });

  const missingEntryTacticCount = allTickerReviews.filter((t) => t.setup && !t.entry_tactic).length;
  checks.push({
    category: "execution",
    check_id: "missing_entry_tactic",
    label: "Entries ohne erfasste Entry-Taktik",
    triggered: missingEntryTacticCount >= 1,
    detail: `${missingEntryTacticCount} Ticker-Review(s) ohne Entry-Taktik.`,
  });

  checks.push({
    category: "execution",
    check_id: "high_mae_early",
    label: "Hohe MAE kurz nach Entry",
    triggered: null,
    detail: shadowUnavailable,
  });

  // --- Management ---
  checks.push({
    category: "management",
    check_id: "high_mfe_worse_final_r",
    label: "Hohe MFE bei deutlich schlechterem final R",
    triggered: null,
    detail: shadowUnavailable,
  });

  const weakGradeCount = allTickerReviews.filter((t) => ["Schwach", "Fehlerhaft"].includes(t.management_grade)).length;
  checks.push({
    category: "management",
    check_id: "weak_management_grades_recurring",
    label: "Wiederkehrend schwache Management Grades",
    triggered: weakGradeCount >= 2,
    detail: `${weakGradeCount} Ticker-Review(s) mit Schwach/Fehlerhaft.`,
  });

  checks.push({
    category: "management",
    check_id: "adds_worsen_campaigns",
    label: "Adds verschlechtern Campaigns",
    triggered: null,
    detail: "Kein Stop pro Campaign hinterlegt — R-Vergleich vor/nach Add nicht berechenbar.",
  });

  // --- Risk ---
  const riskLimitGuardrail = guardrailByI("risk_limit");
  checks.push({
    category: "risk",
    check_id: "risk_limit_violated",
    label: "Risk Limit verletzt",
    triggered: riskLimitGuardrail ? riskLimitGuardrail.verletzt_count >= 1 : null,
    detail: riskLimitGuardrail ? `${riskLimitGuardrail.verletzt_count} Verstoß/Verstöße.` : "Keine Guardrail-Daten.",
  });

  const lossStreakGuardrail = guardrailByI("loss_streak_reduction");
  checks.push({
    category: "risk",
    check_id: "loss_streak_reduction_not_followed",
    label: "Losing-Streak Reduction nicht eingehalten",
    triggered: lossStreakGuardrail ? lossStreakGuardrail.verletzt_count >= 1 : null,
    detail: lossStreakGuardrail ? `${lossStreakGuardrail.verletzt_count} Verstoß/Verstöße.` : "Keine Guardrail-Daten.",
  });

  const afterWinnerGroup = cooldown.groups.find((g) => g.label === "after_winner");
  const afterLoserGroup = cooldown.groups.find((g) => g.label === "after_loser");
  checks.push({
    category: "risk",
    check_id: "activity_increases_after_winners",
    label: "Aktivität steigt nach Gewinnern",
    triggered:
      cooldown.available && afterWinnerGroup && afterLoserGroup
        ? afterWinnerGroup.entry_count > afterLoserGroup.entry_count * 1.5
        : null,
    detail: cooldown.available
      ? `Entries nach Gewinner: ${afterWinnerGroup?.entry_count ?? 0} · nach Verlierer: ${afterLoserGroup?.entry_count ?? 0}`
      : "Nicht genug Cooldown-Daten diese Woche.",
  });

  const reducedSizeDates = new Set(raw.lockedCommitments.filter((c) => c.loss_state_reduced_size_mode).map((c) => c.trade_date));
  const entriesDespiteDefensive = raw.campaigns.filter((c) => reducedSizeDates.has(c.trade_date)).length;
  checks.push({
    category: "risk",
    check_id: "entries_despite_defensive_risk_mode",
    label: "Entries trotz defensivem Risk-Modus",
    triggered: entriesDespiteDefensive >= 1,
    detail: `${entriesDespiteDefensive} neue Campaign(s) an Tagen mit Reduced-Size-Modus.`,
  });

  return checks;
}

function computeStateAnalysis(raw: WeeklyRawData, lookup: TickerDatePnlLookup): WeeklyStateStat[] {
  const states = new Set<string>();
  for (const r of raw.dailyReviews) {
    for (const s of r.mental.states) states.add(s);
  }

  const guardrailViolationsByDate = new Map<string, number>();
  for (const review of raw.dailyReviews) {
    guardrailViolationsByDate.set(
      review.trade_date,
      (review.guardrails as GuardrailEntry[]).filter((g) => g.status === "Verletzt").length
    );
  }

  return Array.from(states)
    .map((state) => {
      const daysWithState = raw.dailyReviews.filter((r) => r.mental.states.includes(state));
      const dates = new Set(daysWithState.map((d) => d.trade_date));
      const campaignsOnDays = raw.campaigns.filter((c) => dates.has(c.trade_date));
      const pnls = campaignsOnDays.flatMap((c) => lookup.get(`${c.symbol}|${c.trade_date}`)?.map((m) => m.pnl) ?? []);
      const wins = pnls.filter((p) => p > 0).length;
      const focusValues = daysWithState.map((d) => d.mental.focus).filter((f): f is number => f != null);
      const violations = Array.from(dates).reduce((sum, d) => sum + (guardrailViolationsByDate.get(d) ?? 0), 0);

      return {
        state,
        day_count: daysWithState.length,
        campaign_count: campaignsOnDays.length,
        avg_dollar: avg(pnls),
        win_rate_pct: pnls.length > 0 ? (wins / pnls.length) * 100 : null,
        guardrail_violation_count: violations,
        avg_focus: avg(focusValues),
      };
    })
    .sort((a, b) => b.day_count - a.day_count);
}

export function computeWeeklyAggregation(raw: WeeklyRawData): WeeklyAggregation {
  const closedPnls = computeClosedCampaignPnls(raw);
  const lookup = buildTickerDatePnlLookup(closedPnls);
  const enforcement = computeEnforcement(raw);
  const cooldown = computeCooldown(raw, closedPnls);

  return {
    summary: computeSummary(raw),
    preconditions: computePreconditions(raw),
    balance: computeBalance(raw, closedPnls),
    enforcement,
    evidence: computeEvidence(raw, closedPnls),
    shadow_log: computeShadowLog(raw),
    largest_missed_move: computeLargestMissedMove(),
    setup_breakdown: computeSetupBreakdown(raw, lookup),
    cooldown,
    diagnostics: computeDiagnostics(raw, enforcement, cooldown),
    repetition: { problem_loops: [], recurring_positives: [] }, // filled in by repetition.ts (needs prior FINAL weeks, separate query)
    state_analysis: computeStateAnalysis(raw, lookup),
  };
}

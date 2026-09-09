// Hand-written types matching supabase/migrations/*.sql.
// No codegen/ORM is used (per project rules) — keep this in sync manually
// whenever a migration changes these tables.
//
// Covers the Journal OS V7.4.3 web-migration schema
// (20260813171824_create_journal_os_commitment_schema.sql,
// 20260813174339_create_shadowlist_decisions.sql) only. The earlier
// generic-trading-journal tables (accounts, strategies, trades,
// executions, trade_metrics, tags, trade_tags, journal_days, attachments)
// still exist in the database but are no longer used by this app, so no
// types are defined for them here.

// WatchlistType, CommitmentRow and its child-table types, LoserRiskStateRow
// and AuditEventRow described tables that either no longer exist
// (commitment_watchlist_items/ep_candidates/risk_changes/overrides,
// audit_events — dropped in 20260908000000_v2_capture_tool_rewrite.sql)
// or were never used by any shipped code. `commitments` itself still
// exists (kept for Weekly Review) but nothing types it anymore — Weekly
// Review's fetch.ts selects specific columns off it untyped, same
// established pattern as the other broker/campaign tables it reads raw.
export type WatchlistType = "Prime" | "Watchlist" | "Secondary";

// Renamed from ShadowlistDecisionRow when the v2 rewrite repurposed
// that clean name for the simplified capture-tool shape below —
// describes the shadowlist_decisions_legacy table (renamed from
// shadowlist_decisions, same shape/data), kept for Weekly Review only.
export type ShadowlistDecisionLegacyRow = {
  id: string;
  user_id: string | null;
  commitment_id: string;
  trade_date: string;
  ticker: string;
  list_type: WatchlistType;
  actually_traded: boolean;
  decision: "Genommen" | "Nicht genommen";
  reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// Note: there is no longer a separate v2 shadowlist_decisions table —
// 20260908010000_v2_drop_redundant_shadowlist_table.sql corrected an
// initial mistake. Per the spec, the Shadowlist screen is a dedicated
// view/editor directly over DailyReviewWatchlistRow (scope='today')
// rows, since that table already carries `taken`/`note`.

// 20260813200000_create_daily_reviews.sql

export type GuardrailStatus = "Eingehalten" | "Verletzt" | "Nicht anwendbar";

export type GuardrailEntry = {
  guardrail_id: string;
  guardrail: string;
  status: GuardrailStatus | "";
  comment: string;
};

export type MentalStatus = {
  states: string[];
  other_state: string;
  focus: number | null;
  influence_note: string;
};

export type TickerReview = {
  ticker: string;
  setup: string;
  entry_tactic: string;
  stop_placement: string;
  stop_placement_pct: number | null;
  structure: string;
  structure_rating: string;
  // Combined 2026-08: the editor now shows Thesis and D0-Outcome as one
  // box — `thesis` holds that combined text going forward. `notes` stays
  // in the type/normalizer for historical rows only (no longer editable).
  thesis: string;
  qullamaggie_rating: string;
  management_grade: string;
  rule_status: string;
  notes: string;
  exit_setup: string;
  exit_tactic: string;
};

export type DailyReviewStatus = "DRAFT" | "COMPLETED";
export type DailyReviewType = "ENTRY" | "MANAGEMENT";

/**
 * Same shape as lib/data/portfolio.ts's PortfolioPosition (the
 * broker_positions_snapshots read model) — defined separately here since
 * supabase/types.ts is the canonical hand-written schema mirror and the
 * data layer imports from it, not the other way around. Structurally
 * identical, so values flow between the two without casts.
 */
export type ManualPortfolioPosition = {
  symbol: string;
  quantity: number;
  average_price: number | null;
  market_price: number | null;
  unrealized_pnl: number | null;
  currency: string | null;
};

// Renamed from DailyReviewRow when the v2 rewrite repurposed that clean
// name for the new capture-tool schema (see below) — this describes the
// daily_reviews_legacy table (renamed from daily_reviews, same shape,
// same data), kept only because lib/weekly-review/{fetch,compute}.ts
// still read the pre-v2 shape directly and Weekly/Monthly are
// deliberately out of scope for the v2 rewrite.
export type DailyReviewLegacyRow = {
  id: string;
  user_id: string | null;

  trade_date: string;
  review_type: DailyReviewType | null;
  status: DailyReviewStatus;

  is_reconstructed: boolean;
  commitment_id: string | null;

  net_liquidation_value: number | null;
  daily_pnl: number | null;

  market_thought: string | null;
  market_environment: string | null;
  /** "Portfolio / Neue Positionen" — commentary on the portfolio, partials, stops. */
  portfolio_comment: string | null;
  /**
   * Manual override for the Portfolio position table when the automatic
   * IBKR sync doesn't reflect the real portfolio correctly. Empty by
   * default — the auto-synced broker_positions_snapshots data is shown
   * unless the user has explicitly entered rows here.
   */
  manual_portfolio_positions: ManualPortfolioPosition[];

  guardrails: GuardrailEntry[];
  guardrails_reviewed: boolean;
  mental: MentalStatus;

  positive: string | null;
  weakness: string | null;
  coaching_take: string | null;
  self_grade: string | null;
  grade_reason: string | null;
  operational_todos: string[];
  shadowlist_comment: string | null;

  ticker_reviews: TickerReview[];

  created_at: string;
  updated_at: string;
};

// 20260908000000_v2_capture_tool_rewrite.sql — the new capture-tool
// Daily Review. One row per trade_date, always editable, every field
// but trade_date optional. See CLAUDE.md for the product rationale.

export type DailyReviewRow = {
  id: string;
  user_id: string | null;

  trade_date: string;

  risk_pct: number | null;
  r_value_usd: number | null;
  /** Optional — the value now gets pulled live from the broker in the LLM chat instead of being hand-typed here. */
  nlv_close: number | null;
  self_grade: string | null;

  market_context: string | null;
  personal_state: string | null;
  /** Half-steps are a real input (3.5 has occurred). */
  focus_level: number | null;

  what_went_well: string | null;
  what_went_wrong: string | null;
  what_to_improve: string | null;
  guardrails_note: string | null;

  /**
   * Renamed from next_session_plan in 20260909000000 — v2.1 moves this
   * block from position 6 (describing tomorrow's session) to position
   * 2 (describing *today's* session, filled in the morning). The old
   * `gameplan` column still exists in the DB (the v2.1 spec's schema
   * section didn't call for dropping it, only for this rename) but
   * nothing in the app reads or writes it anymore — its content is
   * folded into this field instead.
   */
  session_plan: string | null;
  /** Pre-declared condition for taking more than standard risk *today* (was "tomorrow" pre-v2.1) — written before the fact, not justified after. */
  opportunity_spike: string | null;

  created_at: string;
  updated_at: string;
};

export type DailyReviewWatchlistRow = {
  id: string;
  user_id: string | null;
  review_id: string;

  /** No more today/next split as of 20260909000000 — one list per day. */
  ticker: string;
  sort_order: number;
  taken: boolean;
  note: string | null;

  created_at: string;
  updated_at: string;
};

// "Ticker-Karten" — one card per ticker touched today, entry and/or
// management of an existing position (never a separate card type for
// each), see CLAUDE.md.
export type DailyReviewTradeRow = {
  id: string;
  user_id: string | null;
  review_id: string;

  sort_order: number;
  ticker: string;
  setup: string | null;
  trigger_tactic: string | null;
  stop_logic: string | null;
  what_happened: string | null;
  /** "Management heute" — stop nachgezogen, Partial, Add, Exit. */
  management: string | null;
  /** "Stop jetzt" — change-only: empty means "unverändert", not "kein Stop". */
  stop_now: string | null;
  my_thinking: string | null;

  created_at: string;
  updated_at: string;
};

export type DailyReviewGuardrailStatus = "held" | "broken" | "na" | "override";

export type DailyReviewGuardrailRow = {
  id: string;
  user_id: string | null;
  review_id: string;

  guardrail_key: string;
  status: DailyReviewGuardrailStatus;
  note: string | null;

  created_at: string;
  updated_at: string;
};

// 20260813180619_create_market_data_and_broker_schema.sql (campaigns —
// no typed row existed before; broker_executions/broker_account_
// snapshots/broker_positions_snapshots are still queried untyped
// elsewhere in this app, same established pattern, only campaigns gets
// a type here since Weekly Review depends on its shape directly.)

export type CampaignDirection = "long" | "short";
export type CampaignStatus = "open" | "closed";
export type CampaignSource = "reconstructed" | "prior_position_unresolved" | "manual";

export type CampaignRow = {
  id: string;
  user_id: string | null;
  trade_date: string;
  symbol: string;
  direction: CampaignDirection | null;
  started_at: string | null;
  ended_at: string | null;
  status: CampaignStatus;
  initial_entry: number | null;
  entry_strategy: string | null;
  intended_trigger: string | null;
  initial_stop: number | null;
  current_stop: number | null;
  notes: string | null;
  source: CampaignSource;
  created_at: string;
  updated_at: string;
};

// 20260814020000_create_daily_report_snapshots.sql

export type ChartSeriesPoint = {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ema10: number | null;
  ema20: number | null;
  sma50: number | null;
  sma100: number | null;
  sma200: number | null;
};

export type IntradayBarPoint = {
  timestamp: string; // ISO instant
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

// Architecture for future real IBKR entry/add/partial-exit/exit
// classification — currently derived heuristically from running position
// size (see getMarkersForTicker in lib/data/report-snapshot.ts) since no
// IBKR Flex Web Service sync exists yet to supply this directly.
export type ChartMarkerEventType = "ENTRY" | "ADD" | "PARTIAL_EXIT" | "EXIT";

export type ChartMarker = {
  timestamp: string;
  side: "BUY" | "SELL";
  price: number;
  label: string;
  event_type: ChartMarkerEventType;
};

export type OrbLevel = {
  orb_minutes: 5 | 15 | 30;
  orh: number;
  orl: number;
};

export type TickerChartData = {
  ticker: string;
  daily: ChartSeriesPoint[];
  intraday: IntradayBarPoint[];
  /**
   * Real prior-session RTH bars strictly before this report's trade_date
   * — invisible on the chart, used only to seed MACD's EMA(20)/EMA(9)
   * so the indicator isn't null/flat for the first ~2h20m after 09:30.
   * Optional: reports finalized before this field existed have none in
   * their immutable stored snapshot.
   */
  intraday_warmup?: IntradayBarPoint[];
  markers: ChartMarker[];
  orb_levels: OrbLevel[];
};

// DailyReportSnapshotData/Row and its ReportMarketData/BrokerAccount
// SnapshotSummary/DailyReportCampaign*/DailyReportPortfolio* satellites
// described the old daily_report_snapshots-backed finalized-report
// system (app/reports/daily/*, lib/data/report-snapshot.ts,
// lib/reports/pdf-document.tsx) — all deleted in the v2 rewrite (§1.4:
// "Ein Daily Review ist jederzeit editierbar. Das PDF ist der
// Snapshot."). The daily_report_snapshots table itself is untouched in
// the DB (Weekly Review's getSourceDailyReportIds still reads its
// `id`/`trade_date` columns untyped), but nothing needs its full row
// shape anymore.

// 20260814040000_create_weekly_reviews.sql

export type WeeklyReviewStatus = "DRAFT" | "FINAL";
export type ProcessGrade = "A" | "B" | "C" | "D" | "F";

export type WeeklyReviewRow = {
  id: string;
  user_id: string | null;
  week_start: string;
  week_end: string;
  status: WeeklyReviewStatus;
  preconditions_note: string | null;
  worked: string | null;
  not_worked: string | null;
  largest_missed_move_comment: string | null;
  continue_doing: string | null;
  improve: string | null;
  eliminate: string | null;
  next_week_changes: string | null;
  process_grade: ProcessGrade | null;
  process_grade_reason: string | null;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
};

// Weekly Review aggregation — computed live (lib/weekly-review/aggregate.ts)
// from daily_reviews/commitments/shadowlist_decisions/campaigns/broker_*
// for a Monday-Friday trading week, then frozen verbatim into
// weekly_report_snapshots.snapshot at finalization. `null` throughout
// means "nicht verfügbar" (data foundation missing), never a guessed
// value — e.g. every R-multiple field is null in V1 since campaigns
// carry no stop price yet and the shadow-model tables are unpopulated.

export type WeeklySummary = {
  week_start: string;
  week_end: string;
  start_nlv: number | null;
  end_nlv: number | null;
  nlv_change_dollar: number | null;
  nlv_change_pct: number | null;
  realized_pnl_dollar: number | null;
  unrealized_pnl_change_dollar: number | null;
  daily_review_count: number;
  entry_day_count: number;
  management_or_zero_day_count: number;
  new_campaign_count: number;
  closed_campaign_count: number;
  actually_traded_ticker_count: number;
  execution_count: number;
  avg_committed_risk_pct: number | null;
  risk_mode_by_day: { trade_date: string; committed_risk_pct: number | null; reduced_size_mode: boolean }[];
  losing_streak_start: string | null;
  losing_streak_end: string | null;
};

export type WeeklyPreconditions = {
  index_context: { ticker: "QQQ" | "SPY"; daily: ChartSeriesPoint[] }[];
  daily_market_environment: { trade_date: string; market_environment: string | null }[];
  committed_risk_by_day: { trade_date: string; committed_risk_pct: number | null }[];
  mtd_status_by_day: { trade_date: string; mtd_pause_threshold_reached: boolean; mtd_manual_pct: number | null }[];
  reduced_size_days: string[];
  losing_streak_review_trigger_days: string[];
};

export type WeeklyBalance = {
  nlv_series: { trading_date: string; net_liquidation_value: number | null }[];
  winner_count: number | null;
  loser_count: number | null;
  win_rate_pct: number | null;
  avg_winner_dollar: number | null;
  avg_loser_dollar: number | null;
  total_realized_dollar: number | null;
  profit_factor: number | null;
  payoff_ratio: number | null;
  expectancy_dollar: number | null;
  max_winner_dollar: number | null;
  max_loser_dollar: number | null;
  r_multiples_available: boolean;
};

export type WeeklyGuardrailStat = {
  guardrail_id: string;
  guardrail: string;
  checked_count: number;
  eingehalten_count: number;
  verletzt_count: number;
  nicht_anwendbar_count: number;
  compliance_rate_pct: number | null;
};

export type WeeklyEnforcement = {
  guardrails: WeeklyGuardrailStat[];
  reviews_with_guardrails_confirmed: number;
  reviews_total: number;
};

export type WeeklyEvidenceCampaign = {
  campaign_id: string;
  symbol: string;
  trade_date: string;
  direction: "long" | "short";
  realized_pnl_dollar: number | null;
};

export type WeeklyEvidence = {
  best_campaigns: WeeklyEvidenceCampaign[];
  worst_campaigns: WeeklyEvidenceCampaign[];
  management_grades: { value: string; count: number }[];
  rule_statuses: { value: string; count: number }[];
  setups: { value: string; count: number }[];
  structures: { value: string; count: number }[];
  entry_tactics: { value: string; count: number }[];
};

export type WeeklyShadowLog = {
  committed_slots: number;
  prime_slots: number;
  genommen: number;
  nicht_genommen: number;
  take_rate_pct: number | null;
  prime_take_rate_pct: number | null;
  actually_traded_tickers: string[];
  shadow_model_available: boolean;
};

export type WeeklyMissedMove = {
  ticker: string;
  list_type: WatchlistType;
  decision: string;
  reason: string | null;
  trade_date: string;
} | null;

export type WeeklyBreakdownGroup = {
  value: string;
  count: number;
  win_rate_pct: number | null;
  avg_r: null;
  avg_dollar: number | null;
  total_dollar: number | null;
};

export type WeeklySetupBreakdown = {
  by_setup: WeeklyBreakdownGroup[];
  by_structure: WeeklyBreakdownGroup[];
  by_entry_tactic: WeeklyBreakdownGroup[];
};

export type WeeklyCooldownGroup = {
  label: "after_winner" | "after_loser";
  entry_count: number;
  win_rate_pct: number | null;
  avg_dollar: number | null;
  guardrail_violation_count: number;
};

export type WeeklyCooldown = {
  groups: WeeklyCooldownGroup[];
  available: boolean;
  note: string | null;
};

export type WeeklyDiagnosticCheck = {
  category: "selection" | "execution" | "management" | "risk";
  check_id: string;
  label: string;
  /** null = nicht verfügbar (data foundation missing), never guessed. */
  triggered: boolean | null;
  detail: string;
};

export type WeeklyProblemLoop = {
  label: string;
  weeks_seen: number;
  weeks_checked: number;
};

export type WeeklyRepetition = {
  problem_loops: WeeklyProblemLoop[];
  recurring_positives: WeeklyProblemLoop[];
};

export type WeeklyStateStat = {
  state: string;
  day_count: number;
  campaign_count: number;
  avg_dollar: number | null;
  win_rate_pct: number | null;
  guardrail_violation_count: number;
  avg_focus: number | null;
};

export type WeeklyAggregation = {
  summary: WeeklySummary;
  preconditions: WeeklyPreconditions;
  balance: WeeklyBalance;
  enforcement: WeeklyEnforcement;
  evidence: WeeklyEvidence;
  shadow_log: WeeklyShadowLog;
  largest_missed_move: WeeklyMissedMove;
  setup_breakdown: WeeklySetupBreakdown;
  cooldown: WeeklyCooldown;
  diagnostics: WeeklyDiagnosticCheck[];
  repetition: WeeklyRepetition;
  state_analysis: WeeklyStateStat[];
};

export type WeeklyReportSnapshotData = {
  report_schema_version: 1;
  week_start: string;
  week_end: string;
  created_at: string;
  source_daily_report_ids: string[];
  aggregation: WeeklyAggregation;
  manual: {
    preconditions_note: string | null;
    worked: string | null;
    not_worked: string | null;
    largest_missed_move_comment: string | null;
    continue_doing: string | null;
    improve: string | null;
    eliminate: string | null;
    next_week_changes: string | null;
    process_grade: ProcessGrade | null;
    process_grade_reason: string | null;
  };
};

// 20260824000000_create_lessons_learned_entries.sql

export type LessonsLearnedKind = "lesson" | "quote" | "deep_dive";

export type LessonsLearnedEntryRow = {
  id: string;
  user_id: string | null;
  kind: LessonsLearnedKind;
  /** Deep Dives only — the collapsed-state title. Null for lesson/quote. */
  title: string | null;
  /** lesson/quote: the short text itself. deep_dive: the long expanded body. */
  content: string;
  /** Deep Dives only — optional link to the original tweet/video/article. */
  source_url: string | null;
  /** Free up/down reordering, scoped per kind. */
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type WeeklyReportSnapshotRow = {
  id: string;
  user_id: string | null;
  weekly_review_id: string;
  week_start: string;
  week_end: string;
  report_schema_version: number;
  source_daily_report_ids: string[];
  snapshot: WeeklyReportSnapshotData;
  created_at: string;
};

// 20260826000000_create_crypto_journal.sql — deliberately separate,
// much lighter Crypto journal (see that migration's header comment).

export type CryptoDirection = "LONG" | "SHORT";
export type CryptoProduct = "SPOT" | "PERP";
export type CryptoTradeStatus = "OPEN" | "CLOSED";

export type CryptoTradeRow = {
  id: string;
  user_id: string | null;

  trade_date: string;
  coin: string;
  direction: CryptoDirection;
  product: CryptoProduct;

  risk_usd: number | null;
  risk_pct: number | null;
  result_usd: number | null;
  result_r: number | null;

  /** TradingView chart link, pasted by hand — not an uploaded screenshot. */
  entry_tradingview_url: string | null;
  after_tradingview_url: string | null;

  thesis: string | null;
  management: string | null;

  review_good: string | null;
  review_bad: string | null;
  review_better: string | null;
  lesson: string | null;

  status: CryptoTradeStatus;
  closed_at: string | null;

  created_at: string;
  updated_at: string;
};

export type CryptoLearningRow = {
  id: string;
  user_id: string | null;

  trade_id: string | null;
  lesson: string;

  /** Denormalized from the origin trade at creation time — survives that trade being deleted. */
  trade_date: string | null;
  coin: string | null;

  tags: string[];
  sort_order: number;

  created_at: string;
  updated_at: string;
};

export type CryptoWeeklyReviewRow = {
  id: string;
  user_id: string | null;

  week_start: string;
  week_end: string;

  good: string | null;
  bad: string | null;
  learned: string | null;
  focus_next_week: string | null;

  created_at: string;
  updated_at: string;
};

// Note: 20260829000000_create_ibkr_import_raw.sql's ibkr_import_raw
// table was never applied to the live database and its whole feature
// (manual IBKR JSON import) is deleted in the v2 rewrite — no type
// needed here.

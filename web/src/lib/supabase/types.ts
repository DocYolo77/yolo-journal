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

export type CommitmentStatus = "DRAFT" | "LOCKED";
export type WatchlistType = "Prime" | "Watchlist" | "Secondary";

export type CommitmentRow = {
  id: string;
  user_id: string | null;

  schema_version: number;
  trade_date: string;
  revision: number;
  status: CommitmentStatus;

  market_snapshot: Record<string, unknown> | null;

  personal_state: string | null;
  market_state_note: string | null;
  system_risk_pct: number | null;
  committed_risk_pct: number | null;
  intraday_risk_pct: number | null;

  qqq_extension_atr_multiple: number | null;
  qqq_extension_cap_active: boolean;
  qqq_extension_note: string | null;
  // 20260814000000_add_spy_extension_to_commitments.sql
  spy_extension_atr_multiple: number | null;

  mtd_manual_pct: number | null;
  mtd_auto_fresh_entry_realized_pct: number | null;
  mtd_pause_threshold_reached: boolean;
  mtd_note: string | null;

  loss_state_manual_counter: number | null;
  loss_state_auto_counter: number | null;
  loss_state_review_trigger_reached: boolean;
  loss_state_reduced_size_mode: boolean;
  loss_state_note: string | null;

  operational_plan: string | null;
  improvement_focus: string | null;

  max_tickers: number;
  source_lock: boolean;
  intraday_hand_adds: number;

  created_at: string;
  updated_at: string;
  locked_at: string | null;
};

export type CommitmentWatchlistItemRow = {
  id: string;
  user_id: string | null;
  commitment_id: string;
  ticker: string;
  risk_pct: number | null;
  list_type: WatchlistType;
  notes: string | null;
  sort_order: number;
  created_at: string;
};

export type CommitmentEpCandidateRow = {
  id: string;
  user_id: string | null;
  commitment_id: string;
  ticker: string;
  gap_8_pct: boolean;
  rvol_1_5: boolean;
  news_trigger: boolean;
  event_day: boolean;
  context_not_defensive: boolean;
  notes: string | null;
  created_at: string;
};

export type CommitmentRiskChangeRow = {
  id: string;
  user_id: string | null;
  commitment_id: string;
  changed_at: string;
  old_risk_pct: number;
  new_risk_pct: number;
  reason: string | null;
  created_at: string;
};

export type CommitmentOverrideRow = {
  id: string;
  user_id: string | null;
  commitment_id: string;
  occurred_at: string;
  override_type: string;
  description: string;
  created_at: string;
};

export type LoserRiskStateRow = {
  id: string;
  user_id: string | null;
  as_of: string;
  loser_count: number;
  reduced_size_mode: boolean;
  source: string | null;
  updated_at: string;
  created_at: string;
};

export type AuditEventRow = {
  event_id: string;
  user_id: string | null;
  seq: number;
  schema_version: number;
  event_time: string;
  event_type: string;
  trade_date: string | null;
  entity_type: string;
  entity_id: string | null;
  actor: string | null;
  payload: Record<string, unknown> | null;
  previous_hash: string | null;
  hash: string;
  created_at: string;
};

export type ShadowlistDecisionRow = {
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

export type DailyReviewRow = {
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

export type ReportMarketData = {
  index_context: { ticker: "QQQ" | "SPY"; daily: ChartSeriesPoint[] }[];
  tickers: TickerChartData[];
  fetch_error: string | null;
};

export type BrokerAccountSnapshotSummary = {
  net_liquidation_value: number | null;
  cash: number | null;
  buying_power: number | null;
  gross_exposure_pct: number | null;
  captured_at: string;
  /**
   * The snapshot's real trading_date — may differ from the report's
   * trade_date when IBKR's own EOD batch hadn't finished processing the
   * requested day yet at sync time (see getDailyPnlSnapshotForDate).
   * Always label a mismatch honestly instead of implying same-day data.
   */
  trading_date: string | null;
};

export type DailyReportCampaignFill = {
  side: "BUY" | "SELL";
  price: number | null;
  quantity: number;
  executed_at: string;
};

/** One of today's economic campaigns (see campaigns table) — real IBKR fills, not raw clicks. */
export type DailyReportCampaign = {
  id: string;
  symbol: string;
  direction: string | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  realized_pnl: number | null;
  fills: DailyReportCampaignFill[];
};

export type DailyReportPortfolioPosition = {
  symbol: string;
  quantity: number;
  average_price: number | null;
  market_price: number | null;
  unrealized_pnl: number | null;
  currency: string | null;
};

export type DailyReportPortfolioSnapshot = {
  captured_at: string | null;
  positions: DailyReportPortfolioPosition[];
  /**
   * "manual" when the user's manual_portfolio_positions override was
   * non-empty at finalization time (IBKR sync doesn't always reflect the
   * real portfolio correctly) — always label which one the report/PDF is
   * actually showing instead of silently implying it's the IBKR sync.
   */
  source: "ibkr_sync" | "manual";
};

export type DailyReportSnapshotData = {
  report_schema_version: 1;
  trade_date: string;
  created_at: string;
  review: DailyReviewRow;
  commitment:
    | (CommitmentRow & {
        watchlist: CommitmentWatchlistItemRow[];
        ep_candidates: CommitmentEpCandidateRow[];
      })
    | null;
  shadowlist: ShadowlistDecisionRow[];
  broker_account_snapshot: BrokerAccountSnapshotSummary | null;
  market_data: ReportMarketData;
  /**
   * Today's economic campaigns with real entry/add/exit fills (price,
   * time, quantity) — sourced from campaigns/campaign_executions/
   * broker_executions. Optional because reports finalized before this
   * field existed have no such data in their immutable stored snapshot;
   * always fall back to [] rather than fail rendering old reports.
   */
  campaigns?: DailyReportCampaign[];
  /**
   * The full IBKR portfolio snapshot nearest this trade_date — covers
   * both same-day campaign positions and older carried positions (the
   * legacy "old positions separated from same-day campaigns" rule).
   * Optional for the same reason as `campaigns` above.
   */
  portfolio_snapshot?: DailyReportPortfolioSnapshot;
};

export type DailyReportSnapshotRow = {
  id: string;
  user_id: string | null;
  trade_date: string;
  report_schema_version: number;
  snapshot: DailyReportSnapshotData;
  pdf_storage_path: string | null;
  pdf_generated_at: string | null;
  created_at: string;
};

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

  /** Storage path in the "crypto-screenshots" bucket, not a URL — a signed URL is generated at render time. */
  entry_screenshot_path: string | null;
  after_screenshot_path: string | null;

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

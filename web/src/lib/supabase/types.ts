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
  thesis: string;
  management_grade: string;
  rule_status: string;
  notes: string;
  exit_setup: string;
  exit_tactic: string;
};

export type DailyReviewStatus = "DRAFT" | "COMPLETED";
export type DailyReviewType = "ENTRY" | "MANAGEMENT";

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

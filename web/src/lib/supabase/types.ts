// Hand-written types matching supabase/migrations/*.sql.
// No codegen/ORM is used (per project rules) — keep this in sync manually
// whenever a migration changes these tables.
//
// Covers the Journal OS V7.4.3 web-migration schema
// (20260813171824_create_journal_os_commitment_schema.sql) only. The
// earlier generic-trading-journal tables (accounts, strategies, trades,
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

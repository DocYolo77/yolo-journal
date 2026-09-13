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

// 20260913000000_weekly_review_v2_rewrite.sql — Weekly Review v2, same
// pure-capture philosophy as the Daily Review: no computed metrics, no
// guardrail evaluation, no shadow log, no finalize/snapshot lock. See
// CLAUDE.md's "Weekly Review v2" section for the product rationale.

export type WeeklyRegime = "Strong Uptrend" | "Uptrend" | "Choppy/Mixed" | "Downtrend" | "Strong Downtrend";
export type WeeklySelfGrade = "1" | "2" | "3" | "4" | "5" | "6";

export type WeeklyReviewRow = {
  id: string;
  user_id: string | null;

  iso_year: number;
  iso_week: number;
  week_start: string;
  week_end: string;

  brueche: string | null;

  regime: WeeklyRegime | null;
  bias_flip: boolean | null;
  bias_flip_text: string | null;
  leadership: string | null;
  satz_der_woche: string | null;

  mental_tags: string[];
  fokus: number | null;
  mental_text: string | null;

  staerkste_namen: string | null;
  gehandelt: string | null;
  nicht_gehandelt: string | null;
  verpasst: string | null;
  guter_skip: string | null;

  gemeinsame_eigenschaften: string | null;

  worst_trade_ticker: string | null;
  worst_trade_text: string | null;
  wiederholung: boolean | null;
  wiederholung_text: string | null;

  good_trade_ticker: string | null;
  good_trade_text: string | null;

  rolle_stockpicker_ja_nein: boolean | null;
  rolle_stockpicker_text: string | null;
  rolle_allocator_ja_nein: boolean | null;
  rolle_allocator_text: string | null;
  rolle_operator_ja_nein: boolean | null;
  rolle_operator_text: string | null;
  self_grade: WeeklySelfGrade | null;
  self_grade_begruendung: string | null;

  regel: string | null;
  regel_konkret: string | null;
  regel_pruefung: string | null;
  idea_capture: string | null;

  created_at: string;
  updated_at: string;
};

export type WeeklyReviewTradeSeite = "Long" | "Short";
export type WeeklyReviewTradeGrade = "A" | "B" | "C" | "D";
export type WeeklyReviewProzessVsErgebnis = "gut trotz Verlust" | "schlecht trotz Gewinn" | "Ergebnis deckt sich mit Prozess";

export type WeeklyReviewTradeRow = {
  id: string;
  user_id: string | null;
  review_id: string;
  sort_order: number;

  ticker: string;
  seite: WeeklyReviewTradeSeite | null;
  setup: string | null;
  trigger_tactic: string | null;
  verlauf: string | null;
  grade_selektion: WeeklyReviewTradeGrade | null;
  grade_entry: WeeklyReviewTradeGrade | null;
  grade_management: WeeklyReviewTradeGrade | null;
  prozess_vs_ergebnis: WeeklyReviewProzessVsErgebnis | null;
  chart_url: string | null;

  created_at: string;
  updated_at: string;
};

export type WeeklyReviewMissedRow = {
  id: string;
  user_id: string | null;
  review_id: string;
  sort_order: number;

  ticker: string;
  chart_url: string | null;
  text: string | null;

  created_at: string;
  updated_at: string;
};

export type WeeklyReviewDemonRow = {
  id: string;
  user_id: string | null;
  review_id: string;
  demon_key: string;
  aktiv: boolean;
  text: string | null;

  created_at: string;
  updated_at: string;
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

# Legacy Journal OS V7.4.3 — Canonical Reference

## Status

This document is derived from the user's actual legacy Journal OS codebase and documentation.

**Canonical legacy version:** Journal OS 7.4.3  
**Journal storage schema:** `1.6`  
**Journal UI schema version:** `9`

This legacy implementation is the source of truth for the product workflow. The new Next.js/Supabase application is a web migration of this system, not a generic trading journal.

---

# 1. Product identity

The Journal OS is a **process and decision operating system for daily trading**.

Primary flow:

**Pre-Market Commitment → Lock → Shadowlist / Focus Audit → IBKR Reconcile → Daily Review → Weekly Review → Monthly Review → Archive / Audit Timeline**

The legacy UI has exactly these top-level sections:

1. Pre-Market Commitment
2. Shadowlist
3. Daily Review
4. Weekly Review
5. Monthly Review
6. Archiv
7. Rules & Timeline
8. Google Drive Export

Do not replace this information architecture with a generic:

`Dashboard → Trades → Strategies → Accounts`

Accounts, strategies, fills and positions may exist as supporting data, but they are not the product center.

---

# 2. Pre-Market Commitment

The legacy UI explicitly calls this:

**V7 · PRE-MARKET OPERATING SYSTEM**

Subtitle:

> Sieben Pflichtfelder, versionierter Lock, nur abwärts veränderbares Intraday-Risiko.

## Seven required sections

### 1 · STATE + R%

Fields:

- `state_and_risk.personal_state`
- `state_and_risk.market_state_note`
- `state_and_risk.system_risk_pct`
- `state_and_risk.committed_risk_pct`
- `state_and_risk.intraday_risk_pct`

Allowed risk choices used by the current workflow:

- 1.0%
- 0.5%
- 0.25%

Committed risk may not exceed the system risk cap.

### 2 · QQQ-EXTENSION

Fields:

- `qqq_extension.atr_multiple`
- `qqq_extension.cap_active`
- `qqq_extension.note`

Market snapshot includes QQQ/SPY:

- close
- EMA10
- EMA20
- SMA50
- SMA100
- SMA200
- ATR14
- ATR % of price
- ATR multiple to SMA50
- above/below EMA10
- above/below EMA20
- above/below SMA50
- daily session count
- SMA200 readiness

QQQ +8 ATR extension activates a 0.5% risk cap.

### 3 · MTD % — NUR NEUE ENTRIES

Fields:

- `mtd.manual_pct`
- `mtd.auto_fresh_entry_realized_pct`
- `mtd.pause_threshold_reached`
- `mtd.note`

Current pause threshold:

- MTD <= -7.5%

### 4 · VERLUSTZÄHLER

Fields:

- `loss_state.manual_counter`
- `loss_state.auto_counter`
- `loss_state.review_trigger_reached`
- `loss_state.reduced_size_mode`
- `loss_state.note`

Current legacy logic:

- >= 6 losers → reduced-size mode
- >= 10 losers → mandatory review warning

Persistent cross-day state is separately stored as:

- `loser_count`
- `reduced_size_mode`
- `as_of`
- `source`
- `updated_at`

### 5 · WATCHLIST

Each committed ticker has:

- `ticker`
- `risk_pct`
- `list_type`
- `notes`

Allowed list types:

- Prime
- Watchlist
- Secondary

TradingView ticker lists can be pasted and imported as Prime names.

The original order is preserved and duplicates are removed.

### 6 · EP-KANDIDATEN

Each EP candidate has a ticker plus five mandatory criteria:

- `gap_8_pct`
- `rvol_1_5`
- `news_trigger`
- `event_day`
- `context_not_defensive`
- `notes`

An EP candidate must also be on the committed watchlist.

### 7 · OPERATIVER PLAN

Fields:

- `operational_plan`
- `improvement_focus`

Hard rules stored in the commitment:

- `max_tickers = 3`
- `source_lock = true`
- `intraday_hand_adds = 0`

---

# 3. Commitment object

Canonical legacy object:

- `schema_version`
- `commitment_id`
- `trade_date`
- `status`
- `revision`
- `created_at`
- `updated_at`
- `locked_at`
- `market_snapshot`
- `state_and_risk`
- `qqq_extension`
- `mtd`
- `loss_state`
- `watchlist`
- `ep_candidates`
- `operational_plan`
- `improvement_focus`
- `hard_rules`
- `intraday_risk_changes`
- `overrides`

Status starts as:

- `DRAFT`

and becomes:

- `LOCKED`

---

# 4. Lock semantics — critical behavior

The lock is a core product feature.

Once a commitment is LOCKED:

- watchlist cannot be changed
- EP candidates cannot be changed
- hard rules cannot be changed
- intraday risk can only be REDUCED
- risk increases are rejected
- locked timestamp remains preserved
- every save produces a new revision
- historical versions are retained
- current state points to the latest revision

Risk reductions create an append-only history item:

- `timestamp`
- `old_risk_pct`
- `new_risk_pct`
- `reason`

The online system must preserve the **original locked snapshot**. Do not silently overwrite history.

---

# 5. Audit/event ledger

The old Journal OS uses an append-only, hash-chained event ledger.

Event fields:

- `schema_version`
- `event_id`
- `timestamp`
- `event_type`
- `trade_date`
- `entity_type`
- `entity_id`
- `actor`
- `payload`
- `previous_hash`
- `hash`

Relevant event types include:

- `commitment_saved`
- `commitment_locked`
- `risk_downgraded`
- `review_saved`
- `review_completed`
- `review_report_generated`
- `shadowlist_scored`
- `committed_focus_audited`
- weekly/monthly review save events

The web migration does not need to reproduce the filesystem implementation, but it must preserve equivalent auditability and immutable history.

---

# 6. Shadowlist — central feature

The legacy UI calls this:

**STOCK SELECTION AUDIT**

Subtitle:

> Vorab ausgewählte Namen getrennt von Execution und Management messen.

This is not optional or secondary.

## 6.1 Decision layer

For every ticker in the locked commitment:

- `ticker`
- `list_type`
- `actually_traded`
- `decision`
- `reason`
- `notes`

Decision values:

- `Genommen`
- `Nicht genommen`

If IBKR shows the ticker was traded, it is automatically forced to:

- `actually_traded = true`
- `decision = "Genommen"`

Reason options used by the Daily Review:

- Kein Trigger
- Entry-Filter nicht erfüllt
- Entry-Limit erreicht
- Risk-/Regimefilter
- Bewusst ausgelassen
- Übersehen
- Bereits in Position
- Sonstiges

Archive metrics:

- Prime/Committed Slots
- Genommen
- Shadow
- Take Rate

## 6.2 M5 / M15 / M30 shadow model

The legacy shadow engine can evaluate every committed ticker at:

- M5 ORB
- M15 ORB
- M30 ORB

Per model it stores / derives:

- ticker
- trade_date
- orb_minutes
- status
- ORH
- ORL
- opening_bar_count
- trigger_timestamp
- entry_price
- risk_per_share
- exit_timestamp
- exit_price
- exit_reason
- model_r
- mfe_r
- mae_r
- rth_close_r
- same_bar_ambiguous
- actually_traded

Trigger rule:

- first eligible bar whose `high > ORH`
- strict break, not equality

Stop model:

- opening-range low (ORL)

Exit if not stopped:

- RTH close

Comparison is explicitly intended to separate:

- actually traded
- not actually traded

and compare MFE / modeled R / win rate across ORB windows.

---

# 7. Committed Focus Audit

Separate from the generic M5/M15/M30 shadow model, the legacy system includes a production-style **committed focus audit**.

Canonical production M30 rules:

- opening range = 09:30–10:00 America/New_York
- trigger can only occur from 10:00 ET onward
- strict trigger = `high > M30 ORH`
- entry = `max(ORH, trigger bar open)`
- use D-1 indicators only where applicable
- no future leakage

Current filters:

- max SMA50 ATR extension: 5.0x
- max LoD distance: 70%

Audit fields include:

- `ticker`
- `trade_date`
- `orb_minutes`
- `status`
- `qualified`
- `orh`
- `orl`
- `opening_bar_count`
- `trigger_timestamp`
- `entry_price`
- `known_lod_at_entry`
- `lod_reference`
- `lod_reference_high`
- `lod_reference_low`
- `lod_distance_auto_1600_pct`
- `lod_distance_source`
- `m30_or_range_pct_atr`
- `atr14_d1`
- `sma50_d1`
- `sma50_atr_extension_at_entry`
- `lod_distance_pct`
- `reason`
- `missing`
- `stop_type`
- `stop_price`
- `stop_comment`
- `default_stop_used`
- `actually_traded`
- `decision`

Supported stop types:

- `M30_ORL`
- `M15_ORL`
- `M5_ORL`
- `FIXED_PERCENT`
- `MANUAL_PRICE`

Default:

- M30 ORL

---

# 8. Daily Review

The legacy UI calls this:

**DAILY REVIEW & COACHING JOURNAL**

Subtitle:

> IBKR-Reconcile, Altbestand/Tageskampagne, Charts, Mentalstatus, Self-Grade, HTML und PDF.

The review is performed **against the prior locked plan**.

Canonical top-level review object:

- `schema_version`
- `review_id`
- `trade_date`
- `status`
- `revision`
- `created_at`
- `updated_at`
- `completed_at`
- `review_type`
- `commitment_revision`
- `commitment_snapshot`
- `reconcile`
- `portfolio`
- `market_review`
- `guardrails`
- `guardrails_reviewed`
- `mental`
- `day_summary`
- `ticker_reviews`
- `coaching`
- `compliance`
- `shadow_results`
- `shadowlist_decisions`
- `campaign_annotations`
- `portfolio_snapshot`
- `report_files`

Additional runtime/import fields currently saved include:

- `daily_executions`
- `execution_batches`
- `taken_tickers`
- `focus_audit`
- `ibkr_data_source`

Review type:

- `ENTRY` when there was a new buy/add
- `MANAGEMENT` when no new entry occurred

---

# 9. IBKR / broker reconstruction

The product principle is:

**Ticker statt Klicks zählen.**

Multiple fills are not automatically multiple trades.

The legacy system deliberately separates:

- prior/old position
- same-day campaign
- new buys
- adds
- partial exits
- final exits
- mixed lots

Do not blindly evaluate a new campaign using IBKR FIFO average cost.

## Canonical execution fields

- `exec_id`
- `trade_id`
- `symbol`
- `asset_class`
- `side`
- `quantity`
- `price`
- `trade_datetime`
- `commission`
- `commission_currency`
- `fx_rate_to_base`
- `open_close`
- `order_id`

Allowed side:

- BUY
- SELL

Allowed open/close:

- OPEN
- CLOSE
- UNKNOWN

Execution timestamps must include timezone information.

## Canonical account snapshot metrics

- `net_liquidation_value`
- `start_of_day_nlv`
- `net_cash_flow_day`
- `day_change_value`
- `day_return_pct`
- `cash`
- `buying_power`
- `gross_position_value`
- `gross_exposure_pct`
- `net_exposure_pct`
- `realized_pnl_day`
- `unrealized_pnl`
- `unrealized_pnl_day`
- `maintenance_margin`
- `available_funds`
- `excess_liquidity`

## Position fields

- symbol
- asset_class
- currency
- quantity
- average_cost
- market_price
- market_value_base
- unrealized_pnl_base
- unrealized_pnl_pct
- day_pnl_base
- fx_rate_to_base
- current_stop
- stop_note

---

# 10. Campaign annotations

Entries are annotated at **campaign level**, not per broker partial fill.

Fields:

- `symbol`
- `entry_strategy`
- `initial_stop`
- `current_stop`
- `lod_distance_auto_1600_pct`
- `lod_distance_pct`
- `notes`
- `updated_at`

This prevents broker execution fragmentation from becoming the primary journal model.

---

# 11. Per-ticker review fields

Canonical fields:

- `setup`
- `trigger`
- `structure`
- `structure_rating`
- `thesis`
- `relevant_swings` — legacy retained
- `intended_stop_logic`
- `stop_1` — legacy retained
- `stop_2` — legacy retained
- `final_line` — legacy retained
- `override`
- `management_intent`
- `management_grade`
- `rule_break`
- `notes`

Current visible Daily Review intentionally hides:

- Relevante Swing-Punkte
- Stop 1
- Stop 2
- Finale Linie

These legacy values must remain loadable/preservable, but do not need to be prominent in the new UI.

## Setup options

- Breakout
- Pullback
- Episodic Pivot
- Undercut & Reclaim
- M5 ORB
- M15 ORB
- M30 ORB
- Dip / MACD
- Push-out PDH
- FTD
- Sonstiges

## Trigger options

- M5 ORH
- M15 ORH
- M30 ORH
- PDH Break
- PDL Undercut & Reclaim
- EMA10 Reclaim
- EMA20 Reclaim
- MACD Cross
- Diskretionär innerhalb Framework
- Sonstiges

## Structure options

- Base
- Pullback
- Handle
- Double Bottom
- Flat Base
- VCP
- Episodic Pivot
- FTD
- Sonstiges

## Structure rating

- Vorläufig
- A+
- A
- B
- C
- Kein Setup

## Management grade

- Sehr gut
- Gut
- Ausreichend
- Schwach
- Fehlerhaft

## Rule status

- Framework-konform
- Legitime Diskretion
- Organisatorischer Fehler
- Regelbruch
- Bewusster Override

---

# 12. Reconcile

Review reconciliation deliberately separates official account outcome from process assessment.

Current fields include:

- `official_realized_pnl`
- `net_liquidation_value`
- `start_of_day_nlv`
- `nlv_change`
- `day_return_pct`
- `unrealized_pnl`
- `unrealized_pnl_day`
- `cash`
- `buying_power`
- `gross_exposure_pct`
- `net_exposure_pct`
- `day_return_source`
- `day_return_reference_date`
- `currency`
- `note`

Do not invent hypothetical “process-adjusted P&L” where stop execution was not actually defined.

---

# 13. Market review

Fields:

- `market_thought`
- `environment`
- `qqq_spy_note` — legacy alias
- `guardrail_override`

Visible labels:

- Sessionverlauf und Marktgedanke
- Marktumgebung

---

# 14. Guardrails

Canonical guardrails:

1. `committed_names_only` — Nur committed Prime-Namen gehandelt
2. `max_entries` — Maximale Entryanzahl eingehalten
3. `risk_limit` — Vorgegebenes Risiko eingehalten
4. `loss_streak_reduction` — Losing-Streak-Risikoreduktion eingehalten
5. `three_unmodified_positions` — Keine neuen Entries bei drei unmodifizierten Positionen
6. `minimum_entry_time` — Mindest-Entryzeit eingehalten
7. `mtd_pause` — MTD-Pausenregel eingehalten
8. `no_impulsive_adds` — Keine impulsiven Adds
9. `committed_triggers_only` — Keine nicht committed Trigger gehandelt

Each record:

- `guardrail_id`
- `guardrail`
- `status`
- `comment`

Statuses:

- Eingehalten
- Verletzt
- Nicht anwendbar

A completed review requires explicit guardrail confirmation.

---

# 15. Mental status

Options:

- Unauffällig
- Ruhig
- Fokussiert
- Müde
- Angespannt
- FOMO
- Frustriert
- Übermotiviert
- Unkonzentriert
- Sonstiges

Canonical normalized fields:

- `states`
- `state`
- `other_state`
- `focus` (1–5)
- `influence`
- `influence_note`

Do not automatically infer emotional causes from operational mistakes.

---

# 16. Coaching / Daily Review conclusion

Fields:

- `positive`
- `weakness`
- `coaching_take`
- `coaching_source`
- `self_grade`
- `grade_reason`
- `capture_giveback_note`
- `streak_giveback_status` — legacy alias
- `operational_todos`

The review must separate at least conceptually:

### Selection
Were the right names selected?

Use:

- Prime/committed list
- taken vs not taken
- Shadowlist
- M5/M15/M30 hypothetical outcomes
- committed focus audit

### Execution
Was the chosen setup executed correctly?

Use:

- trigger
- timing
- committed-name compliance
- entry filters
- actual fills/batches
- rule status

### Management
Was the taken campaign managed correctly?

Use:

- intended stop logic
- initial/current stop
- adds
- partial exits
- exits
- management intent
- management grade
- actual management notes

Do NOT compress these three into one opaque score.

---

# 17. Daily report behavior

## Entry day

If there is at least one new entry/add:

- full Daily Review
- charts
- HTML
- PDF

## Management / null day

If no new entry:

- no trade PDF required
- no trade charts required
- compact management review / HTML

Report order in legacy system:

1. title / date
2. summary
3. risk state / loser count
4. QQQ/SPY index block
5. reconcile
6. ticker sections
7. coaching take
8. self-grade
9. loss streak / capture state
10. operational todos

---

# 18. Chart rules retained from legacy system

Daily charts:

- EMA10
- EMA20
- SMA50
- SMA100
- SMA200
- ~60 visible trading sessions
- >=260 daily bars for warm-up

Daily foresight:

- no full D0 candle if entry occurred intraday
- completed Daily bars only through D-1
- construct D0 partial candle from m5 only through entry time

m5 chart:

- 09:30–16:00 ET
- entries/adds/exits/stops
- MACD 6,20,9 Close
- MACD must use previous-session warm-up
- do not restart MACD at 09:30
- no intraday EMA6/EMA20 overlay in price panel

Timezone handling:

- always America/New_York / DST-safe
- never hardcode UTC-4

---

# 19. Weekly Review

The legacy system already contains a dedicated Weekly Review.

Important structures include:

- preconditions
- balance
- enforcement
- worked / not worked
- diagnostic checks
- shadow log
- largest missed move
- cooldown / anti-hot-hand comparison
- setup ratings
- repetition
- problem loop
- recurring positives
- pattern/state analysis
- output / behavior change / process grade

The weekly review is not optional future feature creep; it already belongs to Journal OS.

---

# 20. Monthly Review

The legacy system already contains a dedicated Monthly Review.

Metrics include:

- Trade Frequency (trades)
- Trade Frequency (tickers)
- Win Rate
- Avg R Gain
- Avg R Loss
- R Profit Factor
- Payoff Ratio
- Expectancy / R
- Max R Gain
- Max R Loss
- Longest Losing Streak
- Winner Holding Time
- Loser Holding Time
- Total R
- NLV / month-end NLV

Additional sections:

- benchmark
- Jeff Sun questions
- breakdowns
- elimination candidates
- outliers
- tilt/state
- enforcement
- weekly repetition
- reinforce / reduce / eliminate / do-not-change
- process grade

---

# 21. What the new web app should preserve

## Keep conceptually

- Pre-Market Commitment as the first-class home workflow
- seven required commitment sections
- versioned lock
- downward-only risk after lock
- exact locked snapshot
- Prime/Watchlist/Secondary source labels
- EP declaration
- persistent loser/risk state
- Shadowlist decisions
- M5/M15/M30 shadow evaluation
- M30 committed focus audit
- IBKR reconciliation
- ticker/campaign grouping instead of fill-counting
- old-lot vs same-day campaign separation
- Daily Review
- Weekly Review
- Monthly Review
- Rules & Timeline
- immutable audit trail
- reports/archive

## Scrap / demote from the incorrectly started generic app

Any UI whose primary mental model is:

- Accounts CRUD
- Strategies CRUD
- generic Trades CRUD
- generic trade detail as the product center

Those may survive as internal supporting structures only where useful.

---

# 22. Migration strategy for Next.js + Supabase

Do not mechanically port filesystem JSON into one giant JSON column.

Design a relational model that preserves:

- immutable commitment versions
- immutable commitment ticker membership at lock
- intraday risk-change history
- EP candidate declarations
- review revisions
- review commitment snapshot reference
- campaign-level trade annotation
- actual broker executions
- portfolio snapshots
- shadow decisions
- shadow model results
- focus-audit results
- guardrail states
- ticker review annotations
- coaching
- weekly/monthly review snapshots
- append-only audit events

Before writing migrations:

1. inspect the current wrong/generic Supabase schema
2. produce a mapping:
   - KEEP
   - REPURPOSE
   - NEW
   - DEPRECATE
3. propose the relational schema
4. wait for approval before applying destructive changes

Existing migrations must not be edited retroactively.

---

# 23. Legacy source map

The following files from the user's legacy project were used as canonical references:

- `JOURNAL_OS_VERSION.txt`
- `src/journal/version.py`
- `src/journal/storage.py`
- `src/journal/shadow.py`
- `src/journal/rules.py`
- `src/journal/events.py`
- `src/journal/ibkr_connector.py`
- `src/journal/portfolio.py`
- `src/journal/periodic.py`
- `src/journal/reports.py`
- `src/ui/journal_os.py`
- `docs/ARBEITSANWEISUNG_DAILY_REVIEW_HANDOFF.md`
- `docs/JOURNAL_UI_REPORT_CLEANUP_V7_4_3.md`

Where this document conflicts with the earlier generic `CLAUDE.md`, this document wins.

-- Fixes a real bug from 20260813171824_create_journal_os_commitment_schema.sql:
-- service_role was only ever granted select+insert on public.commitments,
-- never update or delete. This silently broke every UPDATE the app
-- actually needs against this table since day one:
--
-- - lockAction: update commitments set status='LOCKED', locked_at=...
-- - reduceRiskAction: update commitments set intraday_risk_pct=...
-- - saveDraftAction's compensating rollback: delete from commitments
--   where id=... (when a watchlist/ep_candidates insert fails partway)
--
-- Draft saves (insert-only) always worked, which is why this went
-- unnoticed until the first real lock attempt. No other table in this
-- migration is ever updated by the app (watchlist/ep_candidates/
-- risk_changes/audit_events are all genuinely append-only by design —
-- see their original grants, unchanged here).

grant update, delete on public.commitments to service_role;

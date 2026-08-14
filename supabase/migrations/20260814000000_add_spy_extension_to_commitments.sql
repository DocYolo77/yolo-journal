-- Journal OS V7.4.3 web migration — SPY-extension field alongside the
-- existing QQQ-extension field (§2 of the legacy reference is QQQ-only;
-- this adds a parallel SPY reading per explicit user request, additive
-- and optional, not a legacy-mandated field).

alter table public.commitments
  add column spy_extension_atr_multiple numeric(12,6);

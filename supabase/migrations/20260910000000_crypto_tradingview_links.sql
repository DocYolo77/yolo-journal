-- Replace crypto trade screenshot uploads with TradingView chart links.
-- User request: paste a TradingView link instead of uploading a
-- screenshot image.
--
-- Confirmed via a live row-count check before this migration: no
-- crypto_trades row has entry_screenshot_path or after_screenshot_path
-- set, so dropping them loses nothing. The "crypto-screenshots" Storage
-- bucket is left untouched — no app code writes to it after this change,
-- and dropping a storage bucket isn't a migration-file concern.

alter table public.crypto_trades drop column entry_screenshot_path;
alter table public.crypto_trades drop column after_screenshot_path;

alter table public.crypto_trades add column entry_tradingview_url text;
alter table public.crypto_trades add column after_tradingview_url text;

-- Security hardening: public.set_updated_at() (defined in
-- 20260813164800_initial_schema.sql) had no fixed search_path, flagged
-- by the Supabase security advisor (function_search_path_mutable).
-- Fixing it here via ALTER FUNCTION rather than editing the original
-- migration file, per the project's "never edit past migrations" rule.
--
-- The function itself only reads/writes NEW.updated_at on the row being
-- updated and calls no other functions, so this was low-risk in
-- practice, but pinning search_path is correct hygiene regardless.

alter function public.set_updated_at() set search_path = pg_catalog, public;

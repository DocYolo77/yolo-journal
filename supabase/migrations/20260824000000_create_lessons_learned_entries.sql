-- Journal OS web migration — "Lessons Learned" tab: a personal trading
-- learning hub with three sub-areas sharing one table, discriminated by
-- `kind`:
--   'lesson'    — short (1-3 sentence) personal takeaways; not fixed
--                 rules, just things to remember/internalize.
--   'quote'     — compact quotes from other traders, quickly scrollable.
--   'deep_dive' — longer content behind a collapsible title: threads,
--                 explanations, own summaries, concepts, with an
--                 optional source/link field.
--
-- All three kinds are freely editable, deletable, and reorderable
-- (up/down) by design — unlike Commitments/Guardrails, nothing here is
-- ever meant to be a locked/permanent rule.
--
-- One real table (not jsonb) since these are naturally list-of-rows
-- data with independent reordering per kind, same shape as the existing
-- commitment_watchlist_items / commitment_ep_candidates child tables.
--
-- Additive only.

create table public.lessons_learned_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  kind text not null check (kind in ('lesson', 'quote', 'deep_dive')),

  -- Deep Dives only: the collapsed-state title. Null for lesson/quote.
  title text,
  -- lesson/quote: the short text itself. deep_dive: the long body shown
  -- once expanded.
  content text not null,
  -- Deep Dives only: optional link to the original tweet/video/article.
  source_url text,

  -- Free up/down reordering, scoped per kind — not a global ordering
  -- across lessons/quotes/deep dives.
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lessons_learned_entries_kind_sort_idx on public.lessons_learned_entries(kind, sort_order);
create index lessons_learned_entries_user_id_idx on public.lessons_learned_entries(user_id);

create trigger lessons_learned_entries_set_updated_at
before update on public.lessons_learned_entries
for each row execute function public.set_updated_at();

alter table public.lessons_learned_entries enable row level security;

grant select, insert, update, delete on public.lessons_learned_entries to authenticated;

create policy "lessons_learned_entries_owner_rw"
on public.lessons_learned_entries for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

grant select, insert, update, delete on public.lessons_learned_entries to service_role;

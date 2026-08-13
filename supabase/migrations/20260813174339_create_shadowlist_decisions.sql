-- Journal OS V7.4.3 web migration — Shadowlist Decision Layer (§6.1).
--
-- Additive only, does not touch any earlier migration.

create table public.shadowlist_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  commitment_id uuid not null references public.commitments(id) on delete cascade,

  -- Denormalized for straightforward per-day querying without joining
  -- back through commitments.
  trade_date date not null,

  ticker text not null,
  -- Snapshot of the list_type from commitment_watchlist_items at seed
  -- time (Prime/Watchlist/Secondary) — kept even if watchlist rows were
  -- ever hypothetically altered, since this table is the audit record.
  list_type text not null check (list_type in ('Prime', 'Watchlist', 'Secondary')),

  actually_traded boolean not null default false,
  decision text not null default 'Nicht genommen' check (decision in ('Genommen', 'Nicht genommen')),
  reason text check (
    reason is null or reason in (
      'Kein Trigger',
      'Entry-Filter nicht erfüllt',
      'Entry-Limit erreicht',
      'Risk-/Regimefilter',
      'Bewusst ausgelassen',
      'Übersehen',
      'Bereits in Position',
      'Sonstiges'
    )
  ),
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (commitment_id, ticker)
);

create index shadowlist_decisions_user_id_idx on public.shadowlist_decisions(user_id);
create index shadowlist_decisions_commitment_id_idx on public.shadowlist_decisions(commitment_id);
create index shadowlist_decisions_trade_date_idx on public.shadowlist_decisions(trade_date);

create trigger shadowlist_decisions_set_updated_at
before update on public.shadowlist_decisions
for each row execute function public.set_updated_at();

alter table public.shadowlist_decisions enable row level security;

grant select, insert, update on public.shadowlist_decisions to authenticated;

create policy "shadowlist_decisions_owner_rw"
on public.shadowlist_decisions for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

grant select, insert, update on public.shadowlist_decisions to service_role;

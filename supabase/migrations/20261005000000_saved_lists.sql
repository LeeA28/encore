-- =====================================================================
-- Migration 5: saved lists (October 5, 2026).
-- A saved list is a named group of concerts you picked (like "2026" or "every 5SOS show"),
-- with its own tier list. Its songs aren't stored: they're always worked out from its concerts,
-- so they stay up to date when you add a song to one of those concerts.
-- =====================================================================

create table public.saved_lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  concert_ids text[] not null default '{}',   -- the setlist.fm ids of the concerts in this list
  tiers       jsonb not null default '{"S":[],"A":[],"B":[],"C":[],"D":[]}', -- this list's own rankings
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.saved_lists enable row level security;

create policy "Read own saved lists" on public.saved_lists
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own saved lists" on public.saved_lists
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own saved lists" on public.saved_lists
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own saved lists" on public.saved_lists
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.saved_lists to authenticated;

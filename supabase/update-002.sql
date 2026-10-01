-- =====================================================================
-- Encore database update 2: tour names and saved playlists.
-- You already ran schema.sql, so run THIS file once (SQL Editor -> New query -> Run)
-- to add the new parts without touching your existing data.
-- (schema.sql has also been updated, for anyone setting up from scratch.)
-- =====================================================================

-- Tour names on concerts ("if not exists" makes this safe to run twice)
alter table public.concerts add column if not exists tour text;

-- One row per playlist Encore created in a user's Spotify account
create table if not exists public.playlists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  spotify_id  text not null,
  name        text not null,
  url         text not null,
  track_count integer not null,
  source      text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, spotify_id)
);

alter table public.playlists enable row level security;

create policy "Read own playlists" on public.playlists
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own playlists" on public.playlists
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own playlists" on public.playlists
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own playlists" on public.playlists
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.playlists to authenticated;

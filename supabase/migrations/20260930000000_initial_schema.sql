-- =====================================================================
-- Migration 1: Encore's original database setup (September 30, 2026).
-- Creates the concerts, live_tiers, and custom_lists tables, and the
-- Row Level Security rules that protect them.
-- This was first run by hand in the SQL Editor (as schema.sql).
-- =====================================================================


-- ---------- Tables ----------

-- One row per concert a user has added.
-- The concert's details are real columns; the song list is stored as JSON,
-- since it's always used as a whole list.
create table public.concerts (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  setlist_id text not null,               -- setlist.fm's id for the concert
  date       date not null,
  artist     text not null,
  venue      text not null,
  city       text not null default '',
  country    text,
  url        text not null,               -- link to the setlist on setlist.fm
  songs      jsonb not null default '[]', -- [{ "name": "...", "coverOf": "..." }, ...]
  added_at   timestamptz not null default now(),
  primary key (user_id, setlist_id)       -- a user can add each concert only once
);

-- One row per user: their S/A/B/C/D tier list for songs heard live.
create table public.live_tiers (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  tiers      jsonb not null,              -- { "S": [songKey, ...], "A": [...], ... }
  updated_at timestamptz not null default now()
);

-- One row per custom list (a discography, some albums, handpicked songs...).
create table public.custom_lists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  items      jsonb not null default '[]',
  tiers      jsonb not null default '{"S":[],"A":[],"B":[],"C":[],"D":[]}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "on delete cascade" above means: if a user account is deleted, their rows are deleted too.


-- ---------- Security: Row Level Security (RLS) ----------
-- The publishable key is public, so anyone could send requests to these tables.
-- RLS makes Postgres check every single request against the rules below:
-- a logged-in user can only see and change rows whose user_id is their own id.
-- (select auth.uid()) is the id of whoever is making the request.

alter table public.concerts enable row level security;
alter table public.live_tiers enable row level security;
alter table public.custom_lists enable row level security;

-- concerts
create policy "Read own concerts" on public.concerts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own concerts" on public.concerts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own concerts" on public.concerts
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own concerts" on public.concerts
  for delete to authenticated using ((select auth.uid()) = user_id);

-- live_tiers
create policy "Read own tiers" on public.live_tiers
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own tiers" on public.live_tiers
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own tiers" on public.live_tiers
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own tiers" on public.live_tiers
  for delete to authenticated using ((select auth.uid()) = user_id);

-- custom_lists
create policy "Read own lists" on public.custom_lists
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own lists" on public.custom_lists
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own lists" on public.custom_lists
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own lists" on public.custom_lists
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Allow logged-in users to use these tables at all (RLS above still limits them to their own rows).
-- Logged-out visitors ("anon") get no access.
grant select, insert, update, delete on public.concerts to authenticated;
grant select, insert, update, delete on public.live_tiers to authenticated;
grant select, insert, update, delete on public.custom_lists to authenticated;

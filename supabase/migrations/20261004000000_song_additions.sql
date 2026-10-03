-- =====================================================================
-- Migration 4: shared song additions (October 4, 2026).
-- When you add a song a concert's setlist.fm setlist was missing (like a secret song),
-- other Encore users who were at the same show can see it as a suggestion, and add it in one click.
-- Every concert has a unique setlist.fm id, which is how Encore knows two people were at the same show.
-- =====================================================================

-- One row per person, per concert, per song they added
create table public.song_additions (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  setlist_id text not null,                   -- the concert (setlist.fm's id)
  song_norm  text not null,                   -- the song name, normalized, so spellings like "Don't" and "dont" match
  song_name  text not null,                   -- the song name as typed or picked, for display
  spotify_id text,                            -- the Spotify track, if it was picked from Spotify
  created_at timestamptz not null default now(),
  primary key (user_id, setlist_id, song_norm) -- each person can add each song to each show once
);

-- Makes "additions for these concerts" fast
create index song_additions_setlist_idx on public.song_additions (setlist_id);

-- You can only see and change your own additions (so nobody can see which shows you went to)
alter table public.song_additions enable row level security;

create policy "Read own additions" on public.song_additions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own additions" on public.song_additions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own additions" on public.song_additions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own additions" on public.song_additions
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.song_additions to authenticated;

-- Songs OTHER people added to these concerts, with how many people added each.
-- Like get_shared_matches: "security definer" lets it count everyone's rows, and it only returns
-- totals, never who. Your own additions are left out ("is distinct from" also handles guests,
-- whose auth.uid() is null).
create or replace function public.get_concert_additions(setlist_ids text[])
returns table (
  setlist_id text,
  song_name  text,
  spotify_id text,
  people     integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.setlist_id,
    -- people may spell it slightly differently: show the most common spelling and track
    mode() within group (order by a.song_name)  as song_name,
    mode() within group (order by a.spotify_id) as spotify_id,
    count(*)::integer                            as people
  from public.song_additions a
  where a.setlist_id = any (setlist_ids)
    and a.user_id is distinct from auth.uid()
  group by a.setlist_id, a.song_norm
  order by people desc;
$$;

revoke execute on function public.get_concert_additions(text[]) from public;
grant execute on function public.get_concert_additions(text[]) to anon, authenticated;

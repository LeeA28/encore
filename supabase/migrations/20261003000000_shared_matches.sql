-- =====================================================================
-- Migration 3: the shared match table (October 3, 2026).
-- When someone makes a playlist, the Spotify track they used for each song counts as their
-- "vote" for it. Once 2+ people agree on a track for a song (with no tie), it becomes the
-- shared match, and everyone's matching uses it instead of searching Spotify.
-- =====================================================================

-- One vote per person per song. Picking a different track later moves your vote
-- (the primary key means a person can't vote twice for the same song).
create table public.match_votes (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  song_key     text not null,   -- the song, as Encore identifies it: normalized "artist|title"
  track_id     text not null,   -- the Spotify track this person used
  track_name   text not null,   -- the track's details, so a shared match can be shown without asking Spotify
  track_artist text not null,
  track_album  text,
  updated_at   timestamptz not null default now(),
  primary key (user_id, song_key)
);

-- Makes "all votes for these songs" fast, since that's the question the function below asks
create index match_votes_song_key_idx on public.match_votes (song_key);

-- Each person can only see and change their own votes, so nobody can read which songs
-- another person has heard live.
alter table public.match_votes enable row level security;

create policy "Read own votes" on public.match_votes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own votes" on public.match_votes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own votes" on public.match_votes
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own votes" on public.match_votes
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.match_votes to authenticated;

-- The shared matches for a list of songs. Returns only totals, never who voted.
--
-- "security definer" runs this function with the database owner's permissions, so it can count
-- everyone's votes even though each person can only read their own. That's safe here because
-- it only ever returns totals. "set search_path = ''" is a standard safety measure for such
-- functions: every table is named in full (public.match_votes), so nothing can be swapped in.
create or replace function public.get_shared_matches(song_keys text[])
returns table (
  song_key     text,
  track_id     text,
  track_name   text,
  track_artist text,
  track_album  text,
  votes        integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with counts as (
    -- How many people chose each track, for each requested song
    select
      v.song_key,
      v.track_id,
      count(*)::integer   as votes,
      max(v.track_name)   as track_name,   -- any voter's copy (it's the same track)
      max(v.track_artist) as track_artist,
      max(v.track_album)  as track_album
    from public.match_votes v
    where v.song_key = any (song_keys)
    group by v.song_key, v.track_id
  ),
  ranked as (
    select
      c.*,
      -- 1 for the most-voted track of each song
      rank() over (partition by c.song_key order by c.votes desc) as place,
      -- how many tracks of this song have exactly this many votes (more than 1 = a tie)
      count(*) over (partition by c.song_key, c.votes) as same_votes
    from counts c
  )
  select song_key, track_id, track_name, track_artist, track_album, votes
  from ranked
  where place = 1          -- the winner...
    and same_votes = 1     -- ...with no tie...
    and votes >= 2;        -- ...confirmed by at least 2 people
$$;

-- Anyone can ask for shared matches (guests included); only logged-in users can vote (above)
revoke execute on function public.get_shared_matches(text[]) from public;
grant execute on function public.get_shared_matches(text[]) to anon, authenticated;

-- =====================================================================
-- Migration 8: "people who saw the same shows also saw..." (October 6, 2026).
-- Collaborative filtering: recommendations from what other Encore users did, rather than from
-- which artists are similar. If people who were at your concerts also went to see an artist,
-- you might like that artist too.
-- =====================================================================

-- For the concerts you went to: other artists that people at those same concerts have seen,
-- with how many different people. Like the other shared functions, it returns only totals,
-- never who. An artist only appears once at least 3 different people connect to it, so nobody
-- can work out a specific person's concert history from the results.
create or replace function public.get_co_attended_artists(setlist_ids text[])
returns table (artist text, people integer)
language sql
stable
security definer
set search_path = ''
as $$
  with fellow_fans as (
    -- Other people who were at any of these concerts ("is distinct from" also handles guests)
    select distinct c.user_id
    from public.concerts c
    where c.setlist_id = any (setlist_ids)
      and c.user_id is distinct from auth.uid()
  ),
  their_artists as (
    -- Every artist those people have seen, once per person
    select distinct c.user_id, c.artist
    from public.concerts c
    join fellow_fans f on f.user_id = c.user_id
  )
  select t.artist, count(*)::integer as people
  from their_artists t
  group by t.artist
  having count(*) >= 3          -- the privacy threshold
  order by people desc, t.artist
  limit 30;
$$;

revoke execute on function public.get_co_attended_artists(text[]) from public;
grant execute on function public.get_co_attended_artists(text[]) to anon, authenticated;

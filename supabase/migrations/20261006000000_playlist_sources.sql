-- =====================================================================
-- Migration 6: remembering what each playlist was made from (October 6, 2026).
-- So a playlist can be updated later with the current songs from the same source:
-- all songs heard live, a saved list, or chosen tiers of a tier list.
-- =====================================================================

-- For example {"kind":"songs","listId":"all"} or {"kind":"tiers","context":"saved:<id>","tiers":["S","A"]}.
-- Empty for playlists made before this existed (those can't be updated).
alter table public.playlists add column if not exists source_ref jsonb;

// Shared song additions: songs other Encore users added to the same concerts you went to
// (like a secret song setlist.fm is missing). Database side: supabase/migrations/20261004000000_song_additions.sql

import type { Concert } from "./types";
import { createClient, isSupabaseConfigured } from "./supabase/client";
import { normalize, splitMedley } from "./songs";

export type ConcertAddition = { songName: string; spotifyId?: string; people: number };

// For each of these concerts: songs other people added. If anything goes wrong (or Supabase
// isn't set up), there are simply no suggestions.
export async function fetchConcertAdditions(setlistIds: string[]): Promise<Record<string, ConcertAddition[]>> {
  const result: Record<string, ConcertAddition[]> = {};
  if (setlistIds.length === 0) return result;
  if (!isSupabaseConfigured()) return result; // no Supabase (a guest-only setup): nothing shared to load
  try {
    const { data, error } = await createClient().rpc("get_concert_additions", { setlist_ids: setlistIds });
    if (error) throw error;
    for (const row of data ?? []) {
      (result[row.setlist_id] ??= []).push({
        songName: row.song_name,
        spotifyId: row.spotify_id ?? undefined,
        people: row.people,
      });
    }
  } catch (err) {
    console.warn("Couldn't load songs others added.", err);
  }
  return result;
}

// Pure: suggestions that aren't already in this concert's setlist (including inside a medley)
export function newSuggestions(concert: Concert, additions: ConcertAddition[]): ConcertAddition[] {
  const have = new Set(concert.songs.flatMap((s) => splitMedley(s.name).map(normalize)));
  return additions.filter((a) => !have.has(normalize(a.songName)));
}

// Pure: what changed in your own added songs between two versions of a concert
export function diffAddedSongs(before: Concert | undefined, after: Concert) {
  const names = (c?: Concert) => new Set((c?.songs ?? []).filter((s) => s.addedByYou).map((s) => s.name));
  const was = names(before);
  const now = names(after);
  return {
    added: after.songs.filter((s) => s.addedByYou && !was.has(s.name)),
    removed: [...was].filter((name) => !now.has(name)),
  };
}

type Supabase = ReturnType<typeof createClient>;

// Saves your added songs as rows others can see. Upsert makes it safe to repeat (used for syncing).
export async function saveAdditions(
  supabase: Supabase,
  userId: string,
  setlistId: string,
  songs: { name: string; spotifyId?: string }[]
) {
  if (songs.length === 0) return;
  const rows = songs.map((s) => ({
    user_id: userId,
    setlist_id: setlistId,
    song_norm: normalize(s.name),
    song_name: s.name,
    spotify_id: s.spotifyId ?? null,
  }));
  const { error } = await supabase.from("song_additions").upsert(rows, { onConflict: "user_id,setlist_id,song_norm" });
  if (error) throw error;
}

export async function deleteAdditions(supabase: Supabase, userId: string, setlistId: string, songNames?: string[]) {
  let query = supabase.from("song_additions").delete().eq("user_id", userId).eq("setlist_id", setlistId);
  if (songNames) query = query.in("song_norm", songNames.map(normalize)); // otherwise: every addition for that concert
  const { error } = await query;
  if (error) throw error;
}

// Makes sure every song you've added (including ones added before this feature existed) has a row
export async function syncAllAdditions(supabase: Supabase, userId: string, concerts: Concert[]) {
  for (const concert of concerts) {
    const added = concert.songs.filter((s) => s.addedByYou);
    await saveAdditions(supabase, userId, concert.id, added);
  }
}

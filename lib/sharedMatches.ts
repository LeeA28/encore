// The shared match table: reading other people's confirmed matches, and adding your own.
// (The database side is supabase/migrations/20261003000000_shared_matches.sql.)

import type { TrackMatch } from "./types";
import { createClient, isSupabaseConfigured } from "./supabase/client";

export type SharedMatch = { match: TrackMatch; votes: number };

// Where a known match came from, in order of priority
export type MatchSource = "spotify" | "yours" | "shared";

// Pure: which already-known track should this song use, if any?
//  1. A track the song came with (songs added from Spotify, in custom lists)
//  2. Your own earlier choice (from this browser's cache): you always get what you picked before
//  3. The shared match, if 2+ people agree on one
// Returns null when the song still needs to be searched.
export function resolveKnownMatch(
  song: { key: string; match?: TrackMatch },
  yours: Record<string, TrackMatch>,
  shared: Record<string, SharedMatch>
): { match: TrackMatch; source: MatchSource; votes?: number } | null {
  if (song.match) return { match: song.match, source: "spotify" };
  if (yours[song.key]) return { match: yours[song.key], source: "yours" };
  const s = shared[song.key];
  if (s) return { match: s.match, source: "shared", votes: s.votes };
  return null;
}

// Asks the database for shared matches. If anything goes wrong (or Supabase isn't set up),
// it just returns none, and those songs are searched as usual: shared matches are a bonus.
export async function fetchSharedMatches(songKeys: string[]): Promise<Record<string, SharedMatch>> {
  const result: Record<string, SharedMatch> = {};
  if (songKeys.length === 0) return result;
  if (!isSupabaseConfigured()) return result; // no Supabase (a guest-only setup): nothing shared to load
  try {
    const supabase = createClient();
    for (let i = 0; i < songKeys.length; i += 200) {
      // .rpc() calls a database function (here, get_shared_matches)
      const { data, error } = await supabase.rpc("get_shared_matches", { song_keys: songKeys.slice(i, i + 200) });
      if (error) throw error;
      for (const row of data ?? []) {
        result[row.song_key] = {
          votes: row.votes,
          match: { id: row.track_id, name: row.track_name, artist: row.track_artist, album: row.track_album ?? undefined },
        };
      }
    }
  } catch (err) {
    console.warn("Couldn't load shared matches; searching Spotify instead.", err);
  }
  return result;
}

// Saves your matches as votes (only when logged in; guests can't vote).
// Upsert: adds new votes, and moves existing ones if you picked a different track this time.
export async function saveMatchVotes(matches: { songKey: string; match: TrackMatch }[]) {
  if (matches.length === 0 || !isSupabaseConfigured()) return;
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return; // a guest
  const userId = data.user.id;

  for (let i = 0; i < matches.length; i += 500) {
    const rows = matches.slice(i, i + 500).map(({ songKey, match }) => ({
      user_id: userId,
      song_key: songKey,
      track_id: match.id,
      track_name: match.name,
      track_artist: match.artist,
      track_album: match.album ?? null,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("match_votes").upsert(rows, { onConflict: "user_id,song_key" });
    if (error) throw error;
  }
}

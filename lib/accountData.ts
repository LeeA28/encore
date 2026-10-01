// Account mode: reading and saving a logged-in user's data in Supabase (Postgres).
// Row Level Security in the database makes sure each user can only reach their own rows.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Concert, CustomList, SavedPlaylist } from "./types";
import { emptyTiers, type Tiers } from "./tiers";
import { tiersAreEmpty, type EncoreData } from "./guestData";

// ---- Converting between the app's shapes and database rows ----

type ConcertRow = {
  setlist_id: string;
  date: string;
  artist: string;
  venue: string;
  city: string;
  country: string | null;
  tour: string | null;
  url: string;
  songs: Concert["songs"];
};

function concertToRow(userId: string, c: Concert) {
  return {
    user_id: userId,
    setlist_id: c.id,
    date: c.date,
    artist: c.artist,
    venue: c.venue,
    city: c.city,
    country: c.country ?? null, // the database uses null for "no value"; the app uses undefined
    tour: c.tour ?? null,
    url: c.url,
    songs: c.songs,
  };
}

function rowToConcert(r: ConcertRow): Concert {
  return {
    id: r.setlist_id,
    date: r.date,
    artist: r.artist,
    venue: r.venue,
    city: r.city,
    country: r.country ?? undefined,
    tour: r.tour ?? undefined,
    url: r.url,
    songs: r.songs,
  };
}

function listToRow(userId: string, l: CustomList) {
  return {
    id: l.id,
    user_id: userId,
    name: l.name,
    items: l.items,
    tiers: l.tiers,
    updated_at: new Date().toISOString(),
  };
}

type PlaylistRow = {
  spotify_id: string;
  name: string;
  url: string;
  track_count: number;
  source: string;
  created_at: string;
};

function playlistToRow(userId: string, p: SavedPlaylist) {
  return {
    user_id: userId,
    spotify_id: p.spotifyId,
    name: p.name,
    url: p.url,
    track_count: p.trackCount,
    source: p.source,
    created_at: p.createdAt,
  };
}

function rowToPlaylist(r: PlaylistRow): SavedPlaylist {
  return {
    spotifyId: r.spotify_id,
    name: r.name,
    url: r.url,
    trackCount: r.track_count,
    source: r.source,
    createdAt: r.created_at,
  };
}

// Supabase returns errors instead of throwing them; this turns them into thrown errors
function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

// ---- Reading ----

export async function loadAccountData(supabase: SupabaseClient): Promise<EncoreData> {
  // Four requests at the same time (Promise.all), instead of one after another
  const [concertRows, tiersRow, listRows, playlistRows] = await Promise.all([
    supabase.from("concerts").select("*").order("added_at"),
    supabase.from("live_tiers").select("tiers").maybeSingle(), // maybeSingle: one row, or null if none
    supabase.from("custom_lists").select("id, name, items, tiers").order("created_at"),
    supabase.from("playlists").select("*").order("created_at", { ascending: false }), // newest first
  ]);

  return {
    concerts: (check(concertRows) as ConcertRow[]).map(rowToConcert),
    liveTiers: (check(tiersRow) as { tiers: Tiers } | null)?.tiers ?? emptyTiers(),
    customLists: check(listRows) as CustomList[],
    playlists: (check(playlistRows) as PlaylistRow[]).map(rowToPlaylist),
  };
}

// ---- Saving ----

export async function saveConcerts(supabase: SupabaseClient, userId: string, concerts: Concert[]) {
  if (concerts.length === 0) return;
  // upsert = insert, but if the row already exists, don't fail. ignoreDuplicates skips existing concerts.
  check(
    await supabase
      .from("concerts")
      .upsert(concerts.map((c) => concertToRow(userId, c)), { onConflict: "user_id,setlist_id", ignoreDuplicates: true })
  );
}

export async function deleteConcert(supabase: SupabaseClient, userId: string, concertId: string) {
  check(await supabase.from("concerts").delete().eq("user_id", userId).eq("setlist_id", concertId));
}

export async function saveLiveTiers(supabase: SupabaseClient, userId: string, tiers: Tiers) {
  check(
    await supabase.from("live_tiers").upsert({ user_id: userId, tiers, updated_at: new Date().toISOString() })
  );
}

export async function saveCustomList(supabase: SupabaseClient, userId: string, list: CustomList) {
  check(await supabase.from("custom_lists").upsert(listToRow(userId, list)));
}

export async function deleteCustomList(supabase: SupabaseClient, listId: string) {
  check(await supabase.from("custom_lists").delete().eq("id", listId));
}

export async function savePlaylists(supabase: SupabaseClient, userId: string, playlists: SavedPlaylist[]) {
  if (playlists.length === 0) return;
  check(
    await supabase
      .from("playlists")
      .upsert(playlists.map((p) => playlistToRow(userId, p)), { onConflict: "user_id,spotify_id", ignoreDuplicates: true })
  );
}

export async function deletePlaylist(supabase: SupabaseClient, userId: string, spotifyId: string) {
  check(await supabase.from("playlists").delete().eq("user_id", userId).eq("spotify_id", spotifyId));
}

// ---- Moving guest data into a new login ----
// Rules, so nothing is lost or doubled:
//  - concerts: combined (concerts the account already has are skipped)
//  - live tiers: the browser's tiers are used only if the account has none yet
//  - custom lists: added alongside the account's lists (same id = same list, so it's never added twice)
export async function mergeGuestData(
  supabase: SupabaseClient,
  userId: string,
  guest: EncoreData,
  account: EncoreData
) {
  await saveConcerts(supabase, userId, guest.concerts);

  if (tiersAreEmpty(account.liveTiers) && !tiersAreEmpty(guest.liveTiers)) {
    await saveLiveTiers(supabase, userId, guest.liveTiers);
  }

  await savePlaylists(supabase, userId, guest.playlists);

  if (guest.customLists.length > 0) {
    check(await supabase.from("custom_lists").upsert(guest.customLists.map((l) => listToRow(userId, l))));
  }
}

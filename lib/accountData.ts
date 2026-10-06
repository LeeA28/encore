// Account mode: reading and saving a logged-in user's data in Supabase (Postgres).
// Row Level Security in the database makes sure each user can only reach their own rows.

import type { Concert, CustomList, SavedList, SavedPlaylist, Song } from "./types";
import { emptyTiers, type Tiers } from "./tiers";
import { tiersAreEmpty, type EncoreData } from "./guestData";
import type { EncoreSupabase, Insert, Json, Row } from "./db";

// ---- Converting between the app's shapes and database rows ----
// The row types (Row<"concerts">, Insert<"concerts">...) come from lib/database.types.ts, which is
// generated from the real database. If a column is renamed or removed, these functions stop compiling.
//
// JSON columns (songs, tiers, items) can hold any JSON, so the database types only know them as `Json`.
// When reading, we tell TypeScript what shape our code stored there ("as unknown as Song[]").

function concertToRow(userId: string, c: Concert): Insert<"concerts"> {
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
    songs: c.songs as unknown as Json,
  };
}

function rowToConcert(r: Row<"concerts">): Concert {
  return {
    id: r.setlist_id,
    date: r.date,
    artist: r.artist,
    venue: r.venue,
    city: r.city,
    country: r.country ?? undefined,
    tour: r.tour ?? undefined,
    url: r.url,
    songs: r.songs as unknown as Song[],
  };
}

function listToRow(userId: string, l: CustomList): Insert<"custom_lists"> {
  return {
    id: l.id,
    user_id: userId,
    name: l.name,
    items: l.items as unknown as Json,
    tiers: l.tiers as unknown as Json,
    updated_at: new Date().toISOString(),
  };
}

function rowToList(r: Pick<Row<"custom_lists">, "id" | "name" | "items" | "tiers">): CustomList {
  return {
    id: r.id,
    name: r.name,
    items: r.items as unknown as CustomList["items"],
    tiers: r.tiers as unknown as CustomList["tiers"],
  };
}

function playlistToRow(userId: string, p: SavedPlaylist): Insert<"playlists"> {
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

function rowToPlaylist(r: Row<"playlists">): SavedPlaylist {
  return {
    spotifyId: r.spotify_id,
    name: r.name,
    url: r.url,
    trackCount: r.track_count,
    source: r.source,
    createdAt: r.created_at,
  };
}

function savedListToRow(userId: string, l: SavedList): Insert<"saved_lists"> {
  return {
    id: l.id,
    user_id: userId,
    name: l.name,
    concert_ids: l.concertIds,
    tiers: l.tiers as unknown as Json,
    updated_at: new Date().toISOString(),
  };
}

function rowToSavedList(r: Pick<Row<"saved_lists">, "id" | "name" | "concert_ids" | "tiers">): SavedList {
  return { id: r.id, name: r.name, concertIds: r.concert_ids, tiers: r.tiers as unknown as SavedList["tiers"] };
}

// Supabase returns errors instead of throwing them; this turns them into thrown errors
function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

// ---- Reading ----

export async function loadAccountData(supabase: EncoreSupabase): Promise<EncoreData> {
  // Five requests at the same time (Promise.all), instead of one after another
  const [concertRows, tiersRow, listRows, playlistRows, savedListRows] = await Promise.all([
    supabase.from("concerts").select("*").order("added_at"),
    supabase.from("live_tiers").select("tiers").maybeSingle(), // maybeSingle: one row, or null if none
    supabase.from("custom_lists").select("id, name, items, tiers").order("created_at"),
    supabase.from("playlists").select("*").order("created_at", { ascending: false }), // newest first
    supabase.from("saved_lists").select("id, name, concert_ids, tiers").order("created_at"),
  ]);

  // No more "as ConcertRow[]": Supabase knows each table's row type, so the results are already typed
  return {
    // "?? []": the types say a failed read could give null, so treat that as an empty list
    concerts: (check(concertRows) ?? []).map(rowToConcert),
    liveTiers: (check(tiersRow)?.tiers as unknown as Tiers | undefined) ?? emptyTiers(),
    customLists: (check(listRows) ?? []).map(rowToList),
    playlists: (check(playlistRows) ?? []).map(rowToPlaylist),
    savedLists: (check(savedListRows) ?? []).map(rowToSavedList),
  };
}

// ---- Saving ----

export async function saveConcerts(supabase: EncoreSupabase, userId: string, concerts: Concert[]) {
  if (concerts.length === 0) return;
  // upsert = insert, but if the row already exists, don't fail. ignoreDuplicates skips existing concerts.
  check(
    await supabase
      .from("concerts")
      .upsert(concerts.map((c) => concertToRow(userId, c)), { onConflict: "user_id,setlist_id", ignoreDuplicates: true })
  );
}

// Replaces a concert's song list (used when you add or remove a song yourself)
export async function updateConcertSongs(supabase: EncoreSupabase, userId: string, concert: Concert) {
  check(
    await supabase
      .from("concerts")
      .update({ songs: concert.songs as unknown as Json })
      .eq("user_id", userId)
      .eq("setlist_id", concert.id)
  );
}

export async function deleteConcert(supabase: EncoreSupabase, userId: string, concertId: string) {
  check(await supabase.from("concerts").delete().eq("user_id", userId).eq("setlist_id", concertId));
}

export async function saveLiveTiers(supabase: EncoreSupabase, userId: string, tiers: Tiers) {
  check(
    await supabase
      .from("live_tiers")
      .upsert({ user_id: userId, tiers: tiers as unknown as Json, updated_at: new Date().toISOString() })
  );
}

export async function saveCustomList(supabase: EncoreSupabase, userId: string, list: CustomList) {
  check(await supabase.from("custom_lists").upsert(listToRow(userId, list)));
}

export async function deleteCustomList(supabase: EncoreSupabase, listId: string) {
  check(await supabase.from("custom_lists").delete().eq("id", listId));
}

export async function savePlaylists(supabase: EncoreSupabase, userId: string, playlists: SavedPlaylist[]) {
  if (playlists.length === 0) return;
  check(
    await supabase
      .from("playlists")
      .upsert(playlists.map((p) => playlistToRow(userId, p)), { onConflict: "user_id,spotify_id", ignoreDuplicates: true })
  );
}

export async function saveSavedList(supabase: EncoreSupabase, userId: string, list: SavedList) {
  check(await supabase.from("saved_lists").upsert(savedListToRow(userId, list)));
}

export async function deleteSavedList(supabase: EncoreSupabase, listId: string) {
  check(await supabase.from("saved_lists").delete().eq("id", listId));
}

export async function deletePlaylist(supabase: EncoreSupabase, userId: string, spotifyId: string) {
  check(await supabase.from("playlists").delete().eq("user_id", userId).eq("spotify_id", spotifyId));
}

// ---- Moving guest data into a new login ----
// Rules, so nothing is lost or doubled:
//  - concerts: combined (concerts the account already has are skipped)
//  - live tiers: the browser's tiers are used only if the account has none yet
//  - custom lists: added alongside the account's lists (same id = same list, so it's never added twice)
export async function mergeGuestData(
  supabase: EncoreSupabase,
  userId: string,
  guest: EncoreData,
  account: EncoreData
) {
  await saveConcerts(supabase, userId, guest.concerts);

  if (tiersAreEmpty(account.liveTiers) && !tiersAreEmpty(guest.liveTiers)) {
    await saveLiveTiers(supabase, userId, guest.liveTiers);
  }

  await savePlaylists(supabase, userId, guest.playlists);

  // Saved lists: copied with the same ids, so running the merge twice can't duplicate them
  if (guest.savedLists.length > 0) {
    check(await supabase.from("saved_lists").upsert(guest.savedLists.map((l) => savedListToRow(userId, l))));
  }

  if (guest.customLists.length > 0) {
    check(await supabase.from("custom_lists").upsert(guest.customLists.map((l) => listToRow(userId, l))));
  }
}

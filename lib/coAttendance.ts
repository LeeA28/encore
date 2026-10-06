// "People who saw the same shows also saw...": collaborative filtering from Encore's own users.
// Database side: get_co_attended_artists in supabase/migrations/20261006000200_co_attendance.sql

import { createClient } from "./supabase/client";
import { normalize } from "./songs";
import { splitCollaboration, type TasteProfile } from "./recommend";

export type CoAttendedArtist = { artist: string; people: number };

// Asks the database. If anything goes wrong (or Supabase isn't set up), there are simply none.
export async function fetchCoAttended(setlistIds: string[]): Promise<CoAttendedArtist[]> {
  if (setlistIds.length === 0) return [];
  try {
    const { data, error } = await createClient().rpc("get_co_attended_artists", { setlist_ids: setlistIds });
    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.warn("Couldn't load what fans at your shows also saw.", err);
    return [];
  }
}

// Pure: leave out artists you already know (including collaborations that include them)
export function newToYou(rows: CoAttendedArtist[], profile: TasteProfile, limit = 10): CoAttendedArtist[] {
  const known = (name: string) => profile.has(normalize(name));
  return rows.filter((r) => !known(r.artist) && !splitCollaboration(r.artist).some(known)).slice(0, limit);
}

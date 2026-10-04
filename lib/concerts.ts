// Pure functions: data in, data out. No API calls, no state, no side effects.
// That makes them predictable, and easy to test with made-up data.

import type { Concert, Song } from "./types";
import type { SetlistFmSetlist, SetlistFmSong } from "./setlistfm";
import { splitMedley } from "./songs";

// "14-03-2025" (setlist.fm's format) -> "2025-03-14"
// Year-first dates sort correctly as plain text, so newest-first sorting just works.
export function toIsoDate(setlistFmDate: string): string {
  const [day, month, year] = setlistFmDate.split("-");
  return `${year}-${month}-${day}`;
}

// "2025-03-14" -> "Mar 14, 2025"
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  // Build the date from its parts, in local time. (new Date("2025-03-14") would be read as
  // midnight UTC, which in Toronto is still the evening of Mar 13, so it would show the wrong day.)
  const date = new Date(year, month - 1, day); // months count from 0 in JavaScript, so March is 2
  return date.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

// "Toronto, Canada" (skipping any parts that are missing)
export function formatCity(c: Concert): string {
  return [c.city, c.country].filter(Boolean).join(", ");
}

// "Danforth Music Hall, Toronto, Canada" (skipping any parts that are missing)
export function formatPlace(c: Concert): string {
  return [c.venue, c.city, c.country].filter(Boolean).join(", ");
}

// The original artists listed in a song's notes. setlist.fm writes medleys of covers like
// "Cover of (in order): The Chi-Lites, Harold Melvin & The BlueNotes, The Stylistics, Roger Troutman".
// Returns [] when the notes don't say it's a cover.
export function parseCoverInfo(info: string | undefined): string[] {
  const match = info?.match(/^\s*cover of(?:\s*\(in order\))?\s*:?\s*(.+?)\s*$/i);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((artist) => artist.trim())
    .filter((artist) => artist !== "");
}

// Who each part of a song covers. For a medley, the artists are paired with the parts in order,
// but only when the counts match, since a mismatch means the list can't be trusted.
// Known limitation: a comma inside an artist's name ("Earth, Wind & Fire") can still fool the count.
// That's tolerable because matching only auto-accepts a track whose artist really matches on Spotify,
// so a wrong pairing can make a song "not found", but never pick the wrong song.
// A single cover artist applies to every part.
export function coverArtists(song: SetlistFmSong): { coverOf?: string; coverOfEach?: string[] } {
  const listed = parseCoverInfo(song.info);
  const parts = splitMedley(song.name);
  if (parts.length > 1 && listed.length === parts.length) return { coverOfEach: listed };
  const single = song.cover?.name ?? (listed.length === 1 ? listed[0] : undefined);
  return single ? { coverOf: single } : {};
}

// Turns one raw setlist.fm setlist into Encore's simpler Concert shape
export function toConcert(s: SetlistFmSetlist): Concert {
  const songs: Song[] = s.sets.set
    .flatMap((set) => set.song ?? []) // join the main set and encores into one list
    .filter((song) => !song.tape && song.name.trim() !== "") // skip intro tapes and blank entries
    .map((song) => ({ name: song.name.trim(), ...coverArtists(song) }));

  return {
    id: s.id,
    date: toIsoDate(s.eventDate),
    artist: s.artist.name,
    venue: s.venue.name,
    city: s.venue.city?.name ?? "", // "?." stops safely if city is missing, then "??" gives ""
    country: s.venue.city?.country?.name,
    tour: s.tour?.name,
    url: s.url,
    songs,
  };
}

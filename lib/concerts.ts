// Pure functions: data in, data out. No API calls, no state, no side effects.
// That makes them predictable, and easy to test with made-up data.

import type { Concert, Song } from "./types";
import type { SetlistFmSetlist } from "./setlistfm";

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

// Turns one raw setlist.fm setlist into Encore's simpler Concert shape
export function toConcert(s: SetlistFmSetlist): Concert {
  const songs: Song[] = s.sets.set
    .flatMap((set) => set.song ?? []) // join the main set and encores into one list
    .filter((song) => !song.tape && song.name.trim() !== "") // skip intro tapes and blank entries
    .map((song) => ({ name: song.name.trim(), coverOf: song.cover?.name }));

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

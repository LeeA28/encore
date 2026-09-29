// Pure functions for counting songs across your concerts.

import type { Concert, SongCount } from "./types";

// Makes small differences disappear, so the same song typed two ways counts as one:
// "Don't Stop" and "dont  stop" both become "dont stop"
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "") // remove apostrophes (both the straight ' and curly ’ kinds)
    .replace(/\s+/g, " ") // collapse repeated spaces into one
    .trim();
}

// A stable id for a song. It includes the artist, so two bands' songs called "Home" stay separate.
export function songKey(artist: string, song: string): string {
  return `${normalize(artist)}|${normalize(song)}`;
}

// Goes through every song at every concert and counts how many concerts each one was played at.
// Returns the list sorted from most heard to least heard.
export function countSongs(concerts: Concert[]): SongCount[] {
  // A Map is like an object built for lookups: key -> value. Here, songKey -> that song's count.
  const counts = new Map<string, SongCount>();

  for (const concert of concerts) {
    for (const song of concert.songs) {
      const key = songKey(concert.artist, song.name);

      // Get the existing entry, or start a new one at zero ("??" = "if missing, use this instead")
      const entry = counts.get(key) ?? {
        key,
        name: song.name,
        artist: concert.artist,
        coverOf: song.coverOf,
        timesHeard: 0,
        concertIds: [],
      };

      // Count each concert only once, so a song played twice in one show (a reprise) counts as 1
      if (!entry.concertIds.includes(concert.id)) {
        entry.concertIds.push(concert.id);
        entry.timesHeard++;
      }
      counts.set(key, entry);
    }
  }

  // Most heard first; songs with the same count are sorted alphabetically
  return [...counts.values()].sort(
    (a, b) => b.timesHeard - a.timesHeard || a.name.localeCompare(b.name)
  );
}

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

// Medleys: setlist.fm lists songs played back-to-back as one entry, separated by " / ", like
// "It Will Rain / Talking to the Moon / When I Was Your Man". Spotify has each song, but not the
// combination, so medleys are split into separate songs before counting.
// Only " / " with spaces around it counts, so titles like "Face/Off" stay whole.
export function splitMedley(name: string): string[] {
  const parts = name
    .split(" / ")
    .map((part) => part.trim())
    .filter((part) => part !== "");
  return parts.length > 0 ? parts : [name];
}

// Goes through every song at every concert and counts how many concerts each one was played at.
// Returns the list sorted from most heard to least heard.
export function countSongs(concerts: Concert[]): SongCount[] {
  // A Map is like an object built for lookups: key -> value. Here, songKey -> that song's count.
  const counts = new Map<string, SongCount>();

  for (const concert of concerts) {
    // Split medleys here (not when saving concerts), so concerts saved earlier benefit too.
    // Songs you added yourself are never split: you typed or picked exactly one song.
    // Each part of a medley of covers gets its own original artist (coverOfEach), if setlist.fm listed them.
    const songs = concert.songs.flatMap((song) =>
      song.addedByYou
        ? [song]
        : splitMedley(song.name).map((name, i) => ({ ...song, name, coverOf: song.coverOfEach?.[i] ?? song.coverOf }))
    );
    for (const song of songs) {
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
      // Remember a known Spotify track for this song, if any concert has one (from a song you added)
      if (!entry.spotifyId && song.spotifyId) entry.spotifyId = song.spotifyId;

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

// Playlist order for songs heard live: grouped by artist, each artist's songs from most to least heard.
// Artists are ordered by their most-heard song (ties: more total plays first, then alphabetical).
//
// Example:  A by X ×6, E by Y ×5, F by Y ×4, B by X ×3, C by X ×2, D by X ×1
// becomes:  A, B, C, D (artist X, whose top song has 6), then E, F (artist Y, whose top song has 5)
export function groupByArtist(songs: SongCount[]): SongCount[] {
  const groups = new Map<string, SongCount[]>();
  for (const song of songs) {
    const artist = normalize(song.artist);
    groups.set(artist, [...(groups.get(artist) ?? []), song]);
  }

  const sortedGroups = [...groups.values()].map((group) =>
    [...group].sort((a, b) => b.timesHeard - a.timesHeard || a.name.localeCompare(b.name))
  );

  const top = (group: SongCount[]) => group[0].timesHeard; // the group is sorted, so its first song is the most heard
  const total = (group: SongCount[]) => group.reduce((sum, s) => sum + s.timesHeard, 0);

  sortedGroups.sort(
    (a, b) => top(b) - top(a) || total(b) - total(a) || a[0].artist.localeCompare(b[0].artist)
  );
  return sortedGroups.flat(); // join the groups back into one list
}

// ---- Adding songs that setlist.fm's setlist is missing (like a secret song) ----

// Pure: adds a song to a concert, unless that song is already in its setlist.
// Returns the updated concert, or an error message to show instead.
// If the track is by a different artist than the one performing, it's recorded as a cover of that artist.
export function addSongToConcert(
  concert: Concert,
  song: { name: string; artist?: string; spotifyId?: string }
): { concert: Concert } | { error: string } {
  const name = song.name.trim();
  if (!name) return { error: "Enter a song name." };

  const alreadyThere = concert.songs.some((s) =>
    splitMedley(s.name).some((part) => normalize(part) === normalize(name))
  );
  if (alreadyThere) return { error: `"${name}" is already in this setlist.` };

  const isCover = song.artist !== undefined && normalize(song.artist) !== normalize(concert.artist);
  const added: Concert["songs"][number] = {
    name,
    addedByYou: true,
    ...(song.spotifyId ? { spotifyId: song.spotifyId } : {}),
    ...(isCover ? { coverOf: song.artist } : {}),
  };
  return { concert: { ...concert, songs: [...concert.songs, added] } }; // a new concert object, never mutated
}

// Pure: removes a song you added (songs from setlist.fm can't be removed)
export function removeAddedSong(concert: Concert, songName: string): Concert {
  return {
    ...concert,
    songs: concert.songs.filter((s) => !(s.addedByYou && s.name === songName)),
  };
}

// Pure: the concerts where a song was played (including inside a medley, or added by you), newest first
export function concertsForSong(songKeyToFind: string, concerts: Concert[]): Concert[] {
  const song = countSongs(concerts).find((s) => s.key === songKeyToFind);
  if (!song) return [];
  const ids = new Set(song.concertIds);
  return concerts.filter((c) => ids.has(c.id)).sort((a, b) => b.date.localeCompare(a.date));
}

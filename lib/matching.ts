// Pure functions for matching a song heard live to the right Spotify track.
//
// The idea: search Spotify a few different ways, give every result a score for how well it fits,
// and pick the best. A good match needs the same title (after cleaning) AND the right artist.

import type { SpotifyTrack } from "./spotify";
import type { TrackMatch } from "./types";
import { normalize } from "./songs";
import { cleanTitle } from "./music";

export type SongToMatch = {
  key: string;
  name: string;
  artist: string; // who performed it live
  coverOf?: string; // original artist, if it was a cover
};

// Versions we'd rather not put in the playlist, unless the song's own name asks for them
const UNWANTED_VERSION =
  /\b(live|karaoke|instrumental|remix|demo|tribute|acapella|a cappella|8-bit|lullaby|sped up|slowed|reverb)\b/i;

export const GOOD_SCORE = 70; // right title + right artist: accept automatically
export const GREAT_SCORE = 90; // exact title + performing artist + normal version: stop searching

// Different ways to search, from most to least precise.
// track:"..." artist:"..." are Spotify search filters that look in only that field.
export function buildQueries(song: SongToMatch): string[] {
  const clean = (text: string) => text.replace(/"/g, "").trim(); // quotes would break the filter syntax
  const queries = [`track:"${clean(song.name)}" artist:"${clean(song.artist)}"`];
  if (song.coverOf) {
    // A cover: the performing artist may not have recorded it, so also try the original artist
    queries.push(`track:"${clean(song.name)}" artist:"${clean(song.coverOf)}"`);
  }
  queries.push(`${clean(song.name)} ${clean(song.artist)}`); // loose search, as a last resort
  return queries;
}

// How well does this Spotify track fit the song? Higher is better; 0 means "not this song".
export function scoreTrack(song: SongToMatch, track: Pick<SpotifyTrack, "name" | "artists">): number {
  const wanted = normalize(cleanTitle(song.name));
  const found = normalize(cleanTitle(track.name));

  let score: number;
  if (found === wanted) score = 50; // same title
  else if (found.startsWith(wanted) || wanted.startsWith(found)) score = 20; // e.g. "Song" vs "Song, Pt. 1"
  else return 0; // different title: never the right song

  const artists = track.artists.map((a) => normalize(a.name));
  if (artists.includes(normalize(song.artist))) score += 40; // the artist you saw
  else if (song.coverOf && artists.includes(normalize(song.coverOf))) score += 30; // the original artist

  // A live/remix/karaoke version, when the song itself isn't one: less likely to be what you want
  if (UNWANTED_VERSION.test(track.name) && !UNWANTED_VERSION.test(song.name)) score -= 30;

  return score;
}

export function toTrackMatch(track: SpotifyTrack): TrackMatch {
  return {
    id: track.id,
    name: track.name,
    artist: track.artists.map((a) => a.name).join(", "),
    album: track.album?.name,
  };
}

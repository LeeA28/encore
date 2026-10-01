// Remembers which Spotify track each song was matched to, so a song is only searched once.
// It's only a cache: if it's lost, songs just get searched again. So the browser is a fine place for it.

import type { TrackMatch } from "./types";
import { readLocal, writeLocal } from "./guestData";

const KEY = "encore:matchCache";

export function getCachedMatches(): Record<string, TrackMatch> {
  return readLocal<Record<string, TrackMatch>>(KEY, {});
}

export function cacheMatches(matches: Record<string, TrackMatch>) {
  writeLocal(KEY, { ...getCachedMatches(), ...matches });
}

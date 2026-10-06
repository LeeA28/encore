// Remembering an unfinished playlist across the trip to Spotify's login page.
//
// Connecting Spotify sends you to Spotify's site and back, which reloads Encore and loses whatever
// was on screen. So before leaving, the playlist builder saves what it was making (its PlaylistSource);
// when you return, the matching part of the page reopens the builder exactly as it was.
//
// sessionStorage (not localStorage) is used on purpose: it belongs to this one browser tab and
// disappears when the tab closes, which is exactly how long this note should live.

import type { PlaylistSource } from "./types";

const KEY = "encore:resumePlaylist";

export function saveResume(source: PlaylistSource) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(source));
  } catch {}
}

// Look without removing (safe to call while rendering, even when React calls things twice in development)
export function peekResume(): PlaylistSource | null {
  try {
    const saved = sessionStorage.getItem(KEY);
    return saved ? (JSON.parse(saved) as PlaylistSource) : null;
  } catch {
    return null;
  }
}

// Remove it once the builder has reopened, so it only happens once
export function clearResume() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}

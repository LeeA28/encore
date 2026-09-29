// Pure functions for turning Spotify tracks into rankable items, and removing duplicates.

import type { RankItem } from "./types";
import { songKey } from "./songs";

// Removes version labels so the same song from different releases matches:
//   "Karma Police - 2017 Remaster" -> "Karma Police"
//   "Creep (Live at Glastonbury)" -> "Creep"
//   "Song (feat. Someone)"         -> "Song"
// Labels like "Remix" and "Acoustic" are kept, since those can feel like different songs.
// \b means "word boundary", so "live" matches "Live" but not "Alive"
const VERSION_WORDS =
  /\b(remaster|remastered|\d{4} remaster|live|mono|stereo|deluxe|bonus track|single version|album version|radio edit|feat|featuring|with)\b/i;

export function cleanTitle(title: string): string {
  let clean = title;
  // " - 2011 Remaster" style: text after " - " that contains a version word
  clean = clean.replace(/\s+-\s+(.*)$/, (whole, rest) => (VERSION_WORDS.test(rest) ? "" : whole));
  // "(Live)" or "[Remastered]" style: brackets containing a version word
  clean = clean.replace(/\s*[([]([^)\]]*)[)\]]/g, (whole, inside) => (VERSION_WORDS.test(inside) ? "" : whole));
  return clean.trim() || title.trim(); // never return an empty title
}

export function toRankItem(
  track: { id: string; name: string; artists: { name: string }[] },
  albumName?: string
): RankItem {
  const name = cleanTitle(track.name);
  const artist = track.artists[0]?.name ?? "Unknown artist"; // the main (first-listed) artist
  return { key: songKey(artist, name), name, artist, detail: albumName, spotifyId: track.id };
}

// Keeps only the first item for each key. Since discographies are sorted oldest first,
// the original release wins over later remasters and deluxe editions.
export function dedupeItems(items: RankItem[]): RankItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

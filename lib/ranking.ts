// Beli-style ranking: pick a tier, then place the song with "which do you like more?" questions.
// Under the hood it's binary insertion: each answer cuts the remaining possible positions in half.

export type Tier = "loved" | "fine" | "disliked"; // a "union type": only these three strings are allowed
export const TIERS: Tier[] = ["loved", "fine", "disliked"];

// Each tier is an ordered list of song keys, best first
export type Rankings = Record<Tier, string[]>; // Record<K, V> = an object with keys K and values V
export const emptyRankings = (): Rankings => ({ loved: [], fine: [], disliked: [] });

// A placement in progress: the new song belongs somewhere between positions lo and hi of its tier
export type Placement = { songKey: string; tier: Tier; lo: number; hi: number };

// At the start, the song could go anywhere in the tier: from position 0 up to the end
export function startPlacement(rankings: Rankings, songKey: string, tier: Tier): Placement {
  return { songKey, tier, lo: 0, hi: rankings[tier].length };
}

// The song to compare against: the middle of the remaining range
export function opponentIndex(p: Placement): number {
  return Math.floor((p.lo + p.hi) / 2);
}

// Once lo and hi meet, only one position is left, so we know exactly where the song goes
export function isDone(p: Placement): boolean {
  return p.lo >= p.hi;
}

// preferNew = true if the user likes the new song more than the one it was compared to
export function answer(p: Placement, preferNew: boolean): Placement {
  const mid = opponentIndex(p);
  // Liked it more: it goes above the middle song, so the bottom half is ruled out.
  // Liked it less: it goes below the middle song, so the top half is ruled out.
  return preferNew ? { ...p, hi: mid } : { ...p, lo: mid + 1 };
}

// Put the song into its final position (a new object and new array, never mutating the old ones)
export function insert(rankings: Rankings, p: Placement): Rankings {
  const list = [...rankings[p.tier]];
  list.splice(p.lo, 0, p.songKey); // splice(position, 0, item) inserts item at position
  return { ...rankings, [p.tier]: list };
}

export function removeSong(rankings: Rankings, songKey: string): Rankings {
  return {
    loved: rankings.loved.filter((k) => k !== songKey),
    fine: rankings.fine.filter((k) => k !== songKey),
    disliked: rankings.disliked.filter((k) => k !== songKey),
  };
}

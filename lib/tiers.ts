// Pure functions for the S/A/B/C/D tier list and the optional "Sort this tier" questions.

import type { RankItem } from "./types";

export const TIER_NAMES = ["S", "A", "B", "C", "D"] as const; // "as const" = exactly these values, in this order
export type TierName = (typeof TIER_NAMES)[number]; // "S" | "A" | "B" | "C" | "D"
export type Tiers = Record<TierName, string[]>; // each tier: an ordered list of song keys, best first

// Every place a song can be: unranked, or one of the tiers
export type ContainerId = "unranked" | TierName;
export type Board = Record<ContainerId, string[]>;

export const emptyTiers = (): Tiers => ({ S: [], A: [], B: [], C: [], D: [] });

// Builds the full board: songs in tiers stay where they are, and every other song is "unranked".
// Keys for songs that no longer exist (e.g. from a removed concert) are dropped.
export function buildBoard(items: RankItem[], tiers: Tiers): Board {
  const valid = new Set(items.map((i) => i.key));
  const board = { unranked: [] } as unknown as Board;
  const placed = new Set<string>();
  for (const tier of TIER_NAMES) {
    board[tier] = (tiers[tier] ?? []).filter((key) => valid.has(key) && !placed.has(key));
    board[tier].forEach((key) => placed.add(key));
  }
  board.unranked = items.map((i) => i.key).filter((key) => !placed.has(key));
  return board;
}

// The saved part of a board: just the tiers (unranked is always recalculated)
export function boardToTiers(board: Board): Tiers {
  return { S: board.S, A: board.A, B: board.B, C: board.C, D: board.D };
}

export function removeFromTiers(tiers: Tiers, key: string): Tiers {
  const next = emptyTiers();
  for (const tier of TIER_NAMES) next[tier] = (tiers[tier] ?? []).filter((k) => k !== key);
  return next;
}

// Moves a song to the bottom of a tier (used by the quick S/A/B/C/D buttons)
export function moveToTier(tiers: Tiers, key: string, tier: TierName): Tiers {
  const next = removeFromTiers(tiers, key);
  next[tier] = [...next[tier], key];
  return next;
}

// ---------------------------------------------------------------------------------------
// "Sort this tier": binary insertion with "which do you like more?" questions.
// Songs are placed one at a time into a growing sorted list. Each answer halves the range
// of positions (lo to hi) where the current song could go, until only one position is left.
// ---------------------------------------------------------------------------------------

export type SortSession = {
  tier: TierName;
  sorted: string[]; // songs already placed, best first
  pending: string[]; // songs still waiting to be placed
  current: string; // the song being placed right now
  lo: number;
  hi: number;
};

export type SortChoice = "current" | "opponent" | "tie";

// Take the next pending song and start placing it (it could go anywhere: positions 0 to sorted.length)
function nextSong(tier: TierName, sorted: string[], pending: string[]): SortSession | string[] {
  if (pending.length === 0) return sorted; // everything placed: return the finished order
  const [current, ...rest] = pending;
  return { tier, sorted, pending: rest, current, lo: 0, hi: sorted.length };
}

// Returns a session, or null if the tier has fewer than 2 songs (nothing to sort)
export function startSort(tier: TierName, keys: string[]): SortSession | null {
  if (keys.length < 2) return null;
  // The first song starts the sorted list; every other song gets placed by questions
  return nextSong(tier, [keys[0]], keys.slice(1)) as SortSession;
}

// The song to compare against: the middle of the remaining range
export function opponentOf(s: SortSession): string {
  return s.sorted[Math.floor((s.lo + s.hi) / 2)];
}

// Apply one answer. Returns the updated session, or the finished order (an array) when done.
export function answerSort(s: SortSession, choice: SortChoice): SortSession | string[] {
  const mid = Math.floor((s.lo + s.hi) / 2);

  let lo = s.lo;
  let hi = s.hi;
  if (choice === "tie") {
    lo = hi = mid + 1; // "too close to call": place it right below the song it was compared to
  } else if (choice === "current") {
    hi = mid; // liked the new song more: it goes above the middle song
  } else {
    lo = mid + 1; // liked it less: it goes below the middle song
  }

  if (lo < hi) return { ...s, lo, hi }; // still more than one possible position: ask again

  // One position left: insert the song there, then move on to the next song
  const sorted = [...s.sorted];
  sorted.splice(lo, 0, s.current);
  return nextSong(s.tier, sorted, s.pending);
}

// Each tier's solid color (defined as CSS variables in globals.css)
export const TIER_COLORS: Record<TierName, string> = {
  S: "var(--red)",
  A: "var(--orange)",
  B: "var(--yellow)",
  C: "var(--green)",
  D: "var(--indigo)",
};

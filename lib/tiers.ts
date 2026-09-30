// Pure functions for the S/A/B/C/D tier list.

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

// Each tier's solid color (defined as CSS variables in globals.css)
export const TIER_COLORS: Record<TierName, string> = {
  S: "var(--red)",
  A: "var(--orange)",
  B: "var(--yellow)",
  C: "var(--green)",
  D: "var(--indigo)",
};

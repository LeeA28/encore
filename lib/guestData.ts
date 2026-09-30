// Guest mode: when nobody is logged in, everything is saved in this browser's localStorage.

import type { Concert, CustomList } from "./types";
import { emptyTiers, TIER_NAMES, type Tiers } from "./tiers";

export const GUEST_KEYS = {
  concerts: "encore:concerts",
  liveTiers: "encore:liveTiers",
  customLists: "encore:customLists",
};

export type EncoreData = {
  concerts: Concert[];
  liveTiers: Tiers;
  customLists: CustomList[];
};

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback; // broken JSON or blocked storage: start fresh
  }
}

export function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked: nothing we can do
  }
}

export function readGuestData(): EncoreData {
  return {
    concerts: readLocal<Concert[]>(GUEST_KEYS.concerts, []),
    liveTiers: readLocal<Tiers>(GUEST_KEYS.liveTiers, emptyTiers()),
    customLists: readLocal<CustomList[]>(GUEST_KEYS.customLists, []),
  };
}

export function clearGuestData() {
  Object.values(GUEST_KEYS).forEach((key) => localStorage.removeItem(key));
}

export function tiersAreEmpty(tiers: Tiers): boolean {
  return TIER_NAMES.every((t) => (tiers[t] ?? []).length === 0);
}

export function hasGuestData(data: EncoreData): boolean {
  return data.concerts.length > 0 || data.customLists.length > 0 || !tiersAreEmpty(data.liveTiers);
}

// Pure functions for saved lists (named groups of concerts you picked)

import type { Concert, SavedList } from "./types";

// The concerts in a list, newest first. Concerts that no longer exist are simply skipped.
export function concertsInList(list: SavedList, concerts: Concert[]): Concert[] {
  const ids = new Set(list.concertIds);
  return concerts.filter((c) => ids.has(c.id)).sort((a, b) => b.date.localeCompare(a.date));
}

// When a concert is removed from Your concerts, it leaves every list it was in.
// Returns only the lists that changed (so only those need saving).
export function removeConcertFromLists(lists: SavedList[], concertId: string): SavedList[] {
  return lists
    .filter((l) => l.concertIds.includes(concertId))
    .map((l) => ({ ...l, concertIds: l.concertIds.filter((id) => id !== concertId) }));
}

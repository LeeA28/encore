// Tests for saved lists (lib/savedLists.ts)

import { describe, expect, it } from "vitest";
import { concertsInList, removeConcertFromLists } from "./savedLists";
import { emptyTiers } from "./tiers";
import type { Concert, SavedList } from "./types";

const concert = (id: string, date: string): Concert => ({
  id,
  date,
  artist: "Band",
  venue: "",
  city: "",
  url: "",
  songs: [],
});
const list = (id: string, concertIds: string[]): SavedList => ({ id, name: id, concertIds, tiers: emptyTiers() });

describe("concertsInList", () => {
  it("returns a list's concerts, newest first, skipping ones that no longer exist", () => {
    const concerts = [concert("a", "2025-05-01"), concert("b", "2026-03-01"), concert("c", "2026-08-01")];
    expect(concertsInList(list("2026", ["b", "c", "gone"]), concerts).map((c) => c.id)).toEqual(["c", "b"]);
  });
});

describe("removeConcertFromLists", () => {
  it("removes the concert from every list containing it, and only returns lists that changed", () => {
    // Lists can overlap: concert "a" is in both
    const changed = removeConcertFromLists([list("one", ["a", "b"]), list("two", ["a", "d"]), list("three", ["e"])], "a");
    expect(changed.map((l) => [l.id, l.concertIds])).toEqual([
      ["one", ["b"]],
      ["two", ["d"]],
    ]);
  });
});

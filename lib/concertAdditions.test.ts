// Tests for shared song additions (lib/concertAdditions.ts)

import { describe, expect, it } from "vitest";
import { diffAddedSongs, newSuggestions } from "./concertAdditions";
import type { Concert } from "./types";

const show = (songs: Concert["songs"]): Concert => ({
  id: "show1",
  date: "2026-08-22",
  artist: "5 Seconds of Summer",
  venue: "",
  city: "",
  url: "",
  songs,
});

describe("newSuggestions", () => {
  it("only suggests songs that aren't already in your setlist (including inside medleys)", () => {
    const concert = show([{ name: "Amnesia" }, { name: "Easier / Teeth" }]);
    const suggestions = newSuggestions(concert, [
      { songName: "Secret Song", people: 2 },
      { songName: "amnesia", people: 1 },
      { songName: "Teeth", people: 1 },
    ]);
    expect(suggestions.map((s) => s.songName)).toEqual(["Secret Song"]);
  });
});

describe("diffAddedSongs", () => {
  it("finds songs you added and removed, ignoring songs from setlist.fm", () => {
    const before = show([{ name: "Hit" }, { name: "Old Extra", addedByYou: true }]);
    const after = show([{ name: "Hit" }, { name: "New Extra", addedByYou: true, spotifyId: "t1" }]);
    const diff = diffAddedSongs(before, after);
    expect(diff.added.map((s) => s.name)).toEqual(["New Extra"]);
    expect(diff.removed).toEqual(["Old Extra"]);
  });
});

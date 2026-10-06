// Tests for the tier list logic (lib/tiers.ts)

import { describe, expect, it } from "vitest";
import { buildBoard, emptyTiers, mergeFilteredTiers, moveToTier, removeFromTiers } from "./tiers";

const items = ["a", "b", "c", "d"].map((key) => ({ key, name: key, artist: "Band" }));

describe("buildBoard", () => {
  it("puts every song that isn't in a tier into Unranked", () => {
    const board = buildBoard(items, { ...emptyTiers(), S: ["c"], A: ["a"] });
    expect(board.unranked).toEqual(["b", "d"]);
    expect(board.S).toEqual(["c"]);
  });

  it("drops songs that no longer exist (like from a removed concert)", () => {
    const board = buildBoard(items, { ...emptyTiers(), S: ["gone", "a"] });
    expect(board.S).toEqual(["a"]);
  });

  it("never shows a song in two tiers at once", () => {
    const board = buildBoard(items, { ...emptyTiers(), S: ["a"], A: ["a", "b"] });
    expect(board.S).toEqual(["a"]);
    expect(board.A).toEqual(["b"]);
  });
});

describe("moveToTier", () => {
  it("moves a song to the bottom of another tier", () => {
    const tiers = moveToTier({ ...emptyTiers(), S: ["a"], A: ["b"] }, "a", "A");
    expect(tiers.S).toEqual([]);
    expect(tiers.A).toEqual(["b", "a"]);
  });

  it("doesn't change the original (state is never mutated)", () => {
    const original = { ...emptyTiers(), S: ["a"] };
    moveToTier(original, "a", "B");
    expect(original.S).toEqual(["a"]);
  });
});

describe("removeFromTiers", () => {
  it("removes a song from whichever tier it's in", () => {
    expect(removeFromTiers({ ...emptyTiers(), C: ["a", "b"] }, "a").C).toEqual(["b"]);
  });
});

describe("mergeFilteredTiers (ranking one artist at a time)", () => {
  // x1, x2 are by the artist being shown; o1, o2 are by other artists (hidden)
  const visible = new Set(["x1", "x2", "x3"]);
  const full = { ...emptyTiers(), S: ["o1", "x1", "o2", "x2"], A: ["x3"] };

  it("keeps hidden songs exactly where they were when visible ones are reordered", () => {
    const filtered = { ...emptyTiers(), S: ["x2", "x1"], A: ["x3"] }; // swapped x1 and x2
    expect(mergeFilteredTiers(full, filtered, visible).S).toEqual(["o1", "x2", "o2", "x1"]);
  });

  it("moves a visible song between tiers without touching hidden ones", () => {
    const filtered = { ...emptyTiers(), S: ["x1", "x2", "x3"], A: [] }; // x3 moved up to S
    const merged = mergeFilteredTiers(full, filtered, visible);
    expect(merged.S).toEqual(["o1", "x1", "o2", "x2", "x3"]);
    expect(merged.A).toEqual([]);
  });

  it("never loses a hidden song, even when the shown songs are all unranked", () => {
    const merged = mergeFilteredTiers(full, emptyTiers(), visible);
    expect(merged.S).toEqual(["o1", "o2"]);
  });
});

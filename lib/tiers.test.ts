// Tests for the tier list logic (lib/tiers.ts)

import { describe, expect, it } from "vitest";
import { buildBoard, emptyTiers, moveToTier, removeFromTiers } from "./tiers";

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

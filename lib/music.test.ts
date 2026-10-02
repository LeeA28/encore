// Tests for cleaning track titles and removing duplicates (lib/music.ts)

import { describe, expect, it } from "vitest";
import { cleanTitle, dedupeItems, toRankItem } from "./music";

describe("cleanTitle", () => {
  it("removes version labels so the same song matches across releases", () => {
    expect(cleanTitle("Karma Police - 2017 Remaster")).toBe("Karma Police");
    expect(cleanTitle("Creep (Live at Glastonbury)")).toBe("Creep");
    expect(cleanTitle("Song (feat. Someone)")).toBe("Song");
  });

  it("keeps labels that make a genuinely different song", () => {
    expect(cleanTitle("Hey (Remix)")).toBe("Hey (Remix)");
    expect(cleanTitle("Song - Acoustic")).toBe("Song - Acoustic");
  });

  it("doesn't mistake words that contain 'live' for a live version", () => {
    expect(cleanTitle("Stayin' Alive")).toBe("Stayin' Alive");
  });

  it("never returns an empty title", () => {
    expect(cleanTitle("(Live)")).not.toBe("");
  });
});

describe("dedupeItems", () => {
  it("keeps the first copy of each song, so the original release wins", () => {
    const original = toRankItem({ id: "1", name: "Creep", artists: [{ name: "Radiohead" }] }, "Pablo Honey");
    const remaster = toRankItem({ id: "2", name: "Creep - Remastered", artists: [{ name: "Radiohead" }] }, "Best Of");
    const result = dedupeItems([original, remaster]);
    expect(result).toHaveLength(1);
    expect(result[0].detail).toBe("Pablo Honey");
  });
});

// Tests for scoring Spotify search results (lib/matching.ts). These are the examples from the guide.

import { describe, expect, it } from "vitest";
import { GOOD_SCORE, GREAT_SCORE, buildQueries, scoreTrack } from "./matching";

const track = (name: string, ...artists: string[]) => ({ name, artists: artists.map((a) => ({ id: "", name: a })) });
const creep = { key: "radiohead|creep", name: "Creep", artist: "Radiohead" };

describe("scoreTrack", () => {
  it("gives the studio version by the right artist a great score", () => {
    expect(scoreTrack(creep, track("Creep", "Radiohead"))).toBe(90);
  });

  it("treats a remaster as the same song", () => {
    expect(scoreTrack(creep, track("Creep - Remastered 2008", "Radiohead"))).toBe(90);
  });

  it("scores a live version below automatic acceptance", () => {
    const score = scoreTrack(creep, track("Creep - Live", "Radiohead"));
    expect(score).toBe(60);
    expect(score).toBeLessThan(GOOD_SCORE);
  });

  it("doesn't accept the same title by a different artist", () => {
    expect(scoreTrack(creep, track("Creep", "Some Other Band"))).toBeLessThan(GOOD_SCORE);
  });

  it("barely scores a different song that starts with the same word", () => {
    expect(scoreTrack(creep, track("Creeping Death", "Metallica"))).toBe(20);
  });

  it("gives 0 to a completely different title", () => {
    expect(scoreTrack(creep, track("Karma Police", "Radiohead"))).toBe(0);
  });

  it("accepts a cover's original recording", () => {
    const cover = { key: "k", name: "Nothing Compares 2 U", artist: "Some Band", coverOf: "Prince" };
    const score = scoreTrack(cover, track("Nothing Compares 2 U", "Prince"));
    expect(score).toBeGreaterThanOrEqual(GOOD_SCORE);
    expect(score).toBeLessThan(GREAT_SCORE); // the performer's own version would still win
  });
});

describe("lenient artist names", () => {
  it("matches small spelling differences between setlist.fm and Spotify", () => {
    // setlist.fm wrote "BlueNotes"; Spotify has "Blue Notes"
    const song = { key: "k", name: "I Miss You", artist: "Bruno Mars", coverOf: "Harold Melvin & The BlueNotes" };
    expect(scoreTrack(song, track("I Miss You", "Harold Melvin & The Blue Notes"))).toBeGreaterThanOrEqual(GOOD_SCORE);
  });
});

describe("buildQueries", () => {
  it("searches the performer, then the original artist for covers, then loosely", () => {
    const queries = buildQueries({ key: "k", name: "Song", artist: "Band", coverOf: "Original" });
    expect(queries).toEqual(['track:"Song" artist:"Band"', 'track:"Song" artist:"Original"', "Song Band"]);
  });

  it("removes quotes that would break Spotify's search filters", () => {
    expect(buildQueries({ key: "k", name: 'The "Hit"', artist: "Band" })[0]).toBe('track:"The Hit" artist:"Band"');
  });
});

// Tests for counting songs, medleys, and playlist order (lib/songs.ts)
//
// How tests read: describe("thing") groups related tests, it("does something") is one test,
// and expect(actual).toBe(expected) fails the test if they don't match.

import { describe, expect, it } from "vitest";
import { countSongs, groupByArtist, normalize, songKey, splitMedley } from "./songs";
import type { Concert, SongCount } from "./types";

// Small helpers to make test data short to write
const concert = (id: string, artist: string, songs: string[]): Concert => ({
  id,
  date: "2025-01-01",
  artist,
  venue: "Venue",
  city: "City",
  url: "",
  songs: songs.map((name) => ({ name })),
});

const count = (name: string, artist: string, timesHeard: number): SongCount => ({
  key: songKey(artist, name),
  name,
  artist,
  timesHeard,
  concertIds: [],
});

describe("normalize", () => {
  it("ignores capitals, apostrophes, and extra spaces", () => {
    expect(normalize("Don't  Stop ")).toBe("dont stop");
    expect(normalize("Don’t Stop")).toBe("dont stop"); // curly apostrophe too
  });
});

describe("songKey", () => {
  it("keeps two bands' songs with the same name separate", () => {
    expect(songKey("Band A", "Home")).not.toBe(songKey("Band B", "Home"));
  });
});

describe("splitMedley", () => {
  it("splits songs played back-to-back as one setlist entry", () => {
    expect(splitMedley("It Will Rain / Talking to the Moon / When I Was Your Man")).toEqual([
      "It Will Rain",
      "Talking to the Moon",
      "When I Was Your Man",
    ]);
  });

  it("leaves a slash without spaces alone", () => {
    expect(splitMedley("Face/Off")).toEqual(["Face/Off"]);
  });

  it("leaves normal songs alone", () => {
    expect(splitMedley("Creep")).toEqual(["Creep"]);
  });
});

describe("countSongs", () => {
  it("counts each song once per concert, even if it was played twice (a reprise)", () => {
    const songs = countSongs([concert("a", "Band", ["Hit", "Hit"])]);
    expect(songs).toHaveLength(1);
    expect(songs[0].timesHeard).toBe(1);
  });

  it("merges spellings that only differ by capitals or apostrophes", () => {
    const songs = countSongs([concert("a", "Band", ["Don't Stop"]), concert("b", "Band", ["dont stop"])]);
    expect(songs).toHaveLength(1);
    expect(songs[0].timesHeard).toBe(2);
  });

  // Regression test: medleys used to count as one unmatchable "song"
  it("counts each part of a medley, without double-counting a song also played on its own", () => {
    const songs = countSongs([
      concert("a", "Bruno Mars", ["It Will Rain / Talking to the Moon", "Talking to the Moon"]),
      concert("b", "Bruno Mars", ["Talking to the Moon"]),
    ]);
    const timesHeard = Object.fromEntries(songs.map((s) => [s.name, s.timesHeard]));
    expect(timesHeard).toEqual({ "Talking to the Moon": 2, "It Will Rain": 1 });
  });

  it("sorts from most heard to least heard", () => {
    const songs = countSongs([concert("a", "Band", ["Rare", "Common"]), concert("b", "Band", ["Common"])]);
    expect(songs.map((s) => s.name)).toEqual(["Common", "Rare"]);
  });
});

describe("groupByArtist", () => {
  it("keeps each artist's songs together, ordering artists by their most-heard song", () => {
    // The example used to design this feature
    const ordered = groupByArtist([
      count("A", "Artist A", 6),
      count("E", "Artist B", 5),
      count("F", "Artist B", 4),
      count("B", "Artist A", 3),
      count("C", "Artist A", 2),
      count("D", "Artist A", 1),
    ]);
    expect(ordered.map((s) => s.name)).toEqual(["A", "B", "C", "D", "E", "F"]);
  });

  it("breaks ties between artists by their total plays", () => {
    const ordered = groupByArtist([count("X", "Solo", 3), count("Y1", "Duo", 3), count("Y2", "Duo", 1)]);
    expect(ordered.map((s) => s.name)).toEqual(["Y1", "Y2", "X"]);
  });
});

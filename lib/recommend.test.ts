// Tests for artist recommendations (lib/recommend.ts), including the worked example from the guide

import { describe, expect, it } from "vitest";
import {
  buildTasteProfile,
  canonicalName,
  diversify,
  pickSeeds,
  reasonFor,
  scoreCandidates,
  splitCollaboration,
  toExclusions,
} from "./recommend";
import { emptyTiers } from "./tiers";
import { songKey } from "./songs";
import type { Concert, SongCount } from "./types";

const concert = (id: string, artist: string): Concert => ({
  id,
  date: "2025-01-01",
  artist,
  venue: "",
  city: "",
  url: "",
  songs: [],
});
const song = (artist: string, name: string): SongCount => ({
  key: songKey(artist, name),
  name,
  artist,
  timesHeard: 1,
  concertIds: [],
});

// The worked example: 5SOS has 3 S, 2 A, 3 concerts; Bruno Mars has 1 S, 2 B, 1 concert
function exampleProfile() {
  const s = (a: string, n: string) => song(a, n);
  const songs = [
    s("5SOS", "a"), s("5SOS", "b"), s("5SOS", "c"), s("5SOS", "d"), s("5SOS", "e"),
    s("Bruno Mars", "f"), s("Bruno Mars", "g"), s("Bruno Mars", "h"),
  ];
  const k = (i: number) => songs[i].key;
  return buildTasteProfile({
    songs,
    concerts: [concert("1", "5SOS"), concert("2", "5SOS"), concert("3", "5SOS"), concert("4", "Bruno Mars")],
    liveTiers: { ...emptyTiers(), S: [k(0), k(1), k(2), k(5)], A: [k(3), k(4)], B: [k(6), k(7)] },
    customLists: [],
  });
}

describe("buildTasteProfile", () => {
  it("scores S = 5, A = 4, B = 3 per song, plus 1 per concert", () => {
    const profile = exampleProfile();
    expect(profile.get("5sos")?.score).toBe(26); // 3×5 + 2×4 + 3×1 = 15 + 8 + 3
    expect(profile.get("bruno mars")?.score).toBe(12); // 1×5 + 2×3 + 1×1 = 5 + 6 + 1
  });
});

describe("pickSeeds", () => {
  it("picks your highest-scoring artists first", () => {
    expect(pickSeeds(exampleProfile()).map((a) => a.artist)).toEqual(["5SOS", "Bruno Mars"]);
  });
});

describe("scoreCandidates", () => {
  const similar = {
    "5SOS": [
      { name: "Candidate A", match: 0.9 },
      { name: "Candidate B", match: 0.3 },
      { name: "Bruno Mars", match: 0.5 }, // already known: must be skipped
    ],
    "Bruno Mars": [
      { name: "Candidate A", match: 0.2 },
      { name: "Candidate B", match: 0.8 },
    ],
  };

  it("sums (your artist's score × similarity) over all your artists", () => {
    const recs = scoreCandidates(exampleProfile(), similar);
    expect(recs.map((r) => r.artist)).toEqual(["Candidate A", "Candidate B"]);
    expect(recs[0].score).toBeCloseTo(25.8); // 26 × 0.9 + 12 × 0.2 = 23.4 + 2.4
    expect(recs[1].score).toBeCloseTo(17.4); // 26 × 0.3 + 12 × 0.8 = 7.8 + 9.6
  });

  it("credits the artist that contributed the most", () => {
    const recs = scoreCandidates(exampleProfile(), similar);
    expect(recs[0].because.artist).toBe("5SOS"); // 23.4 of Candidate A's 25.8 points
    expect(recs[1].because.artist).toBe("Bruno Mars"); // 9.6 of Candidate B's 17.4 points
  });

  it("never recommends an artist you already know", () => {
    expect(scoreCandidates(exampleProfile(), similar).some((r) => r.artist === "Bruno Mars")).toBe(false);
  });

  // An evaluation in miniature: hide a favourite artist from the profile, and check
  // the recommendations find it again from the artists that remain
  it("rediscovers a hidden favourite artist", () => {
    const profile = exampleProfile();
    profile.delete("bruno mars"); // pretend you'd never heard of Bruno Mars
    const recs = scoreCandidates(profile, {
      "5SOS": [
        { name: "Bruno Mars", match: 0.7 },
        { name: "Someone Else", match: 0.4 },
      ],
    });
    expect(recs[0].artist).toBe("Bruno Mars");
  });
});

describe("skipping members of your top bands", () => {
  const similar = {
    "5SOS": [
      { name: "Luke Hemmings", match: 0.95, mbid: "luke-id" }, // a member, matched by ID
      { name: "Calum Hood", match: 0.9 }, // a member, matched by name (no ID)
      { name: "Candidate A", match: 0.8 },
    ],
  };
  const exclude = toExclusions(["luke-id", "calum-id"], ["Luke Hemmings", "Calum Hood"]);

  it("leaves out a band's members, matching by MusicBrainz ID or by name", () => {
    const recs = scoreCandidates(exampleProfile(), similar, 10, exclude);
    expect(recs.map((r) => r.artist)).toEqual(["Candidate A"]);
  });

  it("still suggests a band when a top artist is a solo member of it", () => {
    // Exclusions only come from your top artists' band members, so a band itself is never excluded
    const recs = scoreCandidates(exampleProfile(), { "Bruno Mars": [{ name: "Some Band", match: 0.9 }] }, 10, exclude);
    expect(recs.map((r) => r.artist)).toEqual(["Some Band"]);
  });
});

describe("collaborations and duplicates", () => {
  it("splits collaboration credits into their artists", () => {
    expect(splitCollaboration("Bruno Mars, Anderson .Paak & Silk Sonic")).toEqual([
      "Bruno Mars",
      "Anderson .Paak",
      "Silk Sonic",
    ]);
    expect(splitCollaboration("Charlie Puth")).toEqual(["Charlie Puth"]);
    expect(splitCollaboration("The xx")).toEqual(["The xx"]); // "x" only splits as its own word
  });

  it("treats spellings that differ by '&' vs 'and' or punctuation as the same name", () => {
    expect(canonicalName("Bruno Mars, Anderson .Paak & Silk Sonic")).toBe(
      canonicalName("Bruno Mars, Anderson Paak and Silk Sonic")
    );
  });

  // Regression test: both spellings of this collaboration were recommended to a Bruno Mars fan
  it("skips collaborations that include an artist you already know", () => {
    const recs = scoreCandidates(exampleProfile(), {
      "5SOS": [
        { name: "Bruno Mars, Anderson .Paak, Silk Sonic", match: 0.9 },
        { name: "Bruno Mars, Anderson .Paak & Silk Sonic", match: 0.9 },
        { name: "Charlie Puth", match: 0.5 },
      ],
    });
    expect(recs.map((r) => r.artist)).toEqual(["Charlie Puth"]);
  });

  it("merges two spellings of the same new artist into one recommendation", () => {
    const recs = scoreCandidates(exampleProfile(), {
      "5SOS": [{ name: "Simon & Garfunkel", match: 0.5 }],
      "Bruno Mars": [{ name: "Simon and Garfunkel", match: 0.5 }],
    });
    expect(recs).toHaveLength(1);
  });
});

describe("diversify", () => {
  it("keeps a band and drops its members when both are recommended", () => {
    const rec = (artist: string, mbid: string) => ({
      artist,
      mbid,
      score: 1,
      contribution: 1,
      because: { artist: "5SOS", score: 1, tierCounts: { S: 0, A: 0, B: 0, C: 0, D: 0 }, concerts: 1 },
    });
    const recs = [rec("One Direction", "1d"), rec("Louis Tomlinson", "louis"), rec("Waterparks", "wp")];
    const result = diversify(recs, { louis: ["1d"] });
    expect(result.map((r) => r.artist)).toEqual(["One Direction", "Waterparks"]);
  });
});

describe("reasonFor", () => {
  it("mentions your strongest tier first, or concerts if nothing is ranked", () => {
    const profile = exampleProfile();
    expect(reasonFor(profile.get("5sos")!)).toBe("Because you ranked 3 songs by 5SOS in S tier");
    expect(reasonFor({ artist: "X", score: 2, tierCounts: { S: 0, A: 0, B: 0, C: 0, D: 0 }, concerts: 2 })).toBe(
      "Because you've seen X live 2 times"
    );
  });
});

// Tests for "people who saw the same shows also saw..." (lib/coAttendance.ts)

import { describe, expect, it } from "vitest";
import { newToYou } from "./coAttendance";
import type { TasteProfile } from "./recommend";

const profile: TasteProfile = new Map([
  ["5sos", { artist: "5SOS", score: 3, tierCounts: { S: 0, A: 0, B: 0, C: 0, D: 0 }, concerts: 3 }],
]);

describe("newToYou", () => {
  it("leaves out artists you already know, and collaborations that include them", () => {
    const rows = [
      { artist: "5SOS", people: 9 }, // your own artist: fans of the show saw them too, of course
      { artist: "5SOS & Friends", people: 4 },
      { artist: "The Vamps", people: 3 },
    ];
    expect(newToYou(rows, profile).map((r) => r.artist)).toEqual(["The Vamps"]);
  });
});

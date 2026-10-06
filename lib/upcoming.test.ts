// Tests for upcoming concerts: geohash encoding, filtering Ticketmaster events, and the search window

import { describe, expect, it } from "vitest";
import { encodeGeohash } from "./geohash";
import { searchWindow, showsForArtist } from "./upcoming";

describe("encodeGeohash", () => {
  it("matches a known geohash", () => {
    // The standard example from geohash's documentation
    expect(encodeGeohash(57.64911, 10.40744, 11)).toBe("u4pruydqqvj");
  });

  it("gets more precise with more characters (each one is a box inside the last)", () => {
    expect(encodeGeohash(43.6532, -79.3832, 9).startsWith(encodeGeohash(43.6532, -79.3832, 5))).toBe(true);
  });
});

describe("showsForArtist", () => {
  const event = (name: string, performers: string[], date = "2026-11-01") => ({
    name,
    url: "https://example.com",
    dates: { start: { localDate: date } },
    _embedded: { venues: [{ name: "Arena", city: { name: "Toronto" } }], attractions: performers.map((n) => ({ name: n })) },
  });

  it("keeps only events where the artist is actually performing", () => {
    const shows = showsForArtist("Charlie Puth", [
      event("Charlie Puth Tour", ["Charlie Puth"]),
      event("Tribute Night: Charlie Puth Songs", ["Local Tribute Band"]),
    ]);
    expect(shows.map((s) => s.name)).toEqual(["Charlie Puth Tour"]);
  });

  it("matches small spelling differences in names", () => {
    expect(showsForArtist("Simon and Garfunkel", [event("Reunion", ["Simon & Garfunkel"])])).toHaveLength(1);
  });

  it("skips events with no date", () => {
    expect(showsForArtist("Band", [event("Show", ["Band"], "")])).toHaveLength(0);
  });
});

describe("searchWindow", () => {
  it("starts at the beginning of today and ends the given number of months later", () => {
    expect(searchWindow(new Date("2026-10-06T15:30:00Z"), 6)).toEqual({
      start: "2026-10-06T00:00:00Z",
      end: "2027-04-06T00:00:00Z",
    });
  });
});

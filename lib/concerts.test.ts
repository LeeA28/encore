// Tests for converting setlist.fm data and formatting dates (lib/concerts.ts)

import { describe, expect, it } from "vitest";
import { formatCity, formatDate, toConcert, toIsoDate } from "./concerts";
import type { SetlistFmSetlist } from "./setlistfm";

describe("toIsoDate", () => {
  it("turns setlist.fm's day-first date into year-first, which sorts correctly as text", () => {
    expect(toIsoDate("14-03-2025")).toBe("2025-03-14");
  });
});

describe("formatDate", () => {
  // Regression test: new Date("2025-03-14") means midnight UTC, which in Toronto is still
  // the evening of March 13. The tests run in Toronto's time zone (vitest.config.ts) to catch this.
  it("shows the right day in a time zone behind UTC", () => {
    expect(formatDate("2025-03-14")).toBe("Mar 14, 2025");
    expect(formatDate("2025-01-01")).toBe("Jan 1, 2025");
  });
});

describe("toConcert", () => {
  const raw: SetlistFmSetlist = {
    id: "abc",
    eventDate: "02-07-2024",
    url: "https://www.setlist.fm/abc",
    artist: { name: "Band" },
    tour: { name: "Big Tour" },
    venue: { name: "Arena", city: { name: "Toronto", country: { code: "CA", name: "Canada" } } },
    sets: {
      set: [
        { song: [{ name: "Intro", tape: true }, { name: "Opener" }, { name: " " }] },
        {}, // a set with no songs listed
        { song: [{ name: "Classic", cover: { name: "Original Artist" } }] },
      ],
    },
  };
  const concert = toConcert(raw);

  it("keeps only songs performed live (no tape intros or blank entries)", () => {
    expect(concert.songs.map((s) => s.name)).toEqual(["Opener", "Classic"]);
  });

  it("joins the main set and encores, and remembers covers", () => {
    expect(concert.songs[1].coverOf).toBe("Original Artist");
  });

  it("keeps the date, place, and tour", () => {
    expect(concert.date).toBe("2024-07-02");
    expect(formatCity(concert)).toBe("Toronto, Canada");
    expect(concert.tour).toBe("Big Tour");
  });
});

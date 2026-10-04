// Tests for converting setlist.fm data and formatting dates (lib/concerts.ts)

import { describe, expect, it } from "vitest";
import { coverArtists, formatCity, formatDate, parseCoverInfo, toConcert, toIsoDate } from "./concerts";
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

describe("medleys of covers", () => {
  // Regression test: this exact Bruno Mars entry was searched as "Oh Girl Bruno Mars" and so on,
  // instead of by each song's original artist
  const brunoMedley = {
    name: "Oh Girl / I Miss You / You Are Everything / I Want to Be Your Man",
    info: "Cover of (in order): The Chi-Lites, Harold Melvin & The BlueNotes, The Stylistics, Roger Troutman",
  };

  it("reads the original artists from setlist.fm's notes", () => {
    expect(parseCoverInfo(brunoMedley.info)).toEqual([
      "The Chi-Lites",
      "Harold Melvin & The BlueNotes",
      "The Stylistics",
      "Roger Troutman",
    ]);
    expect(parseCoverInfo("Acoustic version")).toEqual([]);
  });

  it("pairs each medley part with its artist, in order", () => {
    expect(coverArtists(brunoMedley).coverOfEach?.[1]).toBe("Harold Melvin & The BlueNotes");
  });

  it("leaves the artists off when the counts don't match, instead of guessing", () => {
    const result = coverArtists({ name: "Song A / Song B", info: "Cover of (in order): Band 1, Band 2, Band 3" });
    expect(result).toEqual({});
  });

  // A known limitation, written down as a test: a comma inside one artist's name can fool the count.
  // "Earth, Wind & Fire" reads as 2 artists, which matches a 2-song medley, so they're paired anyway.
  // It's safe because matching only auto-accepts a track when its artist really matches on Spotify:
  // a wrongly paired artist can make a song "not found", but never the wrong song.
  it("can be fooled by a comma inside an artist's name (known limitation)", () => {
    const result = coverArtists({ name: "Song A / Song B", info: "Cover of (in order): Earth, Wind & Fire" });
    expect(result.coverOfEach).toEqual(["Earth", "Wind & Fire"]);
  });

  it("applies a single cover artist to the whole medley", () => {
    expect(coverArtists({ name: "Song A / Song B", cover: { name: "Some Band" } })).toEqual({ coverOf: "Some Band" });
  });
});

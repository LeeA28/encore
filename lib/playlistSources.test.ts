// Tests for rebuilding a playlist's songs from its source (lib/playlistSources.ts)

import { describe, expect, it } from "vitest";
import { songsForSource } from "./playlistSources";
import { emptyTiers } from "./tiers";
import { songKey } from "./songs";
import type { Concert } from "./types";

const concert = (id: string, artist: string, songs: string[]): Concert => ({
  id,
  date: "2026-01-01",
  artist,
  venue: "",
  city: "",
  url: "",
  songs: songs.map((name) => ({ name })),
});

const concerts = [concert("a", "Band", ["Hit", "Deep Cut"]), concert("b", "Band", ["Hit"]), concert("c", "Other", ["Song"])];
const data = {
  concerts,
  savedLists: [{ id: "L", name: "2026", concertIds: ["c"], tiers: { ...emptyTiers(), S: [songKey("Other", "Song")] } }],
  liveTiers: { ...emptyTiers(), S: [songKey("Band", "Deep Cut")], A: [songKey("Band", "Hit")] },
  customLists: [],
};

describe("songsForSource", () => {
  it("rebuilds all songs heard live, grouped by artist, most heard first", () => {
    expect(songsForSource({ kind: "songs", listId: "all" }, data)?.map((s) => s.name)).toEqual(["Hit", "Deep Cut", "Song"]);
  });

  it("rebuilds a saved list's songs, using its current concerts", () => {
    expect(songsForSource({ kind: "songs", listId: "L" }, data)?.map((s) => s.name)).toEqual(["Song"]);
  });

  it("rebuilds chosen tiers in tier order", () => {
    const songs = songsForSource({ kind: "tiers", context: "live", tiers: ["S", "A"] }, data);
    expect(songs?.map((s) => s.name)).toEqual(["Deep Cut", "Hit"]);
  });

  it("returns null when the source no longer exists, so the playlist can't be updated", () => {
    expect(songsForSource({ kind: "songs", listId: "deleted" }, data)).toBeNull();
    expect(songsForSource({ kind: "tiers", context: "saved:deleted", tiers: ["S"] }, data)).toBeNull();
  });
});

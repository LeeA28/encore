// Tests for choosing which known match a song uses (lib/sharedMatches.ts)

import { describe, expect, it } from "vitest";
import { resolveKnownMatch } from "./sharedMatches";

const track = (id: string) => ({ id, name: "Song", artist: "Band" });

describe("resolveKnownMatch", () => {
  it("uses the track a song came with (songs added from Spotify) above anything else", () => {
    const result = resolveKnownMatch(
      { key: "k", match: track("from-spotify") },
      { k: track("yours") },
      { k: { match: track("shared"), votes: 5 } }
    );
    expect(result?.source).toBe("spotify");
  });

  it("prefers your own earlier choice over the shared match", () => {
    const result = resolveKnownMatch({ key: "k" }, { k: track("yours") }, { k: { match: track("shared"), votes: 5 } });
    expect(result?.match.id).toBe("yours");
  });

  it("uses the shared match when you haven't chosen one, with its vote count", () => {
    const result = resolveKnownMatch({ key: "k" }, {}, { k: { match: track("shared"), votes: 3 } });
    expect(result).toEqual({ match: track("shared"), source: "shared", votes: 3 });
  });

  it("returns null when the song still needs to be searched", () => {
    expect(resolveKnownMatch({ key: "k" }, {}, {})).toBeNull();
  });
});

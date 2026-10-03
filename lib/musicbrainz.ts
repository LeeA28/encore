// MusicBrainz: a free, open, community-edited music database. Encore uses it to understand how
// artists are related: who is in a band, and other names a person performs under. Server-only.
//
// MusicBrainz asks apps to make at most 1 request per second, and to identify themselves with a
// User-Agent naming the app and a way to contact its maker. Both are handled below.

import { unstable_cache } from "next/cache";

const MUSICBRAINZ_API = "https://musicbrainz.org/ws/2";
const USER_AGENT = `Encore/1.0 ( ${process.env.MUSICBRAINZ_CONTACT || "https://github.com/LeeA28/encore"} )`;

export type RelatedArtist = { id: string; name: string };

// What Encore needs to know about one artist
export type ArtistLinks = {
  members: RelatedArtist[]; // if it's a band: its members (current and former)
  bands: RelatedArtist[]; // bands this artist is a member of
  otherNames: RelatedArtist[]; // other names this person performs under (e.g. SUGA → Agust D)
  aliases: string[]; // other spellings of this artist's name
};

const NONE: ArtistLinks = { members: [], bands: [], otherNames: [], aliases: [] };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A simple rate limiter: each request reserves the next free 1.1-second slot, so even requests made
// at the same moment are spaced out. If the queue is already more than 40 seconds long, the request
// is skipped instead (a "budget"): the page gets partial results now, and since finished lookups are
// cached, the next visit picks up where this one left off.
let nextSlot = 0;
async function waitForTurn() {
  const now = Date.now();
  if (nextSlot - now > 40_000) throw new Error("MusicBrainz queue is full; try again later");
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + 1100;
  await sleep(wait);
}

async function fetchArtistLinks(mbid: string): Promise<ArtistLinks> {
  await waitForTurn();
  const res = await fetch(`${MUSICBRAINZ_API}/artist/${mbid}?inc=artist-rels+aliases&fmt=json`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) return NONE;
  const data = await res.json();

  type Relation = { type: string; direction: string; artist?: RelatedArtist };
  const relations = ((data.relations ?? []) as Relation[]).filter((r) => r.artist);
  const related = (type: string, direction?: string) =>
    relations
      .filter((r) => r.type === type && (!direction || r.direction === direction))
      .map((r) => ({ id: r.artist!.id, name: r.artist!.name }));

  return {
    // "member of band" pointing backward from a band = "this artist is a member of the band"
    members: related("member of band", "backward"),
    // ...and pointing forward from a person = "this person is a member of that band"
    bands: related("member of band", "forward"),
    // "is person" links a performance name (like Agust D) and the person behind it, in either direction
    otherNames: related("is person"),
    aliases: ((data.aliases ?? []) as { name: string }[]).map((a) => a.name),
  };
}

// Cached for a week (lineups and names rarely change), keyed by the artist's MusicBrainz ID.
// unstable_cache saves results on the server, so the rate-limited request only happens the first time.
export const getArtistLinks = unstable_cache(fetchArtistLinks, ["musicbrainz-artist-links"], {
  revalidate: 60 * 60 * 24 * 7,
});

// The same, but never throws: missing info just means no filtering for that artist
export async function safeArtistLinks(mbid: string): Promise<ArtistLinks> {
  try {
    return await getArtistLinks(mbid);
  } catch {
    return NONE;
  }
}

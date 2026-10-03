// MusicBrainz: a free, open, community-edited music database, used here to find out who is in a band
// (so the discover tab can skip recommending a band's members' solo music). Server-only.
//
// MusicBrainz asks apps to make at most 1 request per second, and to identify themselves with a
// User-Agent naming the app and a way to contact its maker. Both are handled below.

import { unstable_cache } from "next/cache";

const MUSICBRAINZ_API = "https://musicbrainz.org/ws/2";
const USER_AGENT = `Encore/1.0 ( ${process.env.MUSICBRAINZ_CONTACT || "https://github.com/LeeA28/encore"} )`;

export type BandMember = { id: string; name: string }; // id: the member's MusicBrainz ID

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A simple rate limiter: each request reserves the next free 1.1-second slot, so even requests
// made at the same moment are spaced out
let nextSlot = 0;
async function waitForTurn() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + 1100;
  await sleep(wait);
}

async function fetchMembers(artistMbid: string): Promise<BandMember[]> {
  await waitForTurn();
  const res = await fetch(`${MUSICBRAINZ_API}/artist/${artistMbid}?inc=artist-rels&fmt=json`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) return [];
  const data = await res.json();
  type Relation = { type: string; direction: string; artist?: { id: string; name: string } };
  return ((data.relations ?? []) as Relation[])
    // "member of band", pointing backward from the band, means "this artist is a member of the band".
    // Former members count too.
    .filter((r) => r.type === "member of band" && r.direction === "backward" && r.artist)
    .map((r) => ({ id: r.artist!.id, name: r.artist!.name }));
}

// Cached for a week: band lineups rarely change. unstable_cache saves the result on the server,
// keyed by the artist's ID, so the rate-limited request only happens the first time.
export const getBandMembers = unstable_cache(fetchMembers, ["musicbrainz-band-members"], {
  revalidate: 60 * 60 * 24 * 7,
});

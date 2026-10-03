// POST /api/recommendations/bands
// body: { artists: [your top artists], candidates: [{ name, mbid }] (the current recommendations) }
//
// Uses MusicBrainz to work out:
//  - exclude: members of your top bands, plus other names they perform under (e.g. BTS → SUGA → Agust D),
//    so their solo music isn't recommended
//  - memberOf: for each candidate, the bands they're in, so a band can be kept over its own members
//
// MusicBrainz allows 1 request per second, so the first run for new artists can take a while.
// Results are cached for a week, and the rate limiter's 40-second budget keeps any one request from
// running too long (unfinished lookups are simply done on a later visit).

import { NextRequest, NextResponse } from "next/server";
import { musicBrainzId } from "@/lib/lastfm";
import { safeArtistLinks } from "@/lib/musicbrainz";

export const maxDuration = 60; // allow up to a minute when deployed (lookups are rate-limited)

const MAX_MEMBERS_PER_BAND = 10;
const MAX_CANDIDATES = 15;

export async function POST(request: NextRequest) {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "LASTFM_API_KEY is missing from .env.local" }, { status: 500 });

  const body = await request.json().catch(() => null);
  const artists: string[] = Array.isArray(body?.artists)
    ? body.artists.filter((a: unknown): a is string => typeof a === "string").slice(0, 8)
    : [];
  const candidates: { name: string; mbid?: string }[] = Array.isArray(body?.candidates)
    ? body.candidates.slice(0, MAX_CANDIDATES)
    : [];

  const excludeIds = new Set<string>();
  const excludeNames = new Set<string>();
  const addExcluded = (a: { id: string; name: string }) => {
    excludeIds.add(a.id);
    excludeNames.add(a.name);
  };

  // 1. Members of your top bands, and each member's other performing names and aliases
  for (const artist of artists) {
    const mbid = await musicBrainzId(artist, apiKey);
    if (!mbid) continue;
    const band = await safeArtistLinks(mbid);
    for (const member of band.members.slice(0, MAX_MEMBERS_PER_BAND)) {
      addExcluded(member);
      const links = await safeArtistLinks(member.id);
      links.otherNames.forEach(addExcluded); // e.g. SUGA → Agust D
      links.aliases.forEach((alias) => excludeNames.add(alias));
    }
  }

  // 2. Which bands each candidate belongs to
  const memberOf: Record<string, string[]> = {};
  for (const candidate of candidates) {
    if (!candidate.mbid) continue;
    const links = await safeArtistLinks(candidate.mbid);
    if (links.bands.length > 0) memberOf[candidate.mbid] = links.bands.map((b) => b.id);
  }

  return NextResponse.json({
    exclude: { ids: [...excludeIds], names: [...excludeNames] },
    memberOf,
  });
}

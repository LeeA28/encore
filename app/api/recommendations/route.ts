// POST /api/recommendations  body: { artists: ["5 Seconds of Summer", ...] } (your top artists, up to 8)
// For each artist: similar artists (Last.fm), and, if it's a band, its members (MusicBrainz).
// Returns { similar: { artist: [{ name, match, mbid }] }, members: { artist: [{ id, name }] } }.
// The scoring happens in lib/recommend.ts; this route only fetches data (and keeps the API key secret).

import { NextRequest, NextResponse } from "next/server";
import type { SimilarArtist } from "@/lib/recommend";
import { getBandMembers, type BandMember } from "@/lib/musicbrainz";

const LASTFM_API = "https://ws.audioscrobbler.com/2.0/";

async function similarArtists(artist: string, apiKey: string): Promise<SimilarArtist[]> {
  const params = new URLSearchParams({
    method: "artist.getsimilar",
    artist,
    api_key: apiKey,
    format: "json",
    limit: "30",
    autocorrect: "1", // lets Last.fm fix small spelling differences in artist names
  });
  // Cached for a day: similar artists barely change, and this keeps Encore well within Last.fm's limits
  const res = await fetch(`${LASTFM_API}?${params}`, { next: { revalidate: 60 * 60 * 24 } });
  if (!res.ok) return [];
  const data = await res.json();
  if (data.error) return []; // e.g. "The artist you supplied could not be found"
  const list = data.similarartists?.artist ?? [];
  // Last.fm sends the similarity as text ("0.95"), so it's converted to a number
  return list.map((a: { name: string; match: string; mbid?: string }) => ({
    name: a.name,
    match: Number(a.match) || 0,
    mbid: a.mbid || undefined, // MusicBrainz ID, used to recognize band members reliably
  }));
}

// The artist's MusicBrainz ID, according to Last.fm (cached for a day)
async function musicBrainzId(artist: string, apiKey: string): Promise<string | undefined> {
  const params = new URLSearchParams({ method: "artist.getinfo", artist, api_key: apiKey, format: "json", autocorrect: "1" });
  const res = await fetch(`${LASTFM_API}?${params}`, { next: { revalidate: 60 * 60 * 24 } });
  if (!res.ok) return undefined;
  const data = await res.json();
  return data.artist?.mbid || undefined;
}

// Members of this artist, if it's a band (an empty list for solo artists, or if anything fails)
async function bandMembers(artist: string, apiKey: string): Promise<BandMember[]> {
  try {
    const mbid = await musicBrainzId(artist, apiKey);
    return mbid ? await getBandMembers(mbid) : [];
  } catch {
    return []; // member info is a bonus: recommendations still work without it
  }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "LASTFM_API_KEY is missing from .env.local" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const artists: string[] = Array.isArray(body?.artists)
    ? body.artists.filter((a: unknown): a is string => typeof a === "string" && a.trim() !== "").slice(0, 8)
    : [];
  if (artists.length === 0) return NextResponse.json({ similar: {} });

  // All lookups at the same time (Promise.all), since each one is independent
  // (MusicBrainz requests space themselves out to 1 per second inside getBandMembers)
  const [similar, members] = await Promise.all([
    Promise.all(artists.map((artist) => similarArtists(artist, apiKey))),
    Promise.all(artists.map((artist) => bandMembers(artist, apiKey))),
  ]);
  return NextResponse.json({
    similar: Object.fromEntries(artists.map((artist, i) => [artist, similar[i]])),
    members: Object.fromEntries(artists.map((artist, i) => [artist, members[i]])),
  });
}

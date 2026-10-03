// POST /api/recommendations  body: { artists: ["5 Seconds of Summer", ...] } (your top artists, up to 8)
// Similar artists for each, from Last.fm: { similar: { artist: [{ name, match, mbid }] } }.
// This part is fast, so recommendations show right away. The slower band member checks
// (MusicBrainz, 1 request per second) happen separately, in /api/recommendations/bands.

import { NextRequest, NextResponse } from "next/server";
import { similarArtists } from "@/lib/lastfm";

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
  const results = await Promise.all(artists.map((artist) => similarArtists(artist, apiKey)));
  return NextResponse.json({ similar: Object.fromEntries(artists.map((artist, i) => [artist, results[i]])) });
}

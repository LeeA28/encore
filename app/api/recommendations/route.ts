// POST /api/recommendations  body: { artists: ["5 Seconds of Summer", ...] } (your top artists, up to 8)
// Looks up similar artists for each on Last.fm, and returns { similar: { artist: [{ name, match }] } }.
// The scoring happens in lib/recommend.ts; this route only fetches data (and keeps the API key secret).

import { NextRequest, NextResponse } from "next/server";
import type { SimilarArtist } from "@/lib/recommend";

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
  return list.map((a: { name: string; match: string }) => ({ name: a.name, match: Number(a.match) || 0 }));
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
  const results = await Promise.all(artists.map((artist) => similarArtists(artist, apiKey)));
  return NextResponse.json({ similar: Object.fromEntries(artists.map((artist, i) => [artist, results[i]])) });
}

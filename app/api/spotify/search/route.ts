// GET /api/spotify/search?type=artist|album|track&q=...

import { NextRequest, NextResponse } from "next/server";
import { search, type SearchType, type SpotifyAlbum, type SpotifyArtist, type SpotifyTrack } from "@/lib/spotify";
import { toRankItem } from "@/lib/music";
import { spotifyErrorResponse } from "@/lib/spotifyRoute";

const TYPES: SearchType[] = ["artist", "album", "track"];

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const type = request.nextUrl.searchParams.get("type") as SearchType;
  if (!q) return NextResponse.json({ error: "Enter something to search for." }, { status: 400 });
  if (!TYPES.includes(type)) return NextResponse.json({ error: "Unknown search type." }, { status: 400 });

  try {
    const items = await search(type, q);

    // Send back only what the page needs, in a simple shape
    if (type === "artist") {
      return NextResponse.json({ results: (items as SpotifyArtist[]).map((a) => ({ id: a.id, name: a.name })) });
    }
    if (type === "album") {
      return NextResponse.json({
        results: (items as SpotifyAlbum[]).map((a) => ({
          id: a.id,
          name: a.name,
          artist: a.artists[0]?.name ?? "",
          year: a.release_date.slice(0, 4),
          totalTracks: a.total_tracks,
        })),
      });
    }
    return NextResponse.json({
      results: (items as SpotifyTrack[]).map((t) => toRankItem(t, t.album?.name)),
    });
  } catch (err) {
    return spotifyErrorResponse(err);
  }
}

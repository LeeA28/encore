// GET /api/spotify/albums?artistId=...  An artist's albums and singles, newest first

import { NextRequest, NextResponse } from "next/server";
import { getArtistAlbums } from "@/lib/spotify";
import { spotifyErrorResponse } from "@/lib/spotifyRoute";

export async function GET(request: NextRequest) {
  const artistId = request.nextUrl.searchParams.get("artistId");
  if (!artistId) return NextResponse.json({ error: "Missing artistId." }, { status: 400 });

  try {
    const albums = await getArtistAlbums(artistId);
    const results = albums
      .sort((a, b) => b.release_date.localeCompare(a.release_date))
      .map((a) => ({
        id: a.id,
        name: a.name,
        type: a.album_type,
        year: a.release_date.slice(0, 4),
        totalTracks: a.total_tracks,
      }));
    return NextResponse.json({ results });
  } catch (err) {
    return spotifyErrorResponse(err);
  }
}

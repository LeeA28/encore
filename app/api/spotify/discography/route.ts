// GET /api/spotify/discography?artistId=...  Every song from an artist's albums and singles, duplicates removed

import { NextRequest, NextResponse } from "next/server";
import { getDiscographyTracks } from "@/lib/spotify";
import { dedupeItems, toRankItem } from "@/lib/music";
import { spotifyErrorResponse } from "@/lib/spotifyRoute";

export async function GET(request: NextRequest) {
  const artistId = request.nextUrl.searchParams.get("artistId");
  if (!artistId) return NextResponse.json({ error: "Missing artistId." }, { status: 400 });

  try {
    const results = await getDiscographyTracks(artistId);
    const items = dedupeItems(results.map(({ track, album }) => toRankItem(track, album.name)));
    return NextResponse.json({ items });
  } catch (err) {
    return spotifyErrorResponse(err);
  }
}

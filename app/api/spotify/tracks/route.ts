// GET /api/spotify/tracks?albumId=...&albumName=...  Every track on one album, ready to rank

import { NextRequest, NextResponse } from "next/server";
import { getAlbumTracks } from "@/lib/spotify";
import { dedupeItems, toRankItem } from "@/lib/music";
import { spotifyErrorResponse } from "@/lib/spotifyRoute";

export async function GET(request: NextRequest) {
  const albumId = request.nextUrl.searchParams.get("albumId");
  const albumName = request.nextUrl.searchParams.get("albumName") ?? undefined;
  if (!albumId) return NextResponse.json({ error: "Missing albumId." }, { status: 400 });

  try {
    const tracks = await getAlbumTracks(albumId);
    return NextResponse.json({ items: dedupeItems(tracks.map((t) => toRankItem(t, albumName))) });
  } catch (err) {
    return spotifyErrorResponse(err);
  }
}

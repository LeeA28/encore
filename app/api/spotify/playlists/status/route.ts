// GET /api/spotify/playlists/status?ids=id1,id2,...
// For each playlist: is it still in the user's Spotify library? → { status: { id1: true, id2: false } }

import { NextRequest, NextResponse } from "next/server";
import { playlistsInLibrary } from "@/lib/spotify";
import { spotifyErrorResponse } from "@/lib/spotifyRoute";

export async function GET(request: NextRequest) {
  const ids = (request.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^[A-Za-z0-9]+$/.test(id)) // Spotify ids are letters and numbers only
    .slice(0, 100);
  if (ids.length === 0) return NextResponse.json({ status: {} });

  try {
    return NextResponse.json({ status: await playlistsInLibrary(ids) });
  } catch (err) {
    return spotifyErrorResponse(err);
  }
}

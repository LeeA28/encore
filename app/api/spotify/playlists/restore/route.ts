// POST /api/spotify/playlists/restore  body: { id }
// Adds a playlist you deleted back to your Spotify library, with its songs and link unchanged.

import { NextRequest, NextResponse } from "next/server";
import { restorePlaylist } from "@/lib/spotify";
import { spotifyErrorResponse } from "@/lib/spotifyRoute";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (!/^[A-Za-z0-9]+$/.test(id)) return NextResponse.json({ error: "Invalid playlist id." }, { status: 400 });

  try {
    await restorePlaylist(id);
    return NextResponse.json({ restored: true });
  } catch (err) {
    return spotifyErrorResponse(err);
  }
}

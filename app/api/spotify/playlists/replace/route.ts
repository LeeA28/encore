// POST /api/spotify/playlists/replace  body: { id, trackIds }
// "Update": replaces an existing playlist's songs with the current ones, keeping the same playlist and link.

import { NextRequest, NextResponse } from "next/server";
import { replacePlaylistTracks } from "@/lib/spotify";
import { spotifyErrorResponse } from "@/lib/spotifyRoute";

const isId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9]+$/.test(value);

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const id = body?.id;
  const trackIds: string[] = Array.isArray(body?.trackIds) ? body.trackIds.filter(isId) : [];
  if (!isId(id)) return NextResponse.json({ error: "Invalid playlist id." }, { status: 400 });
  if (trackIds.length === 0) return NextResponse.json({ error: "There are no songs to add." }, { status: 400 });

  try {
    await replacePlaylistTracks(id, trackIds);
    return NextResponse.json({ updated: true });
  } catch (err) {
    return spotifyErrorResponse(err);
  }
}

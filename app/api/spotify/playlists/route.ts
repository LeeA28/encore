// POST /api/spotify/playlists  body: { name, description, trackIds: [...] }
// Creates a private playlist in the user's Spotify account with these tracks, in this order.

import { NextRequest, NextResponse } from "next/server";
import { SpotifyError, createPlaylist } from "@/lib/spotify";
import { spotifyErrorResponse } from "@/lib/spotifyRoute";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const description = String(body?.description ?? "").slice(0, 300);
  const trackIds: string[] = Array.isArray(body?.trackIds) ? body.trackIds.filter((id: unknown) => typeof id === "string") : [];

  if (!name) return NextResponse.json({ error: "Give the playlist a name." }, { status: 400 });
  if (trackIds.length === 0) return NextResponse.json({ error: "There are no songs to add." }, { status: 400 });

  try {
    const playlist = await createPlaylist(name, description, trackIds);
    return NextResponse.json(playlist);
  } catch (err) {
    if (err instanceof SpotifyError && err.status === 403) {
      // Some apps in Spotify's development mode aren't allowed to create playlists
      return NextResponse.json(
        {
          error:
            "Spotify didn't allow creating the playlist. Check that your account is in the app's User Management list, and that you approved playlist access when connecting (try disconnecting and connecting Spotify again).",
        },
        { status: 403 }
      );
    }
    return spotifyErrorResponse(err);
  }
}

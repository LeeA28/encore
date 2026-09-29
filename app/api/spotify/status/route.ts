// GET /api/spotify/status: is this browser connected to Spotify?

import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/spotifyAuth";

export async function GET() {
  try {
    const token = await getAccessToken();
    return NextResponse.json({ connected: token !== null });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

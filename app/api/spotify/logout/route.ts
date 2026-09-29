// POST /api/spotify/logout: forget this browser's Spotify tokens

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE } from "@/lib/spotifyAuth";

export async function POST() {
  const store = await cookies();
  store.delete(COOKIE.access);
  store.delete(COOKIE.refresh);
  store.delete(COOKIE.expires);
  return NextResponse.json({ connected: false });
}

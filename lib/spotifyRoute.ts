// Shared error handling for the Spotify API routes, so each route stays short

import { NextResponse } from "next/server";
import { SpotifyError } from "./spotify";

export function spotifyErrorResponse(err: unknown) {
  if (err instanceof SpotifyError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return NextResponse.json({ error: "Something went wrong talking to Spotify." }, { status: 500 });
}

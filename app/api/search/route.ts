// GET /api/search?artist=...
// Runs only on the server: asks setlist.fm for concerts, then sends back simplified results.

import { NextRequest, NextResponse } from "next/server";
import { searchSetlists, SetlistFmError } from "@/lib/setlistfm";
import { toConcert } from "@/lib/concerts";

export async function GET(request: NextRequest) {
  const artist = request.nextUrl.searchParams.get("artist");
  if (!artist) {
    return NextResponse.json({ error: "Enter an artist name." }, { status: 400 });
  }

  try {
    const result = await searchSetlists(artist);
    // All the conversion work now lives in toConcert, so the route stays short
    const concerts = result.setlist.map(toConcert);
    return NextResponse.json({ concerts });
  } catch (err) {
    if (err instanceof SetlistFmError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
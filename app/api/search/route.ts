// GET /api/search?artist=...
// Runs only on the server: asks setlist.fm for concerts, then sends back simplified results.

import { NextRequest, NextResponse } from "next/server";
import type { Concert } from "@/lib/types";
import { searchSetlists, SetlistFmError } from "@/lib/setlistfm";

export async function GET(request: NextRequest) {
  const artist = request.nextUrl.searchParams.get("artist");
  if (!artist) {
    return NextResponse.json({ error: "Enter an artist name." }, { status: 400 });
  }

  try {
    const result = await searchSetlists(artist);

    // To see setlist.fm's raw JSON in your terminal, uncomment the next line:
    // console.log(JSON.stringify(result.setlist[0], null, 2));

    // Convert each setlist.fm setlist into our simpler Concert shape.
    // (Step 4 moves this into its own function and cleans up the formatting.)
    const concerts: Concert[] = result.setlist.map((s) => ({
      id: s.id,
      date: s.eventDate,
      artist: s.artist.name,
      venue: s.venue.name,
      // Each concert has several "sets" (main set, encores), each with its own songs.
      // flatMap joins all of them into one list, then we count the songs.
      songCount: s.sets.set.flatMap((set) => set.song ?? []).length,
    }));

    return NextResponse.json({ concerts });
  } catch (err) {
    // A known setlist.fm problem: pass its message and status to the page
    if (err instanceof SetlistFmError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    // Anything unexpected: log the details in the terminal, but show a generic message
    console.error(err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
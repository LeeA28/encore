import { NextRequest, NextResponse } from "next/server";
import type { Concert } from "@/lib/types";

export async function GET(request: NextRequest) {
  const artist = request.nextUrl.searchParams.get("artist");
  // No artist given: respond with an error and status 400 ("bad request")
  if (!artist) {
    return NextResponse.json({ error: "Enter an artist name." }, { status: 400 });
  }
  // Fake data for now. In Step 3, this gets replaced with a real setlist.fm request.
  const concerts: Concert[] = [
    { id: "1", date: "2025-03-14", artist, venue: "Danforth Music Hall, Toronto", songCount: 18 },
    { id: "2", date: "2024-07-02", artist, venue: "Budweiser Stage, Toronto", songCount: 22 },
    { id: "3", date: "2023-11-20", artist, venue: "Maxwell's, Waterloo", songCount: 15 },
  ];
  // Send the data back as JSON (status 200, "OK", is the default)
  return NextResponse.json({ concerts });
}
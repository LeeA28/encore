// GET /api/search?artist=...&year=...&city=...&page=...
// Runs only on the server: asks setlist.fm for concerts, then sends back simplified results.

import { NextRequest, NextResponse } from "next/server";
import { searchSetlists, SetlistFmError } from "@/lib/setlistfm";
import { toConcert } from "@/lib/concerts";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const artist = params.get("artist")?.trim();
  if (!artist) {
    return NextResponse.json({ error: "Enter an artist name." }, { status: 400 });
  }

  try {
    const result = await searchSetlists({
      artistName: artist,
      year: params.get("year")?.trim() || undefined, // empty text becomes "not provided"
      cityName: params.get("city")?.trim() || undefined,
      page: Number(params.get("page")) || 1,
    });

    return NextResponse.json({
      concerts: result.setlist.map(toConcert),
      page: result.page,
      // Are there more pages after this one? (e.g. page 1 x 20 per page < 57 total -> yes)
      hasMore: result.page * result.itemsPerPage < result.total,
    });
  } catch (err) {
    if (err instanceof SetlistFmError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

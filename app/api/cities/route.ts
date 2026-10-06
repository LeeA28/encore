// GET /api/cities?name=tor&country=CA
// City suggestions for the concert search, from setlist.fm's own city list: { cities: [...] }

import { NextRequest, NextResponse } from "next/server";
import { searchCities, SetlistFmError } from "@/lib/setlistfm";

export async function GET(request: NextRequest) {
  const name = (request.nextUrl.searchParams.get("name") ?? "").trim().slice(0, 60);
  const country = (request.nextUrl.searchParams.get("country") ?? "").trim();
  if (name.length < 2) return NextResponse.json({ cities: [] });
  if (country && !/^[A-Z]{2}$/.test(country)) return NextResponse.json({ error: "Invalid country." }, { status: 400 });

  try {
    return NextResponse.json({ cities: await searchCities(name, country || undefined) });
  } catch (err) {
    const status = err instanceof SetlistFmError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Couldn't look up cities.";
    return NextResponse.json({ error: message }, { status });
  }
}

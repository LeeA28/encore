// POST /api/upcoming  body: { city: "Toronto", artists: ["Charlie Puth", ...] }
// Upcoming shows by these artists within 100 km of the city, over the next 6 months (Ticketmaster).
// Returns { location: "Toronto, Canada", shows: [...] }, sorted by date.

import { NextRequest, NextResponse } from "next/server";
import { encodeGeohash } from "@/lib/geohash";
import { searchWindow, showsForArtist, type TicketmasterEvent, type UpcomingShow } from "@/lib/upcoming";

const RADIUS_KM = 100;
const MONTHS_AHEAD = 6;
const MAX_ARTISTS = 10;

// City name → coordinates, using Open-Meteo's free geocoding service (no key needed).
// Cached for 30 days, since cities don't move.
async function geocode(city: string) {
  const params = new URLSearchParams({ name: city, count: "1", language: "en", format: "json" });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, {
    next: { revalidate: 60 * 60 * 24 * 30 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const place = data.results?.[0];
  if (!place) return null;
  return {
    latitude: place.latitude as number,
    longitude: place.longitude as number,
    label: [place.name, place.country].filter(Boolean).join(", "),
  };
}

async function eventsFor(artist: string, geoPoint: string, apiKey: string): Promise<UpcomingShow[]> {
  const window = searchWindow(new Date(), MONTHS_AHEAD);
  const params = new URLSearchParams({
    apikey: apiKey,
    keyword: artist,
    classificationName: "music",
    geoPoint, // the location as a geohash (lib/geohash.ts)
    radius: String(RADIUS_KM),
    unit: "km",
    startDateTime: window.start,
    endDateTime: window.end,
    sort: "date,asc",
    size: "10",
  });
  // Cached for 6 hours: new shows don't appear often, and Ticketmaster limits requests per day
  const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`, {
    next: { revalidate: 60 * 60 * 6 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return showsForArtist(artist, (data._embedded?.events ?? []) as TicketmasterEvent[]);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: NextRequest) {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "TICKETMASTER_API_KEY is missing from .env.local" }, { status: 500 });

  const body = await request.json().catch(() => null);
  const city = typeof body?.city === "string" ? body.city.trim().slice(0, 100) : "";
  const artists: string[] = Array.isArray(body?.artists)
    ? body.artists.filter((a: unknown): a is string => typeof a === "string" && a.trim() !== "").slice(0, MAX_ARTISTS)
    : [];
  if (!city) return NextResponse.json({ error: "Enter a city." }, { status: 400 });

  const place = await geocode(city);
  if (!place) return NextResponse.json({ error: `Couldn't find "${city}". Try adding the country.` }, { status: 404 });
  const geoPoint = encodeGeohash(place.latitude, place.longitude, 9);

  // Ticketmaster allows about 5 requests per second, so artists are looked up 4 at a time
  const shows: UpcomingShow[] = [];
  for (let i = 0; i < artists.length; i += 4) {
    const batch = await Promise.all(artists.slice(i, i + 4).map((a) => eventsFor(a, geoPoint, apiKey)));
    shows.push(...batch.flat());
    if (i + 4 < artists.length) await sleep(1000);
  }

  shows.sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json({ location: place.label, shows });
}

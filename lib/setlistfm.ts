// Everything that talks to setlist.fm lives in this one file.
// It's only imported by the API route, so it only ever runs on the server.

const BASE_URL = "https://api.setlist.fm/rest/1.0";

// ---- Types describing setlist.fm's JSON ----
// These only list the fields Encore uses. setlist.fm sends more, and TypeScript is fine with that.

export type SetlistFmSong = {
  name: string;
  tape?: boolean; // "?" means optional: this field may be missing
  cover?: { name: string };
};

export type SetlistFmSetlist = {
  id: string;
  eventDate: string; // format "dd-MM-yyyy", e.g. "14-03-2025"
  url: string; // link to this setlist on setlist.fm
  artist: { name: string };
  venue: { name: string; city?: { name: string } };
  sets: { set: { song?: SetlistFmSong[] }[] };
};

export type SearchResponse = {
  total: number; // how many setlists match in total
  page: number; // which page this is
  itemsPerPage: number; // setlist.fm sends 20 per page
  setlist: SetlistFmSetlist[];
};

export type SearchOptions = {
  artistName: string;
  year?: string;
  cityName?: string;
  page?: number;
};

// A custom error that remembers an HTTP status code, so the route can pass it along
export class SetlistFmError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function searchSetlists(options: SearchOptions): Promise<SearchResponse> {
  // process.env reads values from .env.local. This only works on the server.
  const apiKey = process.env.SETLISTFM_API_KEY;
  if (!apiKey) {
    throw new SetlistFmError("SETLISTFM_API_KEY is missing from .env.local", 500);
  }

  // URLSearchParams builds "?artistName=...&p=1" and safely encodes spaces and symbols
  const params = new URLSearchParams({ artistName: options.artistName, p: String(options.page ?? 1) });
  if (options.year) params.set("year", options.year);
  if (options.cityName) params.set("cityName", options.cityName);

  const res = await fetch(`${BASE_URL}/search/setlists?${params}`, {
    headers: {
      "x-api-key": apiKey, // proves who we are
      Accept: "application/json", // asks for JSON (setlist.fm sends XML by default)
    },
  });

  // setlist.fm uses 404 to mean "no results", so treat that as an empty list, not an error
  if (res.status === 404) {
    return { total: 0, page: 1, itemsPerPage: 20, setlist: [] };
  }
  if (res.status === 429) {
    throw new SetlistFmError("Too many searches too quickly. Wait a moment and try again.", 429);
  }
  if (!res.ok) {
    throw new SetlistFmError(`setlist.fm returned an error (status ${res.status})`, res.status);
  }

  return res.json();
}

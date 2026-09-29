// Calls to Spotify's Web API (server-only). Uses the logged-in user's access token.
// Note: Spotify's February 2026 API changes capped search results at 10 and removed batch lookups,
// so everything here asks for one thing at a time and follows "next" links for more pages.

import { getAccessToken } from "./spotifyAuth";

const API = "https://api.spotify.com/v1";

export class SpotifyError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

// ---- The parts of Spotify's JSON that Encore uses ----
export type SpotifyArtist = { id: string; name: string };
export type SpotifyAlbum = {
  id: string;
  name: string;
  album_type: string; // "album", "single", or "compilation"
  release_date: string; // "2011-02-18", or sometimes just "2011"
  artists: SpotifyArtist[];
  total_tracks: number;
};
export type SpotifyTrack = { id: string; name: string; artists: SpotifyArtist[]; album?: { name: string } };
type Page<T> = { items: T[]; next: string | null }; // "next" is the URL of the next page, or null

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// One request to Spotify. Accepts a path like "/search?..." or a full "next" URL.
export async function spotifyGet<T>(pathOrUrl: string): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new SpotifyError("Connect your Spotify account first.", 401);

  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${API}${pathOrUrl}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (res.status === 401) throw new SpotifyError("Your Spotify login expired. Connect again.", 401);
  if (res.status === 403) {
    throw new SpotifyError(
      "Spotify refused this request. In development mode, your Spotify account must be added to the app's User Management list (and the app owner needs Premium).",
      403
    );
  }
  if (res.status === 429) {
    throw new SpotifyError("Too many requests to Spotify. Wait a minute and try again.", 429);
  }
  if (!res.ok) throw new SpotifyError(`Spotify returned an error (status ${res.status})`, res.status);
  return res.json();
}

// Follows "next" links until every page has been collected
async function getAllPages<T>(firstPath: string, maxPages = 10): Promise<T[]> {
  const items: T[] = [];
  let next: string | null = firstPath;
  for (let i = 0; next && i < maxPages; i++) {
    const page: Page<T> = await spotifyGet<Page<T>>(next);
    items.push(...page.items);
    next = page.next;
  }
  return items;
}

export type SearchType = "artist" | "album" | "track";

export async function search(type: SearchType, query: string) {
  const params = new URLSearchParams({ q: query, type, limit: "10" }); // 10 is Spotify's current maximum
  // Spotify groups results by type: { artists: { items } }, { albums: { items } }, { tracks: { items } }
  const data = await spotifyGet<Record<string, Page<unknown>>>(`/search?${params}`);
  return data[`${type}s`]?.items ?? [];
}

// An artist's studio albums and singles (compilations and "appears on" are skipped on purpose)
export async function getArtistAlbums(artistId: string): Promise<SpotifyAlbum[]> {
  const params = new URLSearchParams({ include_groups: "album,single" });
  return getAllPages<SpotifyAlbum>(`/artists/${artistId}/albums?${params}`);
}

export async function getAlbumTracks(albumId: string): Promise<SpotifyTrack[]> {
  return getAllPages<SpotifyTrack>(`/albums/${albumId}/tracks`);
}

// Every track from every album and single, oldest release first, so original versions come first
export async function getDiscographyTracks(artistId: string, maxReleases = 60) {
  const albums = (await getArtistAlbums(artistId))
    .sort((a, b) => a.release_date.localeCompare(b.release_date))
    .slice(0, maxReleases);

  const results: { track: SpotifyTrack; album: SpotifyAlbum }[] = [];
  for (const album of albums) {
    const tracks = await getAlbumTracks(album.id);
    results.push(...tracks.map((track) => ({ track, album })));
    await sleep(100); // a short pause between albums to go easy on Spotify's rate limit
  }
  return results;
}

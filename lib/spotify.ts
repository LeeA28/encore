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

// Errors that usually go away if you wait and try again:
// 429 = too many requests, 500/502/503/504 = a temporary problem on Spotify's side
const TEMPORARY_ERRORS = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;

// How long to wait before trying again. Each retry waits twice as long as the last
// (0.5s, 1s, 2s...), called "exponential backoff", which gives an overloaded server room to recover.
// For 429, Spotify says exactly how long to wait in the Retry-After header (in seconds).
function retryDelay(attempt: number, res?: Response): number {
  const retryAfter = Number(res?.headers.get("Retry-After"));
  if (retryAfter > 0) return Math.min(retryAfter, 10) * 1000;
  return 500 * 2 ** attempt;
}

// One request to Spotify. Accepts a path like "/search?..." or a full "next" URL.
// GET by default; pass a body to send a POST (used for creating playlists).
// Temporary errors are retried automatically.
// method: GET by default, POST when there's a body, or set it yourself (e.g. "PUT")
export async function spotifyGet<T>(pathOrUrl: string, body?: unknown, method?: string): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new SpotifyError("Connect your Spotify account first.", 401);

  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${API}${pathOrUrl}`;

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: method ?? (body === undefined ? "GET" : "POST"),
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      // The request never got an answer (network hiccup): also worth retrying
      if (attempt + 1 < MAX_ATTEMPTS) {
        await sleep(retryDelay(attempt));
        continue;
      }
      throw new SpotifyError("Couldn't reach Spotify. Check your connection and try again.", 503);
    }

    if (TEMPORARY_ERRORS.has(res.status) && attempt + 1 < MAX_ATTEMPTS) {
      console.warn(`Spotify returned ${res.status} for ${url}. Retrying (attempt ${attempt + 2} of ${MAX_ATTEMPTS})...`);
      await sleep(retryDelay(attempt, res));
      continue;
    }

    if (res.status === 401) throw new SpotifyError("Your Spotify login expired. Connect again.", 401);
    if (res.status === 403) {
    // In Spotify's development mode, only Spotify accounts invited in the app's User Management (up to 5)
    // can use it; anyone else gets 403. Written for users, since that's who will see it.
    throw new SpotifyError(
      "Spotify features are in a limited beta, so only invited Spotify accounts can use them right now. Everything else in Encore works without Spotify.",
      403
    );
  }
    if (res.status === 429) {
      throw new SpotifyError("Too many requests to Spotify. Wait a minute and try again.", 429);
    }
    if (!res.ok) {
      console.error(`Spotify returned ${res.status} for ${url}`);
      throw new SpotifyError(`Spotify returned an error (status ${res.status})`, res.status);
    }
    // Some requests (like saving to the library) succeed with an empty response, which isn't valid JSON
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  }
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

// ---- Playlists ----

const sleepBriefly = () => sleep(200); // spacing between searches, to stay under Spotify's rate limit

// Searches for tracks only (used by song matching)
export async function searchTracks(query: string): Promise<SpotifyTrack[]> {
  return (await search("track", query)) as SpotifyTrack[];
}

export async function pauseBetweenRequests() {
  await sleepBriefly();
}

// Creates a new playlist in the logged-in user's Spotify account, then adds the tracks in order.
// Spotify accepts at most 100 tracks per request, so bigger playlists are added in chunks.
export async function createPlaylist(name: string, description: string, trackIds: string[]) {
  const playlist = await spotifyGet<{ id: string; external_urls: { spotify: string } }>("/me/playlists", {
    name,
    description,
    public: false,
  });

  for (let i = 0; i < trackIds.length; i += 100) {
    const chunk = trackIds.slice(i, i + 100);
    await spotifyGet(`/playlists/${playlist.id}/items`, { uris: chunk.map((id) => `spotify:track:${id}`) });
  }

  return { id: playlist.id, url: playlist.external_urls.spotify };
}

// ---- Is a playlist still in the user's library? ----
// "Deleting" a playlist you made on Spotify doesn't erase it: it only removes it from your library
// (the playlist, its songs, and its link still exist). So "is it deleted?" really means
// "is it still in your library?", and restoring it means adding it back.

const playlistUri = (id: string) => `spotify:playlist:${id}`;

// For each playlist id: true if it's in the library. Uses GET /me/library/contains (added in
// Spotify's February 2026 API changes), which answers for many items at once, in the same order.
export async function playlistsInLibrary(ids: string[]): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20);
    const params = new URLSearchParams({ uris: chunk.map(playlistUri).join(",") });
    const answers = await spotifyGet<boolean[]>(`/me/library/contains?${params}`);
    chunk.forEach((id, index) => (result[id] = answers?.[index] === true));
  }
  return result;
}

// Adds the playlist back to the library, exactly as it was (same songs, order, and link).
// PUT /me/library replaced the old "follow playlist" endpoint in February 2026.
export async function restorePlaylist(id: string) {
  const params = new URLSearchParams({ uris: playlistUri(id) });
  await spotifyGet(`/me/library?${params}`, undefined, "PUT");
}

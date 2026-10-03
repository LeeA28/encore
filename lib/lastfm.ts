// Last.fm requests (server-only): similar artists, and an artist's MusicBrainz ID.
// Both are cached for a day, since they barely change.

import type { SimilarArtist } from "./recommend";

const LASTFM_API = "https://ws.audioscrobbler.com/2.0/";

async function lastfm(method: string, artist: string, apiKey: string, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({
    method,
    artist,
    api_key: apiKey,
    format: "json",
    autocorrect: "1", // lets Last.fm fix small spelling differences in artist names
    ...extra,
  });
  const res = await fetch(`${LASTFM_API}?${params}`, { next: { revalidate: 60 * 60 * 24 } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.error ? null : data; // e.g. "The artist you supplied could not be found"
}

export async function similarArtists(artist: string, apiKey: string): Promise<SimilarArtist[]> {
  const data = await lastfm("artist.getsimilar", artist, apiKey, { limit: "30" });
  const list = data?.similarartists?.artist ?? [];
  // Last.fm sends the similarity as text ("0.95"), so it's converted to a number
  return list.map((a: { name: string; match: string; mbid?: string }) => ({
    name: a.name,
    match: Number(a.match) || 0,
    mbid: a.mbid || undefined, // MusicBrainz ID, used to recognize band members reliably
  }));
}

export async function musicBrainzId(artist: string, apiKey: string): Promise<string | undefined> {
  const data = await lastfm("artist.getinfo", artist, apiKey);
  return data?.artist?.mbid || undefined;
}

"use client";

// Search Spotify and add songs to a custom list: a whole discography, chosen albums, or single songs.

import { useState } from "react";
import type { RankItem } from "@/lib/types";

type SearchType = "artist" | "album" | "track";
type ArtistResult = { id: string; name: string };
type AlbumResult = { id: string; name: string; artist?: string; type?: string; year: string; totalTracks: number };

type Props = {
  onAdd: (items: RankItem[]) => void;
  existingKeys: Set<string>; // songs already in the list, so we can show "Added"
};

// A small helper: fetch JSON from our own API, and turn error responses into thrown errors
async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}

export default function SpotifyAdder({ onAdd, existingKeys }: Props) {
  const [type, setType] = useState<SearchType>("artist");
  const [query, setQuery] = useState("");
  const [artists, setArtists] = useState<ArtistResult[]>([]);
  const [albums, setAlbums] = useState<AlbumResult[]>([]);
  const [tracks, setTracks] = useState<RankItem[]>([]);
  const [browsing, setBrowsing] = useState<{ artist: ArtistResult; albums: AlbumResult[] } | null>(null);
  const [busy, setBusy] = useState(""); // describes what's loading, or "" when idle
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Runs any async action with a loading message and error handling
  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy("");
    }
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!query.trim()) return;
    run("Searching...", async () => {
      const data = await getJson<{ results: unknown[] }>(
        `/api/spotify/search?type=${type}&q=${encodeURIComponent(query.trim())}`
      );
      setBrowsing(null);
      setArtists(type === "artist" ? (data.results as ArtistResult[]) : []);
      setAlbums(type === "album" ? (data.results as AlbumResult[]) : []);
      setTracks(type === "track" ? (data.results as RankItem[]) : []);
    });
  }

  function add(items: RankItem[], what: string) {
    const newCount = items.filter((i) => !existingKeys.has(i.key)).length;
    onAdd(items);
    setMessage(`Added ${newCount} new song${newCount === 1 ? "" : "s"} from ${what}.`);
  }

  function addDiscography(artist: ArtistResult) {
    run(`Loading ${artist.name}'s discography (this can take a bit)...`, async () => {
      const data = await getJson<{ items: RankItem[] }>(`/api/spotify/discography?artistId=${artist.id}`);
      add(data.items, `${artist.name}'s discography`);
    });
  }

  function browseAlbums(artist: ArtistResult) {
    run(`Loading ${artist.name}'s albums...`, async () => {
      const data = await getJson<{ results: AlbumResult[] }>(`/api/spotify/albums?artistId=${artist.id}`);
      setBrowsing({ artist, albums: data.results });
    });
  }

  function addAlbum(album: AlbumResult) {
    run(`Loading ${album.name}...`, async () => {
      const params = new URLSearchParams({ albumId: album.id, albumName: album.name });
      const data = await getJson<{ items: RankItem[] }>(`/api/spotify/tracks?${params}`);
      add(data.items, album.name);
    });
  }

  const albumRow = (a: AlbumResult) => (
    <li key={a.id} className="result-row">
      <div className="song-info">
        <div className="song-name">{a.name}</div>
        <div className="song-artist">
          {[a.artist, a.year, a.type, `${a.totalTracks} tracks`].filter(Boolean).join(" · ")}
        </div>
      </div>
      <div className="actions">
        <button className="btn btn-light btn-small" onClick={() => addAlbum(a)} disabled={!!busy}>
          Add album
        </button>
      </div>
    </li>
  );

  return (
    <div className="panel">
      <div style={{ marginBottom: 12 }}>
        <strong>Add songs from Spotify</strong>
      </div>

      <form className="form-row" onSubmit={handleSearch}>
        <select className="select" value={type} onChange={(e) => setType(e.target.value as SearchType)}>
          <option value="artist">Artist</option>
          <option value="album">Album</option>
          <option value="track">Song</option>
        </select>
        <input className="input grow" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Spotify" />
        <button className="btn btn-light" type="submit" disabled={!!busy}>
          Search
        </button>
      </form>

      {busy && <p className="notice">{busy}</p>}
      {message && <p className="notice" style={{ color: "var(--green)" }}>{message}</p>}
      {error && <p className="error">{error}</p>}

      {browsing ? (
        <div style={{ marginTop: 12 }}>
          <div className="form-row">
            <span className="muted">Albums and singles by {browsing.artist.name}</span>
            <button className="btn btn-ghost btn-small" onClick={() => setBrowsing(null)}>
              Back to results
            </button>
          </div>
          <ul className="result-list">{browsing.albums.map(albumRow)}</ul>
        </div>
      ) : (
        <>
          <ul className="result-list">
            {artists.map((a) => (
              <li key={a.id} className="result-row">
                <div className="song-name">{a.name}</div>
                <div className="actions">
                  <button className="btn btn-light btn-small" onClick={() => addDiscography(a)} disabled={!!busy}>
                    Add discography
                  </button>
                  <button className="btn btn-ghost btn-small" onClick={() => browseAlbums(a)} disabled={!!busy}>
                    Choose albums
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <ul className="result-list">{albums.map(albumRow)}</ul>
          <ul className="result-list">
            {tracks.map((t) => (
              <li key={t.spotifyId ?? t.key} className="result-row">
                <div className="song-info">
                  <div className="song-name">{t.name}</div>
                  <div className="song-artist">
                    {t.artist}
                    {t.detail && ` · ${t.detail}`}
                  </div>
                </div>
                <div className="actions">
                  {existingKeys.has(t.key) ? (
                    <span className="pill">Added</span>
                  ) : (
                    <button className="btn btn-light btn-small" onClick={() => add([t], t.name)}>
                      Add
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

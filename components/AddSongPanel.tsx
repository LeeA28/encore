"use client";

// "+ Add a song": for songs you heard that setlist.fm's setlist is missing (like a secret song).
// Search Spotify and pick the exact track, or type the name yourself (e.g. for unreleased songs).

import { useState } from "react";
import type { Concert, RankItem } from "@/lib/types";
import { addSongToConcert } from "@/lib/songs";

type Props = {
  concert: Concert;
  spotifyConnected: boolean | null;
  onSave: (concert: Concert) => void;
  onClose: () => void;
};

export default function AddSongPanel({ concert, spotifyConnected, onSave, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RankItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState("");

  async function search(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!query.trim()) return;
    if (!spotifyConnected) {
      add({ name: query }); // without Spotify, the search box simply adds what you typed
      return;
    }
    setBusy(true);
    setError("");
    try {
      // Searching "song name + artist" finds the right artist's version first
      const q = `${query.trim()} ${concert.artist}`;
      const res = await fetch(`/api/spotify/search?type=track&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResults(data.results);
      if (data.results.length === 0) setError("Nothing found on Spotify. You can add it as typed instead.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  function add(song: { name: string; artist?: string; spotifyId?: string }) {
    const result = addSongToConcert(concert, song);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onSave(result.concert);
    setAdded(song.name.trim());
    setError("");
    setResults([]);
    setQuery("");
  }

  return (
    <div className="panel" style={{ margin: "8px 0 0" }}>
      <form className="form-row" onSubmit={search}>
        <input
          className="input grow"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={spotifyConnected ? "Search for the song" : "Type the song's name"}
          autoFocus
        />
        <button className="btn btn-light btn-small" type="submit" disabled={busy}>
          {busy ? "Searching..." : spotifyConnected ? "Search" : "Add"}
        </button>
      </form>

      {added && <p className="notice" style={{ color: "var(--green)" }}>Added &quot;{added}&quot;.</p>}
      {error && <p className="error">{error}</p>}

      <ul className="result-list">
        {results.map((track) => (
          <li key={track.spotifyId ?? track.key} className="result-row">
            <div className="song-info">
              <div className="song-name">{track.name}</div>
              <div className="song-artist">
                {track.artist}
                {track.detail && ` · ${track.detail}`}
              </div>
            </div>
            <div className="actions">
              <button
                className="btn btn-light btn-small"
                onClick={() => add({ name: track.name, artist: track.artist, spotifyId: track.spotifyId })}
              >
                Add
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="form-row" style={{ marginTop: 8 }}>
        {spotifyConnected && query.trim() && (
          // For songs that aren't on Spotify, like an unreleased secret song
          <button className="btn btn-ghost btn-small" onClick={() => add({ name: query })}>
            Add &quot;{query.trim()}&quot; as typed
          </button>
        )}
        <button className="btn btn-ghost btn-small" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

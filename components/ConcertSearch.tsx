"use client";

import { useState } from "react";
import type { Concert } from "@/lib/types";
import { formatDate } from "@/lib/concerts";

// Props: the data and functions this component receives from its parent (EncoreApp).
// This component shows concerts and asks the parent to add/remove them; the parent owns the saved list.
type Props = {
  myConcerts: Concert[];
  onAdd: (concert: Concert) => void; // "a function that takes a Concert and returns nothing"
  onRemove: (id: string) => void;
};

export default function ConcertSearch({ myConcerts, onAdd, onRemove }: Props) {
  const [artist, setArtist] = useState("");
  const [year, setYear] = useState("");
  const [city, setCity] = useState("");
  const [results, setResults] = useState<Concert[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  // page 1 = a new search (replace results). page 2+ = "Load more" (add to the end).
  async function search(pageToLoad: number) {
    if (!artist.trim()) {
      setError("Enter an artist name.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ artist, year, city, page: String(pageToLoad) });
      const res = await fetch(`/api/search?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setResults(pageToLoad === 1 ? data.concerts : [...results, ...data.concerts]);
      setPage(pageToLoad);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    search(1);
  }

  const myIds = new Set(myConcerts.map((c) => c.id));
  const sortedMine = [...myConcerts].sort((a, b) => b.date.localeCompare(a.date)); // newest first

  return (
    <section>
      <h2>Find your concerts</h2>
      <form onSubmit={handleSubmit}>
        <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist" />
        <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year (optional)" />
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City (optional)" />
        <button type="submit" disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {searched && !error && results.length === 0 && (
        <p>No concerts found. Try removing the year or city, or check the spelling.</p>
      )}

      <ul>
        {results.map((c) => (
          <li key={c.id}>
            <strong>{formatDate(c.date)}</strong>: {c.artist} at {c.venue}
            {c.city && `, ${c.city}`} ({c.songs.length > 0 ? `${c.songs.length} songs` : "no setlist yet"}){" "}
            {myIds.has(c.id) ? (
              <button onClick={() => onRemove(c.id)}>Remove</button>
            ) : (
              <button onClick={() => onAdd(c)}>I was there</button>
            )}{" "}
            <a href={c.url} target="_blank" rel="noreferrer">
              View on setlist.fm
            </a>
            {c.songs.length > 0 && (
              <details>
                <summary>Setlist</summary>
                <ol>
                  {c.songs.map((song, i) => (
                    <li key={i}>
                      {song.name}
                      {song.coverOf && ` (${song.coverOf} cover)`}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </li>
        ))}
      </ul>
      {hasMore && (
        <button onClick={() => search(page + 1)} disabled={loading}>
          {loading ? "Loading..." : "Load more"}
        </button>
      )}

      <h2>Your concerts ({myConcerts.length})</h2>
      {myConcerts.length === 0 && <p>Search for an artist and add the shows you went to.</p>}
      <ul>
        {sortedMine.map((c) => (
          <li key={c.id}>
            <strong>{formatDate(c.date)}</strong>: {c.artist} at {c.venue}
            {c.city && `, ${c.city}`} ({c.songs.length} songs){" "}
            <button onClick={() => onRemove(c.id)}>Remove</button>{" "}
            <a href={c.url} target="_blank" rel="noreferrer">
              View on setlist.fm
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

"use client"; // runs in the browser, so it can use state and respond to the user

import { useState } from "react";
import type { Concert } from "@/lib/types";
import { formatDate } from "@/lib/concerts";

export default function HomePage() {
  const [query, setQuery] = useState(""); // what's typed in the box
  const [concerts, setConcerts] = useState<Concert[]>([]); // search results
  const [loading, setLoading] = useState(false); // true while waiting for the server
  const [error, setError] = useState(""); // error message to show, if any
  const [searched, setSearched] = useState(false); // has a search finished yet?

  async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const artist = query.trim();
    if (!artist) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/search?artist=${encodeURIComponent(artist)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConcerts(data.concerts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setConcerts([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  return (
    <div>
      <h1>Encore</h1>
      <p>See all the songs you&apos;ve heard live</p>

      <form onSubmit={handleSearch}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Artist name" />
        <button type="submit" disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {searched && !error && concerts.length === 0 && <p>No concerts found.</p>}

      <ul>
        {concerts.map((c) => (
          <li key={c.id}>
            <strong>{formatDate(c.date)}</strong>: {c.artist} at {c.venue}
            {c.city && `, ${c.city}`}{" "}
            ({c.songs.length > 0 ? `${c.songs.length} songs` : "no setlist yet"}){" "}
            <a href={c.url} target="_blank" rel="noreferrer">
              View on setlist.fm
            </a>
            {/* <details> is a built-in HTML dropdown: click the summary to show the songs */}
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
    </div>
  );
}
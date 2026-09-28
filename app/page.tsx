"use client";
import { useState } from "react";
import type { Concert } from "@/lib/types";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [concerts, setConcerts] = useState<Concert[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
 
      {/* .map() turns each concert object into an <li>. key helps React track which item is which. */}
      <ul>
        {concerts.map((c) => (
          <li key={c.id}>
            {c.date}: {c.artist} at {c.venue} ({c.songCount} songs)
          </li>
        ))}
      </ul>
    </div>
  );
}
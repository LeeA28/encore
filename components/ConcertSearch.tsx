"use client";

import { useState } from "react";
import type { Concert } from "@/lib/types";
import { formatDate, formatPlace } from "@/lib/concerts";
import { getCountries } from "@/lib/countries";
import { TicketIcon } from "./Icons";

// Built once when this file loads (not on every render), since the list never changes
const COUNTRIES = getCountries();

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
  const [country, setCountry] = useState(""); // 2-letter code like "CA", or "" for any country
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
      const params = new URLSearchParams({ artist, year, city, country, page: String(pageToLoad) });
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
    <>
      <section className="card">
        <div className="card-header">
          <div className="icon-badge" style={{ background: "var(--red)" }}>
            <TicketIcon />
          </div>
          <h1 className="card-title">concerts</h1>
        </div>
        <p className="card-desc">Search for the shows you&apos;ve been to and add them to your history.</p>

        <form className="form-row" onSubmit={handleSubmit}>
          <input className="input grow" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist" />
          <input className="input" style={{ width: 150 }} value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year" />
          <input className="input" style={{ width: 170 }} value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
          {/* Shows country names, but sends the 2-letter code that setlist.fm needs */}
          <select className="select" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Any country</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="btn btn-light" type="submit" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {error && <p className="error">{error}</p>}
        {searched && !error && results.length === 0 && (
          <p className="notice">No concerts found. Try removing the year, city, or country, or check the spelling.</p>
        )}

        <div className="concert-grid">
          {results.map((c) => (
            <ConcertCard
              key={c.id}
              concert={c}
              selected={myIds.has(c.id)}
              onToggle={() => (myIds.has(c.id) ? onRemove(c.id) : onAdd(c))}
            />
          ))}
        </div>

        {hasMore && (
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <button className="btn btn-ghost" onClick={() => search(page + 1)} disabled={loading}>
              {loading ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title" style={{ fontSize: 26 }}>
            your concerts
          </h2>
          <span className="pill">{myConcerts.length}</span>
        </div>
        {myConcerts.length === 0 ? (
          <p className="notice">Nothing here yet. Search above and tap &quot;I was there&quot; on the shows you went to.</p>
        ) : (
          <div className="concert-grid">
            {sortedMine.map((c) => (
              <ConcertCard key={c.id} concert={c} selected onToggle={() => onRemove(c.id)} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

// One concert as a small card. "selected" = it's in your concerts.
function ConcertCard({ concert: c, selected, onToggle }: { concert: Concert; selected: boolean; onToggle: () => void }) {
  return (
    <div className={`concert-card ${selected ? "selected" : ""}`}>
      <div className="concert-date">{formatDate(c.date)}</div>
      <div className="concert-artist">{c.artist}</div>
      <div className="concert-place">{formatPlace(c)}</div>

      {c.songs.length > 0 ? (
        <details>
          <summary>{c.songs.length} songs</summary>
          <ol>
            {c.songs.map((song, i) => (
              <li key={i}>
                {song.name}
                {song.coverOf && ` (${song.coverOf} cover)`}
              </li>
            ))}
          </ol>
        </details>
      ) : (
        <span className="muted" style={{ fontSize: 14 }}>
          No setlist yet
        </span>
      )}

      <div className="concert-actions">
        <button className={`btn btn-small ${selected ? "btn-ghost" : "btn-light"}`} onClick={onToggle}>
          {selected ? "Remove" : "I was there"}
        </button>
        {/* setlist.fm asks for a link back wherever their data is shown */}
        <a className="link-subtle" href={c.url} target="_blank" rel="noreferrer">
          setlist.fm ↗
        </a>
      </div>
    </div>
  );
}

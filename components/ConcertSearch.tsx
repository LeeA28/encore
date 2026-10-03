"use client";

import { useEffect, useState } from "react";
import type { Concert } from "@/lib/types";
import { formatCity, formatDate } from "@/lib/concerts";
import { getCountries } from "@/lib/countries";
import { addSongToConcert, removeAddedSong } from "@/lib/songs";
import { fetchConcertAdditions, newSuggestions, type ConcertAddition } from "@/lib/concertAdditions";
import AddSongPanel from "./AddSongPanel";
import { TicketIcon } from "./Icons";

// Built once when this file loads (not on every render), since the list never changes
const COUNTRIES = getCountries();

// Props: the data and functions this component receives from its parent (EncoreApp).
// This component shows concerts and asks the parent to add/remove them; the parent owns the saved list.
type Props = {
  myConcerts: Concert[];
  onAdd: (concert: Concert) => void; // "a function that takes a Concert and returns nothing"
  onRemove: (id: string) => void;
  onUpdate: (concert: Concert) => void; // saves a concert after adding or removing your own songs
  spotifyConnected: boolean | null;
};

export default function ConcertSearch({ myConcerts, onAdd, onRemove, onUpdate, spotifyConnected }: Props) {
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
  // signal: lets a newer search cancel this one if the user keeps typing
  async function search(pageToLoad: number, signal?: AbortSignal) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ artist: artist.trim(), year, city, country, page: String(pageToLoad) });
      const res = await fetch(`/api/search?${params}`, { signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setResults((prev) => (pageToLoad === 1 ? data.concerts : [...prev, ...data.concerts]));
      setPage(pageToLoad);
      setHasMore(data.hasMore);
      setSearched(true);
    } catch (err) {
      if (signal?.aborted) return; // cancelled because the user typed more: not a real error
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  // ---- Search as you type ----
  // Whenever the artist or a filter changes, wait until typing pauses for 600ms, then search.
  // Waiting matters: setlist.fm allows 2 requests per second and 1,440 per day, so searching
  // on every single keystroke would use those up fast.
  const readyToSearch = artist.trim().length >= 2 && (year === "" || /^\d{4}$/.test(year)); // skip partial years like "20"

  useEffect(() => {
    if (!readyToSearch) return;
    const controller = new AbortController(); // lets us cancel this search if the user keeps typing
    const timer = setTimeout(() => search(1, controller.signal), 600);
    // Cleanup runs before the next change: cancel the wait, and cancel the request if it already started
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- search only needs to re-run when these inputs change
  }, [artist, year, city, country, readyToSearch]);

  // Clearing the artist box clears the results right away
  function handleArtistChange(value: string) {
    setArtist(value);
    if (value.trim().length < 2) {
      setResults([]);
      setHasMore(false);
      setSearched(false);
      setError("");
    }
  }

  const myIds = new Set(myConcerts.map((c) => c.id));

  // Songs other Encore users added to the same shows you went to
  const [othersAdded, setOthersAdded] = useState<Record<string, ConcertAddition[]>>({});
  const myIdList = [...myIds].sort().join(","); // a simple value the effect can watch
  useEffect(() => {
    if (!myIdList) return;
    let cancelled = false;
    fetchConcertAdditions(myIdList.split(",")).then((result) => {
      if (!cancelled) setOthersAdded(result);
    });
    return () => {
      cancelled = true;
    };
  }, [myIdList]);
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
        <p className="card-desc">Type an artist to find the shows you&apos;ve been to, then add them to your history.</p>

        <div className="form-row">
          <input
            className="input grow"
            value={artist}
            onChange={(e) => handleArtistChange(e.target.value)}
            placeholder="Start typing an artist"
          />
          <input
            className="input"
            style={{ width: 120 }}
            inputMode="numeric"
            maxLength={4}
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))} // digits only
            placeholder="Year"
          />
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
        </div>
        {loading && <p className="notice">Searching...</p>}

        {error && <p className="error">{error}</p>}
        {searched && !loading && !error && results.length === 0 && (
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
              <ConcertCard
                key={c.id}
                concert={c}
                selected
                onToggle={() => onRemove(c.id)}
                editable={{ onUpdate, spotifyConnected }}
                suggestions={newSuggestions(c, othersAdded[c.id] ?? [])}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

// One concert as a small card. "selected" = it's in your concerts.
// Date, city, and tour stand out most; the artist is quieter, since you just searched for them.
// "editable" (only in Your concerts) adds "+ Add a song" and lets you remove songs you added.
function ConcertCard({
  concert: c,
  selected,
  onToggle,
  editable,
  suggestions = [],
}: {
  concert: Concert;
  selected: boolean;
  onToggle: () => void;
  editable?: { onUpdate: (concert: Concert) => void; spotifyConnected: boolean | null };
  suggestions?: ConcertAddition[]; // songs other people at this show added
}) {
  const [adding, setAdding] = useState(false);
  const addedCount = c.songs.filter((s) => s.addedByYou).length;

  return (
    <div className={`concert-card ${selected ? "selected" : ""}`}>
      <div className="concert-date">{formatDate(c.date)}</div>
      <div className="concert-city">{formatCity(c) || "Unknown city"}</div>
      {c.tour && <div className="concert-tour">{c.tour}</div>}
      <div className="concert-meta">
        {c.artist} · {c.venue}
      </div>

      {c.songs.length > 0 ? (
        <details>
          <summary>
            Setlist{addedCount > 0 && ` (${addedCount} added by you)`}
          </summary>
          <ol>
            {c.songs.map((song, i) => (
              <li key={i}>
                {song.name}
                {song.coverOf && ` (${song.coverOf} cover)`}
                {song.addedByYou && (
                  <>
                    {" "}
                    <span className="pill pill-blue">added by you</span>
                    {editable && (
                      <button
                        className="link-button"
                        style={{ marginTop: 0, marginLeft: 6, minHeight: 0 }}
                        onClick={() => editable.onUpdate(removeAddedSong(c, song.name))}
                      >
                        remove
                      </button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ol>
        </details>
      ) : (
        <span className="concert-meta">No setlist yet</span>
      )}

      {/* Songs other Encore users who were at this show added (like a secret song) */}
      {editable && suggestions.length > 0 && (
        <div className="panel" style={{ margin: "4px 0 0", padding: 12 }}>
          <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
            Others who were here added:
          </div>
          {suggestions.map((s) => (
            <div key={s.songName} className="form-row" style={{ justifyContent: "space-between" }}>
              <span>
                {s.songName}{" "}
                <span className="muted" style={{ fontSize: 13 }}>
                  ({s.people} {s.people === 1 ? "person" : "people"})
                </span>
              </span>
              <button
                className="btn btn-light btn-small"
                onClick={() => {
                  const result = addSongToConcert(c, { name: s.songName, spotifyId: s.spotifyId });
                  if ("concert" in result) editable.onUpdate(result.concert);
                }}
              >
                Add
              </button>
            </div>
          ))}
        </div>
      )}

      {editable && !adding && (
        <button className="btn btn-ghost btn-small" style={{ alignSelf: "flex-start" }} onClick={() => setAdding(true)}>
          + Add a song
        </button>
      )}
      {editable && adding && (
        <AddSongPanel
          concert={c}
          spotifyConnected={editable.spotifyConnected}
          onSave={editable.onUpdate}
          onClose={() => setAdding(false)}
        />
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

"use client";

// "Upcoming near you": shows by your recommended artists within 100 km of your city, over the next
// 6 months (Ticketmaster data). The city is typed once and remembered in this browser.

import { useEffect, useState } from "react";
import type { UpcomingShow } from "@/lib/upcoming";
import { formatDate } from "@/lib/concerts";
import { readLocal, writeLocal } from "@/lib/guestData";

const CITY_KEY = "encore:homeCity";

export default function UpcomingShows({ artists }: { artists: string[] }) {
  const [city, setCity] = useState<string>(() => readLocal(CITY_KEY, ""));
  const [draft, setDraft] = useState(city);
  const [result, setResult] = useState<{ location: string; shows: UpcomingShow[] } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const artistList = artists.join("|"); // a simple value the effect can watch

  useEffect(() => {
    if (!city || !artistList) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError("");
    });
    fetch("/api/upcoming", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, artists: artistList.split("|") }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error);
        if (!cancelled) setResult(body);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load upcoming shows.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [city, artistList]);

  function saveCity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = draft.trim();
    if (!next) return;
    writeLocal(CITY_KEY, next);
    setCity(next);
  }

  return (
    <>
      <h2 className="card-subtitle">upcoming near you</h2>
      <form className="form-row" onSubmit={saveCity} style={{ marginBottom: 8 }}>
        <input
          className="input grow"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Your city (like Toronto)"
        />
        <button className="btn btn-light btn-small" type="submit">
          {city ? "Change city" : "Show concerts"}
        </button>
      </form>

      {!city && <p className="notice">Enter your city to see upcoming shows by these artists within 100 km.</p>}
      {loading && <p className="notice">Looking for upcoming shows...</p>}
      {error && <p className="error">{error}</p>}
      {result && !loading && (
        <>
          <p className="muted" style={{ fontSize: 13 }}>
            Within 100 km of {result.location}, over the next 6 months
          </p>
          {result.shows.length === 0 && (
            <p className="notice">No upcoming shows by these artists nearby right now. Check back later.</p>
          )}
          <ul className="result-list">
            {result.shows.map((s) => (
              <li key={s.url} className="result-row">
                <div className="song-info">
                  <div className="song-name">
                    {s.artist} · {formatDate(s.date)}
                  </div>
                  <div className="song-artist">{[s.venue, s.city].filter(Boolean).join(", ")}</div>
                </div>
                <div className="actions">
                  <a className="btn btn-ghost btn-small" href={s.url} target="_blank" rel="noreferrer">
                    Tickets ↗
                  </a>
                </div>
              </li>
            ))}
          </ul>
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            Event data from{" "}
            <a href="https://www.ticketmaster.com" target="_blank" rel="noreferrer">
              Ticketmaster
            </a>
          </p>
        </>
      )}
    </>
  );
}

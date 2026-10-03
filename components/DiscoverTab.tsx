"use client";

// The discover tab: artists you might like, based on your tier rankings and the concerts you've
// been to. The scoring is in lib/recommend.ts; similar-artist data comes from Last.fm.

import { useEffect, useMemo, useState } from "react";
import type { SongCount } from "@/lib/types";
import type { EncoreDataApi } from "@/lib/useEncoreData";
import {
  buildTasteProfile,
  pickSeeds,
  reasonFor,
  scoreCandidates,
  type Recommendation,
  type SimilarArtist,
} from "@/lib/recommend";
import { SparkIcon } from "./Icons";

type Props = { songs: SongCount[]; data: EncoreDataApi };

export default function DiscoverTab({ songs, data }: Props) {
  // Step 1 and 2: your taste profile and top artists (recalculated only when your data changes)
  const profile = useMemo(
    () =>
      buildTasteProfile({
        concerts: data.concerts,
        songs,
        liveTiers: data.liveTiers,
        customLists: data.customLists,
      }),
    [data.concerts, songs, data.liveTiers, data.customLists]
  );
  const seeds = useMemo(() => pickSeeds(profile), [profile]);
  const seedNames = seeds.map((s) => s.artist).join("|"); // a simple value the effect below can watch

  const [similar, setSimilar] = useState<Record<string, SimilarArtist[]> | null>(null);
  const [error, setError] = useState("");

  // Look up similar artists for your top artists
  useEffect(() => {
    if (!seedNames) return;
    let cancelled = false;
    fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artists: seedNames.split("|") }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error);
        if (!cancelled) setSimilar(body.similar);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load recommendations.");
      });
    return () => {
      cancelled = true;
    };
  }, [seedNames]);

  // Step 3: score the similar artists
  const recommendations: Recommendation[] = useMemo(
    () => (similar ? scoreCandidates(profile, similar) : []),
    [profile, similar]
  );

  return (
    <section className="card">
      <div className="card-header">
        <div className="icon-badge" style={{ background: "var(--pink)" }}>
          <SparkIcon />
        </div>
        <h1 className="card-title">discover</h1>
      </div>
      <p className="card-desc">Artists you might love, based on the songs you&apos;ve ranked and the shows you&apos;ve seen.</p>

      {seeds.length === 0 ? (
        <p className="notice">Add some concerts or rank some songs first, and recommendations will appear here.</p>
      ) : (
        <>
          {/* Showing what the recommendations are based on makes them easy to trust (and to explain) */}
          <div className="stats">
            <span className="muted" style={{ fontSize: 14, alignSelf: "center" }}>
              Based on:
            </span>
            {seeds.map((s) => (
              <span key={s.artist} className="pill">
                {s.artist} · {s.score} pts
              </span>
            ))}
          </div>

          {error && <p className="error">{error}</p>}
          {!similar && !error && <p className="notice">Finding artists for you...</p>}
          {similar && recommendations.length === 0 && (
            <p className="notice">No recommendations yet. Try ranking more songs in the rank tab.</p>
          )}

          <ol className="song-rows">
            {recommendations.map((rec, i) => (
              <li key={rec.artist} className="song-row rec-row">
                <span className="song-rank">{i + 1}</span>
                <div className="song-info">
                  <div className="song-name">{rec.artist}</div>
                  <div className="song-artist">{reasonFor(rec.because)}</div>
                </div>
                <div className="rec-links">
                  <a
                    className="btn btn-ghost btn-small"
                    href={`https://open.spotify.com/search/${encodeURIComponent(rec.artist)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Spotify ↗
                  </a>
                  <a
                    className="btn btn-ghost btn-small"
                    href={`https://www.setlist.fm/search?query=${encodeURIComponent(rec.artist)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Concerts ↗
                  </a>
                </div>
              </li>
            ))}
          </ol>

          {/* Last.fm asks apps using its data to credit it */}
          <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
            Similar-artist data from{" "}
            <a href="https://www.last.fm" target="_blank" rel="noreferrer">
              Last.fm
            </a>
          </p>
        </>
      )}
    </section>
  );
}

"use client";

// The discover tab: artists you might like, based on your tier rankings and the concerts you've
// been to. The scoring is in lib/recommend.ts; similar-artist data comes from Last.fm.

import { useEffect, useMemo, useState } from "react";
import type { SongCount } from "@/lib/types";
import type { EncoreDataApi } from "@/lib/useEncoreData";
import {
  buildTasteProfile,
  diversify,
  toExclusions,
  pickSeeds,
  reasonFor,
  scoreCandidates,
  type Recommendation,
  type SimilarArtist,
} from "@/lib/recommend";
import { SparkIcon } from "./Icons";
import UpcomingShows from "./UpcomingShows";
import FansAlsoSaw from "./FansAlsoSaw";

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
    [data.concerts, songs, data.liveTiers, data.customLists],
  );
  const seeds = useMemo(() => pickSeeds(profile), [profile]);
  const seedNames = seeds.map((s) => s.artist).join("|"); // a simple value the effect below can watch

  const [similar, setSimilar] = useState<Record<
    string,
    SimilarArtist[]
  > | null>(null);
  // From MusicBrainz (slower, so it arrives after the first list): band members to skip,
  // and which bands each candidate belongs to
  const [bands, setBands] = useState<{
    exclude: { ids: string[]; names: string[] };
    memberOf: Record<string, string[]>;
  } | null>(null);
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
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : "Couldn't load recommendations.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [seedNames]);

  // Step 3: score the similar artists. A longer list (25) is kept, so there's room left after filtering.
  // Members of your top bands are skipped; when a band and its members are both here, the band stays.
  const candidates: Recommendation[] = useMemo(() => {
    if (!similar) return [];
    const exclude = bands
      ? toExclusions(bands.exclude.ids, bands.exclude.names)
      : undefined;
    return scoreCandidates(profile, similar, 25, exclude);
  }, [profile, similar, bands]);

  const recommendations = useMemo(
    () =>
      (bands ? diversify(candidates, bands.memberOf) : candidates).slice(0, 10),
    [candidates, bands],
  );

  // Once the first list is showing, check band memberships (slow the first time, cached after).
  // The candidates sent are scored WITHOUT the band filter, so receiving the results doesn't
  // change this list and trigger the check all over again.
  const candidateList = useMemo(
    () =>
      similar
        ? JSON.stringify(
            scoreCandidates(profile, similar, 15).map((c) => ({
              name: c.artist,
              mbid: c.mbid,
            })),
          )
        : "",
    [profile, similar],
  );
  const [checkingBands, setCheckingBands] = useState(false);
  // Which section is showing. Tabs (instead of one long page) mean nobody misses the other two.
  const [view, setView] = useState<"for-you" | "fans" | "upcoming">("for-you");
  useEffect(() => {
    if (!candidateList || !seedNames) return;
    let cancelled = false;
    Promise.resolve().then(() => !cancelled && setCheckingBands(true));
    fetch("/api/recommendations/bands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artists: seedNames.split("|"),
        candidates: JSON.parse(candidateList),
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled && body) setBands(body);
      })
      .catch(() => {}) // without member info, recommendations still work
      .finally(() => {
        if (!cancelled) setCheckingBands(false);
      });
    return () => {
      cancelled = true;
    };
  }, [candidateList, seedNames]);

  return (
    <section className="card">
      <div className="card-header">
        <div className="icon-badge" style={{ background: "var(--pink)" }}>
          <SparkIcon />
        </div>
        <h1 className="card-title">discover</h1>
      </div>
      <p className="card-desc">
        Artists you might love, based on the songs you&apos;ve ranked and the
        shows you&apos;ve seen.
      </p>

      {seeds.length === 0 ? (
        <p className="notice">
          Add some concerts or rank some songs first, and recommendations will
          appear here.
        </p>
      ) : (
        <>
          {/* Showing what the recommendations are based on makes them easy to trust (and to explain) */}
          <div className="stats">
            <span
              className="muted"
              style={{ fontSize: 14, alignSelf: "center" }}
            >
              Based on:
            </span>
            {/* Ordered from your top artist down; the points stay behind the scenes */}
            {seeds.map((s) => (
              <span key={s.artist} className="pill">
                {s.artist}
              </span>
            ))}
          </div>

          <div className="segmented" style={{ marginTop: 4 }}>
            <button
              className={view === "for-you" ? "active" : ""}
              onClick={() => setView("for-you")}
            >
              For you
            </button>
            <button
              className={view === "fans" ? "active" : ""}
              onClick={() => setView("fans")}
            >
              Fans also saw
            </button>
            <button
              className={view === "upcoming" ? "active" : ""}
              onClick={() => setView("upcoming")}
            >
              Upcoming
            </button>
          </div>

          {view === "fans" && (
            <FansAlsoSaw
              concertIds={data.concerts.map((c) => c.id)}
              profile={profile}
            />
          )}

          {view === "upcoming" &&
            (recommendations.length > 0 ? (
              <UpcomingShows artists={recommendations.map((r) => r.artist)} />
            ) : (
              <p className="notice">
                Upcoming shows appear here once your recommendations have
                loaded.
              </p>
            ))}

          {view === "for-you" && (
            <>
              {error && <p className="error">{error}</p>}
              {!similar && !error && (
                <p className="notice">Finding artists for you...</p>
              )}
              {checkingBands && (
                <p className="notice" style={{ fontSize: 13 }}>
                  Checking band members (this can take a little while the first
                  time)...
                </p>
              )}
              {similar && recommendations.length === 0 && (
                <p className="notice">
                  No recommendations yet. Try ranking more songs in the rank
                  tab.
                </p>
              )}

              <ol className="song-rows">
                {recommendations.map((rec, i) => (
                  <li key={rec.artist} className="song-row rec-row">
                    <span className="song-rank">{i + 1}</span>
                    <div className="song-info">
                      <div className="song-name">{rec.artist}</div>
                      <div className="song-artist">
                        {reasonFor(rec.because)}
                      </div>
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
        </>
      )}
    </section>
  );
}

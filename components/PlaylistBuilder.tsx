"use client";

// The playlist builder pop-up, used by the Songs tab and by tier lists.
//  1. Matching: finds the Spotify track for each song (songs from Spotify already have one)
//  2. Review: shows every match, lets you change or skip any, and search for songs that weren't found
//  3. Create: makes the playlist in your Spotify account and gives you a link to it

import { useEffect, useRef, useState } from "react";
import type { SavedPlaylist, TrackMatch } from "@/lib/types";
import type { SongToMatch } from "@/lib/matching";
import { cacheMatches, getCachedMatches } from "@/lib/matchCache";
import { useConfirm } from "./ConfirmDialog";

// A song going into the playlist. `match` is filled in already for songs added from Spotify.
export type PlaylistSong = SongToMatch & { match?: TrackMatch };

type Row = {
  song: PlaylistSong;
  match: TrackMatch | null;
  candidates: TrackMatch[]; // other possible tracks, for "Change"
  skipped: boolean;
  failed: boolean; // Spotify had errors, so this song was never properly checked (different from "not found")
};

type MatchResult = { key: string; match: TrackMatch | null; candidates: TrackMatch[]; failed: boolean };

type Props = {
  songs: PlaylistSong[]; // in playlist order
  defaultName: string;
  source: string; // e.g. "Songs heard live"
  spotifyConnected: boolean | null;
  returnTab: "songs" | "rank"; // where Spotify login should send you back to
  onCreated: (playlist: SavedPlaylist) => void;
  onClose: () => void;
};

const BATCH_SIZE = 10; // songs per request to /api/spotify/match

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    signal, // lets "Cancel" stop the request
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}

export default function PlaylistBuilder({
  songs,
  defaultName,
  source,
  spotifyConnected,
  returnTab,
  onCreated,
  onClose,
}: Props) {
  const confirm = useConfirm();
  const [phase, setPhase] = useState<"matching" | "review" | "creating" | "done">("matching");
  const [rows, setRows] = useState<Row[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 }); // songs matched so far, out of how many
  const [name, setName] = useState(defaultName);
  const [openKey, setOpenKey] = useState<string | null>(null); // the row whose "Change" panel is open
  const [error, setError] = useState("");
  const [createdUrl, setCreatedUrl] = useState("");

  // Only run the matching once, even though React runs effects twice in development
  const started = useRef(false);

  // "Cancel" uses this to stop any matching still in progress, so it doesn't keep
  // using up Spotify requests after the pop-up is closed
  const cancel = useRef(new AbortController());

  // Searches for these songs in small batches, one after another (shows progress and avoids
  // Spotify's rate limit). A batch that fails doesn't stop the rest: its songs are marked "failed".
  async function searchSongs(toSearch: PlaylistSong[], alreadyDone: number, total: number) {
    const results = new Map<string, MatchResult>();
    let done = alreadyDone;
    setProgress({ done, total });

    for (let i = 0; i < toSearch.length; i += BATCH_SIZE) {
      if (cancel.current.signal.aborted) break; // cancelled: stop sending requests
      const batch = toSearch.slice(i, i + BATCH_SIZE);
      try {
        const data = await postJson<{ results: MatchResult[] }>(
          "/api/spotify/match",
          { songs: batch.map(({ key, name, artist, coverOf }) => ({ key, name, artist, coverOf })) },
          cancel.current.signal
        );
        data.results.forEach((r) => results.set(r.key, r));
      } catch (err) {
        if (cancel.current.signal.aborted) break;
        batch.forEach((song) => results.set(song.key, { key: song.key, match: null, candidates: [], failed: true }));
        setError(err instanceof Error ? err.message : "Some songs couldn't be checked.");
      }
      done += batch.length;
      setProgress({ done, total });
    }
    return results;
  }

  // ---- 1. Matching ----
  useEffect(() => {
    if (started.current || !spotifyConnected) return;
    started.current = true;

    async function matchAll() {
      const cache = getCachedMatches();
      // Songs with a known track (from Spotify, or matched before) skip the search
      const initial: Row[] = songs.map((song) => {
        const known = song.match ?? cache[song.key];
        return { song, match: known ?? null, candidates: known ? [known] : [], skipped: false, failed: false };
      });
      const toSearch = initial.filter((r) => !r.match).map((r) => r.song);
      const results = await searchSongs(toSearch, initial.length - toSearch.length, initial.length);

      setRows(initial.map((row) => {
        const r = results.get(row.song.key);
        return r ? { ...row, match: r.match, candidates: r.candidates, failed: r.failed } : row;
      }));
      setPhase("review");
    }
    matchAll();
  }, [songs, spotifyConnected]);

  // "Retry these": search again for only the songs that failed
  async function retryFailed() {
    const failedSongs = rows.filter((r) => r.failed).map((r) => r.song);
    if (failedSongs.length === 0) return;
    setError("");
    setPhase("matching");
    const results = await searchSongs(failedSongs, 0, failedSongs.length);
    setRows((prev) =>
      prev.map((row) => {
        const r = results.get(row.song.key);
        return r ? { ...row, match: r.match, candidates: r.candidates, failed: r.failed } : row;
      })
    );
    setPhase("review");
  }

  // Closing asks first whenever work would be lost, then stops any matching still running
  async function close() {
    // Only ask when there's something to lose (not connected to Spotify yet = nothing started)
    if (spotifyConnected && (phase === "matching" || phase === "review")) {
      const ok = await confirm(
        phase === "matching"
          ? { title: "Stop making this playlist?", message: "The songs found so far won't be kept.", confirmLabel: "Stop", cancelLabel: "Keep going" }
          : {
              title: "Close without creating the playlist?",
              message: "Any matches you changed or skipped will be lost.",
              confirmLabel: "Close",
              cancelLabel: "Keep editing",
            }
      );
      if (!ok) return;
    }
    cancel.current.abort();
    onClose();
  }

  // ---- 2. Review ----
  function updateRow(key: string, change: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.song.key === key ? { ...r, ...change } : r)));
  }

  function chooseTrack(key: string, track: TrackMatch) {
    updateRow(key, { match: track, skipped: false });
    setOpenKey(null);
  }

  const matched = rows.filter((r) => r.match);
  const notFound = rows.filter((r) => !r.match && !r.failed);
  const failed = rows.filter((r) => !r.match && r.failed);
  const included = matched.filter((r) => !r.skipped);

  // ---- 3. Create ----
  async function create() {
    // The same track can be matched by two songs (e.g. two spellings): only add it once
    const trackIds = [...new Set(included.map((r) => r.match!.id))];
    setPhase("creating");
    setError("");
    try {
      const playlist = await postJson<{ id: string; url: string }>("/api/spotify/playlists", {
        name: name.trim() || defaultName,
        description: `Made with Encore from ${source.toLowerCase()}.`,
        trackIds,
      });

      // Remember these matches (including any you changed), so next time they're instant
      cacheMatches(Object.fromEntries(included.map((r) => [r.song.key, r.match!])));

      onCreated({
        spotifyId: playlist.id,
        name: name.trim() || defaultName,
        url: playlist.url,
        trackCount: trackIds.length,
        source,
        createdAt: new Date().toISOString(),
      });
      setCreatedUrl(playlist.url);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the playlist.");
      setPhase("review");
    }
  }

  // ---- What's shown ----
  let content: React.ReactNode;

  if (spotifyConnected === false) {
    content = (
      <>
        <p className="card-desc">To make a playlist, please connect your Spotify account.</p>
        {/* A normal link: Spotify login is a full visit to Spotify's site, which then sends you back to this tab */}
        <a className="btn btn-spotify" href={`/api/spotify/login?returnTo=${returnTab}`}>
          Connect Spotify
        </a>
      </>
    );
  } else if (phase === "matching") {
    const percent = progress.total === 0 ? 100 : Math.round((progress.done / progress.total) * 100);
    content = (
      <>
        <p className="card-desc">
          Finding your songs on Spotify: {progress.done} of {progress.total}
        </p>
        <div className="progress">
          <div className="progress-bar" style={{ width: `${percent}%` }} />
        </div>
      </>
    );
  } else if (phase === "done") {
    content = (
      <>
        <p className="card-desc">
          Your playlist is ready, with {[...new Set(included.map((r) => r.match!.id))].length} songs.
        </p>
        <div className="form-row">
          <a className="btn btn-spotify" href={createdUrl} target="_blank" rel="noreferrer">
            Open in Spotify ↗
          </a>
          <button className="btn btn-ghost" onClick={onClose}>
            Done
          </button>
        </div>
      </>
    );
  } else {
    // Match rate only counts songs that were actually checked
    const checked = rows.length - failed.length;
    const matchRate = checked === 0 ? 0 : Math.round((matched.length / checked) * 100);
    content = (
      <>
        <div className="stats">
          <span className="pill pill-blue">{matched.length} matched ({matchRate}%)</span>
          <span className={`pill ${notFound.length > 0 ? "pill-red" : ""}`}>{notFound.length} not found</span>
          {failed.length > 0 && <span className="pill pill-amber">{failed.length} couldn&apos;t be checked</span>}
          <span className="pill">{matched.length - included.length} skipped</span>
        </div>

        <div className="form-row" style={{ marginBottom: 12 }}>
          <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="Playlist name" />
          <button className="btn btn-spotify" onClick={create} disabled={phase === "creating" || included.length === 0}>
            {phase === "creating" ? "Creating..." : `Create playlist (${included.length})`}
          </button>
        </div>
        {error && <p className="error">{error}</p>}

        {/* Songs that need attention come first: not found (red), then couldn't check (amber) */}
        {notFound.length > 0 && (
          <>
            <h3 className="card-subtitle section-red" style={{ fontSize: 18, margin: "16px 0 4px" }}>
              Not found ({notFound.length})
            </h3>
            <p className="notice" style={{ marginTop: 0 }}>
              These might be live-only or unreleased songs. Search for them yourself, or leave them out.
            </p>
            {notFound.map((row) => (
              <MatchRow
                key={row.song.key}
                row={row}
                open={openKey === row.song.key}
                onToggleOpen={() => setOpenKey(openKey === row.song.key ? null : row.song.key)}
                onChoose={(track) => chooseTrack(row.song.key, track)}
              />
            ))}
          </>
        )}

        {failed.length > 0 && (
          <div className="panel panel-amber">
            <p style={{ marginBottom: 10 }}>
              Spotify had trouble with {failed.length} song{failed.length === 1 ? "" : "s"}, so{" "}
              {failed.length === 1 ? "it wasn't" : "they weren't"} checked yet. This is usually temporary.
            </p>
            <button className="btn btn-light btn-small" onClick={retryFailed}>
              Retry these
            </button>
          </div>
        )}

        <h3 className="card-subtitle" style={{ fontSize: 18, margin: "20px 0 4px" }}>
          Matched ({matched.length})
        </h3>
        {matched.length === 0 && <p className="notice">No songs were matched.</p>}
        {matched.map((row) => (
          <MatchRow
            key={row.song.key}
            row={row}
            open={openKey === row.song.key}
            onToggleOpen={() => setOpenKey(openKey === row.song.key ? null : row.song.key)}
            onChoose={(track) => chooseTrack(row.song.key, track)}
            onToggleSkip={() => updateRow(row.song.key, { skipped: !row.skipped })}
          />
        ))}

      </>
    );
  }

  return (
    // Unlike the other pop-ups, clicking the dimmed background does nothing here: it's too easy to
    // click by accident while waiting, and it would throw away the matching. Use Cancel/Close instead.
    <div className="modal-backdrop">
      <div className="card modal wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="card-header" style={{ justifyContent: "space-between" }}>
          <h2 className="card-title" style={{ fontSize: 26 }}>
            make a playlist
          </h2>
          {phase !== "creating" && (
            <button className="btn btn-ghost btn-small" onClick={close}>
              {spotifyConnected && phase === "matching" ? "Cancel" : "Close"}
            </button>
          )}
        </div>
        <p className="muted" style={{ marginBottom: 12 }}>
          From: {source}
        </p>
        {content}
      </div>
    </div>
  );
}

// One song in the review list: the song, the track it's matched to, and buttons to change or skip it
function MatchRow(props: {
  row: Row;
  open: boolean;
  onToggleOpen: () => void;
  onChoose: (track: TrackMatch) => void;
  onToggleSkip?: () => void;
}) {
  const { row } = props;
  return (
    <div className={`match-row ${row.skipped ? "skipped" : ""} ${row.match ? "" : "not-found"}`}>
      <div style={{ minWidth: 0 }}>
        <div className="song-name">{row.song.name}</div>
        <div className="song-artist">{row.song.artist}</div>
      </div>

      {/* Only matched songs show a track bubble; not-found rows are already marked by their red styling */}
      {row.match && (
        <div className="match-track found">
          <div className="song-chip-name">{row.match.name}</div>
          <div className="song-chip-meta">
            {row.match.artist}
            {row.match.album && ` · ${row.match.album}`}
          </div>
        </div>
      )}

      <div className="form-row" style={{ flexWrap: "nowrap" }}>
        <button className="btn btn-ghost btn-small" onClick={props.onToggleOpen}>
          {row.match ? "Change" : "Search"}
        </button>
        {props.onToggleSkip && (
          <button className="btn btn-ghost btn-small" onClick={props.onToggleSkip}>
            {row.skipped ? "Include" : "Skip"}
          </button>
        )}
      </div>

      {props.open && (
        <div className="match-options">
          <TrackPicker song={row.song} candidates={row.candidates.filter((c) => c.id !== row.match?.id)} onChoose={props.onChoose} />
        </div>
      )}
    </div>
  );
}

// The "Change" panel: other tracks the search found, plus your own Spotify search
function TrackPicker(props: { song: PlaylistSong; candidates: TrackMatch[]; onChoose: (track: TrackMatch) => void }) {
  const [query, setQuery] = useState(`${props.song.name} ${props.song.artist}`);
  const [results, setResults] = useState<TrackMatch[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function search(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/spotify/search?type=track&q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // The search route returns tracks in the tier-list shape; convert to TrackMatch
      setResults(
        (data.results as { spotifyId?: string; name: string; artist: string; detail?: string }[])
          .filter((t) => t.spotifyId)
          .map((t) => ({ id: t.spotifyId!, name: t.name, artist: t.artist, album: t.detail }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  const list = results.length > 0 ? results : props.candidates;

  return (
    <div>
      <form className="form-row" onSubmit={search}>
        <input className="input grow" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Spotify" />
        <button className="btn btn-light btn-small" type="submit" disabled={busy}>
          {busy ? "Searching..." : "Search"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {results.length === 0 && props.candidates.length > 0 && (
        <p className="notice" style={{ marginBottom: 0 }}>
          Other results:
        </p>
      )}
      <ul className="result-list">
        {list.map((track) => (
          <li key={track.id} className="result-row">
            <div className="song-info">
              <div className="song-name">{track.name}</div>
              <div className="song-artist">
                {track.artist}
                {track.album && ` · ${track.album}`}
              </div>
            </div>
            <div className="actions">
              <button className="btn btn-light btn-small" onClick={() => props.onChoose(track)}>
                Use this
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

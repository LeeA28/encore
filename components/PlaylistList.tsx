"use client";

// "Your playlists" on the Songs tab. When it opens, it checks once whether each playlist is still in
// your Spotify library. Ones you deleted in Spotify get Restore (bring it back exactly as it was)
// and Remove (take it off this list).
//
// Why check when the list appears, instead of when you click Open? Browsers block new tabs that open
// after a delay (like waiting for Spotify to answer), treating them as pop-ups. Checking ahead of time
// means Open still opens instantly.

import { useEffect, useState } from "react";
import type { SavedPlaylist } from "@/lib/types";
import { useConfirm } from "./ConfirmDialog";

type Status = "checking" | "ok" | "gone" | "unknown";

type Props = {
  playlists: SavedPlaylist[];
  spotifyConnected: boolean | null;
  onRemove: (spotifyId: string) => void;
  onUpdate: (playlist: SavedPlaylist) => void; // re-match and replace its songs with the current ones
};

export default function PlaylistList({ playlists, spotifyConnected, onRemove, onUpdate }: Props) {
  const confirm = useConfirm();
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // A string version of the ids, so the effect only re-runs when the actual list of playlists changes
  const idList = playlists.map((p) => p.spotifyId).join(",");

  useEffect(() => {
    if (!spotifyConnected || !idList) return;
    let cancelled = false;
    fetch(`/api/spotify/playlists/status?ids=${encodeURIComponent(idList)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (cancelled) return;
        const next: Record<string, Status> = {};
        for (const [id, inLibrary] of Object.entries(data.status as Record<string, boolean>)) {
          next[id] = inLibrary ? "ok" : "gone";
        }
        setStatus(next);
      })
      .catch(() => {
        // Couldn't check (e.g. Spotify needs reconnecting for the new permissions): just show the list as usual
        if (!cancelled) setStatus({});
      });
    return () => {
      cancelled = true;
    };
  }, [idList, spotifyConnected]);

  async function restore(playlist: SavedPlaylist) {
    setBusyId(playlist.spotifyId);
    setError("");
    try {
      const res = await fetch("/api/spotify/playlists/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: playlist.spotifyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatus((prev) => ({ ...prev, [playlist.spotifyId]: "ok" }));
    } catch (err) {
      const reason = err instanceof Error ? err.message : "";
      setError(
        `Couldn't restore "${playlist.name}". ${reason} If it keeps failing, remove it and make a new playlist.`.trim()
      );
    } finally {
      setBusyId(null);
    }
  }

  async function remove(playlist: SavedPlaylist) {
    const ok = await confirm({
      title: `Remove "${playlist.name}" from Encore?`,
      message:
        status[playlist.spotifyId] === "gone"
          ? "It's already deleted in Spotify, so this just removes it from this list."
          : "It stays in your Spotify account. This only removes it from this list.",
      confirmLabel: "Remove",
    });
    if (ok) onRemove(playlist.spotifyId);
  }

  return (
    <>
      <h2 className="card-subtitle">your playlists</h2>
      {error && <p className="error">{error}</p>}
      <ul className="result-list" style={{ marginTop: 0 }}>
        {playlists.map((p) => {
          const gone = status[p.spotifyId] === "gone";
          return (
            <li key={p.spotifyId} className="result-row">
              <div className="song-info">
                <div className="song-name">
                  {p.name} {gone && <span className="pill pill-red">Deleted in Spotify</span>}
                </div>
                <div className="song-artist">
                  {p.trackCount} songs · {p.source} · {new Date(p.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="actions">
                {gone ? (
                  <button
                    className="btn btn-spotify btn-small"
                    onClick={() => restore(p)}
                    disabled={busyId === p.spotifyId}
                  >
                    {busyId === p.spotifyId ? "Restoring..." : "Restore"}
                  </button>
                ) : (
                  <a className="btn btn-ghost btn-small" href={p.url} target="_blank" rel="noreferrer">
                    Open ↗
                  </a>
                )}
                {/* Only playlists made after updating was added remember what they were made from */}
                {!gone && p.sourceRef && spotifyConnected && (
                  <button className="btn btn-ghost btn-small" onClick={() => onUpdate(p)}>
                    Update
                  </button>
                )}
                <button className="btn btn-ghost btn-small" onClick={() => remove(p)}>
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

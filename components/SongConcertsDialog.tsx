"use client";

// The pop-up when you click a song in the Songs tab: every concert of yours where it was played,
// newest first. In a saved list, the list's concerts are highlighted.

import { useEffect } from "react";
import type { Concert, SongCount } from "@/lib/types";
import { concertsForSong } from "@/lib/songs";
import { formatCity, formatDate } from "@/lib/concerts";

type Props = {
  song: SongCount;
  concerts: Concert[]; // all of Your concerts
  highlightIds?: Set<string>; // the saved list's concerts, when viewing a list
  onClose: () => void;
};

export default function SongConcertsDialog({ song, concerts, highlightIds, onClose }: Props) {
  const shows = concertsForSong(song.key, concerts);
  const addedByYou = shows.some((c) =>
    c.songs.some((s) => s.addedByYou && s.name.trim().toLowerCase() === song.name.trim().toLowerCase())
  );

  // Escape closes it, like Encore's other pop-ups
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal" role="dialog" aria-modal="true" aria-label={song.name} onClick={(e) => e.stopPropagation()}>
        <div className="card-header" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 className="card-title" style={{ fontSize: 24 }}>
              {song.name}
            </h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              {song.artist}
              {song.coverOf && ` · cover of ${song.coverOf}`}
              {addedByYou && " · added by you"}
            </p>
          </div>
          <button className="btn btn-ghost btn-small" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="card-desc">
          Heard live {shows.length} {shows.length === 1 ? "time" : "times"}
          {highlightIds && ` (${shows.filter((c) => highlightIds.has(c.id)).length} in this list)`}:
        </p>

        <ul className="result-list" style={{ marginTop: 0, maxHeight: "55vh", overflowY: "auto" }}>
          {shows.map((c) => {
            const inList = highlightIds?.has(c.id);
            return (
              <li key={c.id} className={`result-row ${inList ? "in-list" : ""}`}>
                <div className="song-info">
                  <div className="song-name">
                    {formatDate(c.date)} · {formatCity(c) || "Unknown city"}
                    {inList && (
                      <>
                        {" "}
                        <span className="pill pill-green">In this list</span>
                      </>
                    )}
                  </div>
                  <div className="song-artist">
                    {c.venue}
                    {c.tour && ` · ${c.tour}`}
                  </div>
                </div>
                <div className="actions">
                  <a className="btn btn-ghost btn-small" href={c.url} target="_blank" rel="noreferrer">
                    setlist.fm ↗
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

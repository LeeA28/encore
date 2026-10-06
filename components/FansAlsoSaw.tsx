"use client";

// "People who saw the same shows also saw...": collaborative filtering from Encore's own users
// (lib/coAttendance.ts). Only artists that at least 3 different people connect to are shown.

import { useEffect, useState } from "react";
import type { TasteProfile } from "@/lib/recommend";
import { fetchCoAttended, newToYou, type CoAttendedArtist } from "@/lib/coAttendance";

export default function FansAlsoSaw({ concertIds, profile }: { concertIds: string[]; profile: TasteProfile }) {
  const [rows, setRows] = useState<CoAttendedArtist[] | null>(null);
  const idList = [...concertIds].sort().join(",");

  useEffect(() => {
    if (!idList) return;
    let cancelled = false;
    fetchCoAttended(idList.split(",")).then((result) => {
      if (!cancelled) setRows(result);
    });
    return () => {
      cancelled = true;
    };
  }, [idList]);

  const artists = rows ? newToYou(rows, profile) : [];

  return (
    <>
      <p className="muted" style={{ fontSize: 14 }}>
        Artists that other Encore users who were at your shows have also seen live.
      </p>
      {rows === null && <p className="notice">Checking what other fans have seen...</p>}
      {rows !== null && artists.length === 0 && (
        // The "cold start problem": this kind of recommendation needs other people's data first
        <p className="notice">
          Not enough Encore users have been to your shows yet. This fills in as more people use Encore.
        </p>
      )}
      <ol className="song-rows">
        {artists.map((a, i) => (
          <li key={a.artist} className="song-row rec-row">
            <span className="song-rank">{i + 1}</span>
            <div className="song-info">
              <div className="song-name">{a.artist}</div>
              <div className="song-artist">{a.people} people who were at your shows have also seen them live</div>
            </div>
            <div className="rec-links">
              <a
                className="btn btn-ghost btn-small"
                href={`https://open.spotify.com/search/${encodeURIComponent(a.artist)}`}
                target="_blank"
                rel="noreferrer"
              >
                Spotify ↗
              </a>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

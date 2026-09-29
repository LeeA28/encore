"use client";

import type { SongCount } from "@/lib/types";
import { NoteIcon } from "./Icons";

type Props = {
  songs: SongCount[];
  concertCount: number;
};

export default function SongList({ songs, concertCount }: Props) {
  // Total performances heard = the sum of every song's count
  const totalHeard = songs.reduce((sum, s) => sum + s.timesHeard, 0);

  return (
    <section className="card">
      <div className="card-header">
        <div className="icon-badge" style={{ background: "var(--teal)" }}>
          <NoteIcon />
        </div>
        <h1 className="card-title">songs</h1>
      </div>
      <p className="card-desc">Every song you&apos;ve heard live, from most heard to least.</p>

      {songs.length === 0 ? (
        <p className="notice">Add some concerts in the concerts tab first.</p>
      ) : (
        <>
          <div className="stats">
            <span className="pill">{concertCount} concerts</span>
            <span className="pill">{totalHeard} songs heard</span>
            <span className="pill">{songs.length} different songs</span>
          </div>
          {/* Placeholder until playlists are built */}
          <button className="btn btn-light" onClick={() => alert("Spotify playlists are coming soon.")}>
            Make a playlist
          </button>

          <ol className="song-rows" style={{ marginTop: 20 }}>
            {songs.map((s, i) => (
              <li key={s.key} className="song-row">
                <span className="song-rank">{i + 1}</span>
                <div className="song-info">
                  <div className="song-name">{s.name}</div>
                  <div className="song-artist">
                    {s.artist}
                    {s.coverOf && ` · cover of ${s.coverOf}`}
                  </div>
                </div>
                <span className="count-pill">{s.timesHeard}×</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

"use client";

import { useState } from "react";
import type { SavedPlaylist, SongCount } from "@/lib/types";
import { groupByArtist } from "@/lib/songs";
import PlaylistBuilder from "./PlaylistBuilder";
import PlaylistList from "./PlaylistList";
import { NoteIcon } from "./Icons";

type Props = {
  songs: SongCount[];
  concertCount: number;
  playlists: SavedPlaylist[];
  onPlaylistCreated: (playlist: SavedPlaylist) => void;
  onPlaylistRemoved: (spotifyId: string) => void;
  spotifyConnected: boolean | null;
};

export default function SongList({
  songs,
  concertCount,
  playlists,
  onPlaylistCreated,
  onPlaylistRemoved,
  spotifyConnected,
}: Props) {
  const [building, setBuilding] = useState(false);

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
          <button className="btn btn-spotify" onClick={() => setBuilding(true)}>
            Make a playlist
          </button>
          {spotifyConnected === false && (
            <span className="muted" style={{ marginLeft: 12, fontSize: 14 }}>
              Connect Spotify (top right) first
            </span>
          )}

          {playlists.length > 0 && (
            <PlaylistList playlists={playlists} spotifyConnected={spotifyConnected} onRemove={onPlaylistRemoved} />
          )}

          <h2 className="card-subtitle">all songs</h2>
          <ol className="song-rows">
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

      {building && (
        <PlaylistBuilder
          // Grouped by artist (artists ordered by their most-heard song), each artist's songs most heard first
          songs={groupByArtist(songs).map((s) => ({
            key: s.key,
            name: s.name,
            artist: s.artist,
            coverOf: s.coverOf,
            // Songs you added from Spotify already know their exact track, so they skip matching
            match: s.spotifyId ? { id: s.spotifyId, name: s.name, artist: s.coverOf ?? s.artist } : undefined,
          }))}
          defaultName="Encore: every song I've heard live"
          source="Songs heard live"
          spotifyConnected={spotifyConnected}
          returnTab="songs"
          onCreated={onPlaylistCreated}
          onClose={() => setBuilding(false)}
        />
      )}
    </section>
  );
}

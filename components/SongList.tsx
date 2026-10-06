"use client";

// The Songs tab: every song you've heard live, or just the songs from one of your saved lists
// (named groups of concerts you picked, like "2026")

import { useMemo, useState } from "react";
import type { Concert, SavedList, SavedPlaylist, SongCount } from "@/lib/types";
import { countSongs, groupByArtist } from "@/lib/songs";
import { concertsInList } from "@/lib/savedLists";
import PlaylistBuilder from "./PlaylistBuilder";
import PlaylistList from "./PlaylistList";
import SavedListEditor from "./SavedListEditor";
import { useConfirm } from "./ConfirmDialog";
import { NoteIcon } from "./Icons";

type Props = {
  concerts: Concert[];
  songs: SongCount[]; // songs from all concerts
  playlists: SavedPlaylist[];
  onPlaylistCreated: (playlist: SavedPlaylist) => void;
  onPlaylistRemoved: (spotifyId: string) => void;
  spotifyConnected: boolean | null;
  savedLists: SavedList[];
  onCreateList: (name: string, concertIds: string[]) => string;
  onUpdateList: (id: string, change: (list: SavedList) => SavedList) => void;
  onDeleteList: (id: string) => void;
  onRankList: (id: string) => void; // opens this list's tier list in the Rank tab
};

export default function SongList(props: Props) {
  const { concerts, playlists, spotifyConnected, savedLists } = props;
  const confirm = useConfirm();
  const [selectedId, setSelectedId] = useState<string>("all"); // "all", or a saved list's id
  const [editing, setEditing] = useState<"new" | "edit" | null>(null);
  const [building, setBuilding] = useState(false);

  // If the selected list was deleted, fall back to all songs
  const selected = savedLists.find((l) => l.id === selectedId);

  // The songs being shown: all of them, or a saved list's (always worked out from its concerts)
  const listConcerts = useMemo(() => (selected ? concertsInList(selected, concerts) : concerts), [selected, concerts]);
  const songs = useMemo(() => (selected ? countSongs(listConcerts) : props.songs), [selected, listConcerts, props.songs]);
  const totalHeard = songs.reduce((sum, s) => sum + s.timesHeard, 0);

  async function deleteSelected() {
    if (!selected) return;
    const ok = await confirm({
      title: `Delete "${selected.name}"?`,
      message: "Its tier list will be deleted. Playlists you made from it stay in Spotify.",
      confirmLabel: "Delete list",
      danger: true,
    });
    if (!ok) return;
    props.onDeleteList(selected.id);
    setEditing(null);
    setSelectedId("all");
  }

  return (
    <section className="card">
      <div className="card-header">
        <div className="icon-badge" style={{ background: "var(--teal)" }}>
          <NoteIcon />
        </div>
        <h1 className="card-title">songs</h1>
      </div>
      <p className="card-desc">
        {selected
          ? `Songs from the ${listConcerts.length} ${listConcerts.length === 1 ? "concert" : "concerts"} in "${selected.name}," from most heard to least.`
          : "Every song you've heard live, from most heard to least."}
      </p>

      {/* Switch between all songs and your saved lists */}
      {concerts.length > 0 && (
        <div className="list-switcher">
          <button className={!selected ? "active" : ""} onClick={() => setSelectedId("all")}>
            All songs
          </button>
          {savedLists.map((l) => (
            <button key={l.id} className={selected?.id === l.id ? "active" : ""} onClick={() => setSelectedId(l.id)}>
              {l.name}
            </button>
          ))}
          <button className="new-list" onClick={() => setEditing("new")}>
            + New list
          </button>
        </div>
      )}

      {editing === "new" && (
        <SavedListEditor
          concerts={concerts}
          onSave={(name, ids) => {
            setSelectedId(props.onCreateList(name, ids));
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      {editing === "edit" && selected && (
        <SavedListEditor
          concerts={concerts}
          list={selected}
          onSave={(name, ids) => {
            props.onUpdateList(selected.id, (l) => ({ ...l, name, concertIds: ids }));
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
          onDelete={deleteSelected}
        />
      )}

      {concerts.length === 0 ? (
        <p className="notice">Add some concerts in the concerts tab first.</p>
      ) : (
        <>
          <div className="stats">
            <span className="pill">{listConcerts.length} concerts</span>
            <span className="pill">{totalHeard} songs heard</span>
            <span className="pill">{songs.length} different songs</span>
          </div>

          <div className="form-row">
            <button className="btn btn-spotify" onClick={() => setBuilding(true)} disabled={songs.length === 0}>
              Make a playlist
            </button>
            {selected && editing !== "edit" && (
              <>
                <button className="btn btn-ghost" onClick={() => props.onRankList(selected.id)}>
                  Rank this list →
                </button>
                <button className="btn btn-ghost" onClick={() => setEditing("edit")}>
                  Edit list
                </button>
              </>
            )}
            {spotifyConnected === false && (
              <span className="muted" style={{ fontSize: 14 }}>
                Connect Spotify (top right) first
              </span>
            )}
          </div>

          {!selected && playlists.length > 0 && (
            <PlaylistList playlists={playlists} spotifyConnected={spotifyConnected} onRemove={props.onPlaylistRemoved} />
          )}

          <h2 className="card-subtitle">{selected ? selected.name : "all songs"}</h2>
          {songs.length === 0 && <p className="notice">This list&apos;s concerts don&apos;t have any songs yet.</p>}
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
          defaultName={selected ? `Encore: ${selected.name}` : "Encore: every song I've heard live"}
          source={selected ? `Saved list: ${selected.name}` : "Songs heard live"}
          spotifyConnected={spotifyConnected}
          returnTab="songs"
          onCreated={props.onPlaylistCreated}
          onClose={() => setBuilding(false)}
        />
      )}
    </section>
  );
}

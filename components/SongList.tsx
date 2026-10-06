"use client";

// The Songs tab: every song you've heard live, or just the songs from one of your saved lists
// (named groups of concerts you picked, like "2026")

import { useEffect, useMemo, useState } from "react";
import type { Concert, PlaylistSource, SavedList, SavedPlaylist, SongCount } from "@/lib/types";
import { countSongs } from "@/lib/songs";
import { concertsInList } from "@/lib/savedLists";
import { songsForPlaylist, songsForSource, type SourceData } from "@/lib/playlistSources";
import { clearResume, peekResume } from "@/lib/resumePlaylist";
import PlaylistBuilder from "./PlaylistBuilder";
import PlaylistList from "./PlaylistList";
import SavedListEditor from "./SavedListEditor";
import SongConcertsDialog from "./SongConcertsDialog";
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
  sourceData: SourceData; // everything needed to rebuild a playlist's songs when updating it
  onPlaylistUpdated: (playlist: SavedPlaylist) => void;
};

export default function SongList(props: Props) {
  const { concerts, playlists, spotifyConnected, savedLists } = props;
  const confirm = useConfirm();
  // Returning from connecting Spotify mid-playlist: reopen the builder for the same list
  const [resume] = useState(() => {
    const r = peekResume();
    return r?.kind === "songs" ? r : null;
  });
  useEffect(() => {
    if (resume) clearResume(); // only reopen once
  }, [resume]);

  const [selectedId, setSelectedId] = useState<string>(resume?.listId ?? "all"); // "all", or a saved list's id
  const [editing, setEditing] = useState<"new" | "edit" | null>(null);
  const [building, setBuilding] = useState(resume !== null);
  // "Update" on one of Your playlists: rebuild its songs from what it was made from
  const [updating, setUpdating] = useState<{ playlist: SavedPlaylist; songs: ReturnType<typeof songsForPlaylist> } | null>(
    null
  );
  const [updateError, setUpdateError] = useState("");
  const [openSong, setOpenSong] = useState<SongCount | null>(null); // the song whose concerts are showing

  function startUpdate(playlist: SavedPlaylist) {
    const songs = playlist.sourceRef ? songsForSource(playlist.sourceRef, props.sourceData) : null;
    if (!songs) {
      setUpdateError(`"${playlist.name}" can't be updated, since what it was made from no longer exists.`);
      return;
    }
    setUpdateError("");
    setUpdating({ playlist, songs });
  }

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
            <>
              <PlaylistList
                playlists={playlists}
                spotifyConnected={spotifyConnected}
                onRemove={props.onPlaylistRemoved}
                onUpdate={startUpdate}
              />
              {updateError && <p className="error">{updateError}</p>}
            </>
          )}

          <h2 className="card-subtitle">{selected ? selected.name : "all songs"}</h2>
          {songs.length === 0 && <p className="notice">This list&apos;s concerts don&apos;t have any songs yet.</p>}
          <ol className="song-rows">
            {songs.map((s, i) => (
              <li key={s.key}>
                {/* A button, so it works with the keyboard and screen readers too */}
                <button className="song-row song-row-button" onClick={() => setOpenSong(s)}>
                  <span className="song-rank">{i + 1}</span>
                  <span className="song-info">
                    <span className="song-name">{s.name}</span>
                    <span className="song-artist">
                      {s.artist}
                      {s.coverOf && ` · cover of ${s.coverOf}`}
                    </span>
                  </span>
                  <span className="count-pill">{s.timesHeard}×</span>
                </button>
              </li>
            ))}
          </ol>
        </>
      )}

      {building && (
        <PlaylistBuilder
          songs={songsForPlaylist(songs)} // grouped by artist, each artist's songs most heard first
          defaultName={selected ? `Encore: ${selected.name}` : "Encore: every song I've heard live"}
          source={selected ? `Saved list: ${selected.name}` : "Songs heard live"}
          spotifyConnected={spotifyConnected}
          returnTab="songs"
          sourceRef={{ kind: "songs", listId: selected?.id ?? "all" } satisfies PlaylistSource}
          onCreated={props.onPlaylistCreated}
          onClose={() => setBuilding(false)}
        />
      )}

      {openSong && (
        <SongConcertsDialog
          song={openSong}
          concerts={concerts}
          highlightIds={selected ? new Set(selected.concertIds) : undefined}
          onClose={() => setOpenSong(null)}
        />
      )}

      {updating && (
        <PlaylistBuilder
          songs={updating.songs}
          defaultName={updating.playlist.name}
          source={updating.playlist.source}
          spotifyConnected={spotifyConnected}
          returnTab="songs"
          sourceRef={updating.playlist.sourceRef!}
          updating={updating.playlist}
          onCreated={props.onPlaylistUpdated}
          onClose={() => setUpdating(null)}
        />
      )}
    </section>
  );
}

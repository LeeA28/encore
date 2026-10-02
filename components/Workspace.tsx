"use client";

// Everything below the header: owns the user's data (via useEncoreData) and shows the current tab.
// EncoreApp gives this component a different `key` for each user (or "guest"), so logging in or out
// re-creates it from scratch, with that mode's data.

import { useEffect, useMemo } from "react";
import type { User } from "@supabase/supabase-js";
import { countSongs } from "@/lib/songs";
import { useEncoreData } from "@/lib/useEncoreData";
import ConcertSearch from "./ConcertSearch";
import SongList from "./SongList";
import RankTab from "./RankTab";
import AccountTab from "./AccountTab";

export type Tab = "concerts" | "songs" | "rank" | "account";

type Props = {
  user: User | null;
  tab: Tab;
  spotifyConnected: boolean | null;
  // EncoreApp keeps a reference to our "save now" function, to call it right before logging out
  flushRef: React.RefObject<(() => void) | null>;
};

export default function Workspace({ user, tab, spotifyConnected, flushRef }: Props) {
  const data = useEncoreData(user);

  useEffect(() => {
    flushRef.current = data.flush;
  }, [flushRef, data.flush]);

  // Song counts are always calculated from the concerts, never saved separately
  const songs = useMemo(() => countSongs(data.concerts), [data.concerts]);

  if (data.status === "loading") {
    return <p className="tagline">Loading your data...</p>;
  }

  return (
    <main>
      {data.notice && (
        <p className="top-notice">
          {data.notice}{" "}
          <button className="btn btn-small btn-ghost" style={{ color: "inherit" }} onClick={data.clearNotice}>
            OK
          </button>
        </p>
      )}
      {data.error && (
        <p className="top-error">
          {data.status === "error" ? "Couldn't load your data: " : "Couldn't save: "}
          {data.error}{" "}
          <button className="btn btn-small btn-ghost" style={{ color: "inherit" }} onClick={data.clearError}>
            Dismiss
          </button>
        </p>
      )}

      {tab === "concerts" && (
        <ConcertSearch myConcerts={data.concerts} onAdd={data.addConcert} onRemove={data.removeConcert} />
      )}
      {tab === "songs" && (
        <SongList
          songs={songs}
          concertCount={data.concerts.length}
          playlists={data.playlists}
          onPlaylistCreated={data.addPlaylist}
          onPlaylistRemoved={data.removePlaylist}
          spotifyConnected={spotifyConnected}
        />
      )}
      {tab === "rank" && <RankTab songs={songs} data={data} spotifyConnected={spotifyConnected} />}
      {tab === "account" && user && <AccountTab user={user} />}
    </main>
  );
}

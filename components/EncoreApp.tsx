"use client";

import { useMemo, useState } from "react";
import type { Concert } from "@/lib/types";
import { countSongs } from "@/lib/songs";
import { emptyRankings, type Rankings } from "@/lib/ranking";
import { useLocalStorage } from "@/lib/useLocalStorage";
import ConcertSearch from "./ConcertSearch";
import SongList from "./SongList";
import RankSongs from "./RankSongs";

type Tab = "concerts" | "songs" | "rank";

// The top-level component. It owns the saved data and passes it down to each tab as props.
export default function EncoreApp() {
  const [tab, setTab] = useState<Tab>("concerts");

  // Saved in the browser, so nothing is lost on refresh
  const [myConcerts, setMyConcerts] = useLocalStorage<Concert[]>("encore:concerts", []);
  const [rankings, setRankings] = useLocalStorage<Rankings>("encore:rankings", emptyRankings());

  // Song counts are always calculated from the concerts, never saved separately.
  // useMemo only recalculates when myConcerts changes, not on every render (e.g. switching tabs).
  const songs = useMemo(() => countSongs(myConcerts), [myConcerts]);

  function addConcert(concert: Concert) {
    setMyConcerts([...myConcerts, concert]);
  }

  function removeConcert(id: string) {
    setMyConcerts(myConcerts.filter((c) => c.id !== id));
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 24 }}>
      <h1>Encore</h1>
      <p>See all the songs you&apos;ve heard live</p>

      <nav>
        <button onClick={() => setTab("concerts")} disabled={tab === "concerts"}>
          Concerts ({myConcerts.length})
        </button>
        <button onClick={() => setTab("songs")} disabled={tab === "songs"}>
          Songs ({songs.length})
        </button>
        <button onClick={() => setTab("rank")} disabled={tab === "rank"}>
          Rank
        </button>
      </nav>

      {tab === "concerts" && (
        <ConcertSearch myConcerts={myConcerts} onAdd={addConcert} onRemove={removeConcert} />
      )}
      {tab === "songs" && <SongList songs={songs} concertCount={myConcerts.length} />}
      {tab === "rank" && <RankSongs songs={songs} rankings={rankings} setRankings={setRankings} />}
    </main>
  );
}

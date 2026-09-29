"use client";

import { useMemo, useState } from "react";
import type { Concert } from "@/lib/types";
import { countSongs } from "@/lib/songs";
import { useLocalStorage } from "@/lib/useLocalStorage";
import ConcertSearch from "./ConcertSearch";
import SongList from "./SongList";
import RankTab from "./RankTab";
import { LogoIcon } from "./Icons";

type Tab = "concerts" | "songs" | "rank";

const TABS: { id: Tab; label: string }[] = [
  { id: "concerts", label: "concerts" },
  { id: "songs", label: "songs" },
  { id: "rank", label: "rank" },
];

// The top-level component. It owns the saved concerts and passes them down to each tab as props.
export default function EncoreApp() {
  // Start on the tab named in the URL (e.g. "/?tab=rank" after returning from Spotify login)
  const [tab, setTab] = useState<Tab>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("tab");
    return fromUrl === "songs" || fromUrl === "rank" ? fromUrl : "concerts";
  });

  // Saved in the browser, so nothing is lost on refresh
  const [myConcerts, setMyConcerts] = useLocalStorage<Concert[]>("encore:concerts", []);

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
    <div className="container">
      <header className="site-header">
        <div className="brand">
          <LogoIcon />
          Encore
        </div>
        <nav className="nav">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`nav-link ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <p className="tagline">Every song you&apos;ve heard live, counted and ranked</p>

      <main>
        {tab === "concerts" && (
          <ConcertSearch myConcerts={myConcerts} onAdd={addConcert} onRemove={removeConcert} />
        )}
        {tab === "songs" && <SongList songs={songs} concertCount={myConcerts.length} />}
        {tab === "rank" && <RankTab songs={songs} />}
      </main>

      <footer className="footer">
        Setlist data from{" "}
        <a href="https://www.setlist.fm" target="_blank" rel="noreferrer">
          setlist.fm
        </a>
      </footer>
    </div>
  );
}

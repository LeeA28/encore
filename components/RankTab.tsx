"use client";

// The Rank tab: choose between ranking songs you've heard live, or your own custom lists

import { useMemo, useState } from "react";
import type { RankItem, SongCount } from "@/lib/types";
import type { EncoreDataApi } from "@/lib/useEncoreData";
import TierBoard from "./TierBoard";
import CustomLists from "./CustomLists";
import TierPlaylistButton from "./TierPlaylistButton";
import { StackIcon } from "./Icons";

type Props = {
  songs: SongCount[];
  data: EncoreDataApi;
  spotifyConnected: boolean | null;
};

export default function RankTab({ songs, data, spotifyConnected }: Props) {
  const [mode, setMode] = useState<"live" | "custom">("live");

  // Turn the song counts into tier-list items
  const liveItems: RankItem[] = useMemo(
    () =>
      songs.map((s) => ({
        key: s.key,
        name: s.name,
        artist: s.artist,
        coverOf: s.coverOf, // needed to find covers on Spotify
        detail: `heard ${s.timesHeard}×`,
      })),
    [songs]
  );

  return (
    <section className="card">
      <div className="card-header">
        <div className="icon-badge" style={{ background: "var(--yellow)", color: "#111" }}>
          <StackIcon />
        </div>
        <h1 className="card-title">rank</h1>
      </div>
      <p className="card-desc">Drag songs into tiers, or tap a letter to place them quickly.</p>

      <div className="segmented">
        <button className={mode === "live" ? "active" : ""} onClick={() => setMode("live")}>
          Songs I&apos;ve heard live
        </button>
        <button className={mode === "custom" ? "active" : ""} onClick={() => setMode("custom")}>
          Custom lists
        </button>
      </div>

      {mode === "live" &&
        (liveItems.length > 0 ? (
          <>
            <div style={{ marginBottom: 12 }}>
              <TierPlaylistButton
                items={liveItems}
                tiers={data.liveTiers}
                listName="Songs heard live"
                spotifyConnected={spotifyConnected}
                onCreated={data.addPlaylist}
              />
            </div>
            <TierBoard items={liveItems} tiers={data.liveTiers} onChange={data.setLiveTiers} />
          </>
        ) : (
          <p className="notice">Add some concerts in the concerts tab first.</p>
        ))}
      {mode === "custom" && <CustomLists data={data} spotifyConnected={spotifyConnected} />}
    </section>
  );
}

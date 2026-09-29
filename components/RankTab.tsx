"use client";

// The Rank tab: choose between ranking songs you've heard live, or your own custom lists

import { useMemo, useState } from "react";
import type { RankItem, SongCount } from "@/lib/types";
import { emptyTiers, type Tiers } from "@/lib/tiers";
import { useLocalStorage } from "@/lib/useLocalStorage";
import TierBoard from "./TierBoard";
import CustomLists from "./CustomLists";
import { StackIcon } from "./Icons";

export default function RankTab({ songs }: { songs: SongCount[] }) {
  const [mode, setMode] = useState<"live" | "custom">("live");
  const [liveTiers, setLiveTiers] = useLocalStorage<Tiers>("encore:liveTiers", emptyTiers());

  // Turn the song counts into tier-list items
  const liveItems: RankItem[] = useMemo(
    () => songs.map((s) => ({ key: s.key, name: s.name, artist: s.artist, detail: `heard ${s.timesHeard}×` })),
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
      <p className="card-desc">Drag songs into tiers. Sort any tier with quick this-or-that questions.</p>

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
          <TierBoard items={liveItems} tiers={liveTiers} onChange={setLiveTiers} />
        ) : (
          <p className="notice">Add some concerts in the concerts tab first.</p>
        ))}
      {mode === "custom" && <CustomLists />}
    </section>
  );
}

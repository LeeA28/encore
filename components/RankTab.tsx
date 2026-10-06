"use client";

// The Rank tab: rank songs you've heard live, your custom lists (songs from Spotify),
// or your saved lists (groups of concerts, made in the Songs tab). Each has its own tier list.

import { useEffect, useMemo, useState } from "react";
import type { RankItem, SongCount } from "@/lib/types";
import { countSongs } from "@/lib/songs";
import { concertsInList } from "@/lib/savedLists";
import { toRankItems } from "@/lib/playlistSources";
import { peekResume } from "@/lib/resumePlaylist";
import type { EncoreDataApi } from "@/lib/useEncoreData";
import TierBoard from "./TierBoard";
import CustomLists from "./CustomLists";
import TierPlaylistButton from "./TierPlaylistButton";
import { StackIcon } from "./Icons";

type Props = {
  songs: SongCount[];
  data: EncoreDataApi;
  spotifyConnected: boolean | null;
  // If "Rank this list →" was clicked in the Songs tab: which saved list to open
  initialList?: string | null;
  onInitialListUsed?: () => void;
};

type Mode = "live" | "custom" | "saved";

export default function RankTab({ songs, data, spotifyConnected, initialList, onInitialListUsed }: Props) {
  // Where to start: a saved list from "Rank this list →", or wherever a playlist was being made
  // before connecting Spotify, or else songs heard live
  const [start] = useState<{ mode: Mode; savedId?: string }>(() => {
    if (initialList) return { mode: "saved", savedId: initialList };
    const r = peekResume();
    if (r?.kind === "tiers") {
      if (r.context.startsWith("saved:")) return { mode: "saved", savedId: r.context.slice(6) };
      if (r.context.startsWith("custom:")) return { mode: "custom" };
    }
    return { mode: "live" };
  });
  useEffect(() => {
    if (initialList) onInitialListUsed?.(); // it's been used, so a later visit starts normally
  }, [initialList, onInitialListUsed]);

  const [mode, setMode] = useState<Mode>(start.mode);
  const [savedId, setSavedId] = useState<string>(start.savedId ?? data.savedLists[0]?.id ?? "");

  const liveItems: RankItem[] = useMemo(() => toRankItems(songs), [songs]);

  // The selected saved list's songs, always worked out from its concerts
  const savedList = data.savedLists.find((l) => l.id === savedId) ?? data.savedLists[0];
  const savedItems: RankItem[] = useMemo(
    () => (savedList ? toRankItems(countSongs(concertsInList(savedList, data.concerts))) : []),
    [savedList, data.concerts]
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
        <button className={mode === "saved" ? "active" : ""} onClick={() => setMode("saved")}>
          Saved lists
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
                context="live"
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

      {mode === "saved" &&
        (savedList ? (
          <>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <select className="select" value={savedList.id} onChange={(e) => setSavedId(e.target.value)}>
                {data.savedLists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <TierPlaylistButton
                items={savedItems}
                tiers={savedList.tiers}
                listName={savedList.name}
                context={`saved:${savedList.id}`}
                spotifyConnected={spotifyConnected}
                onCreated={data.addPlaylist}
              />
            </div>
            {savedItems.length > 0 ? (
              <TierBoard
                items={savedItems}
                tiers={savedList.tiers}
                onChange={(tiers) => data.updateSavedList(savedList.id, (l) => ({ ...l, tiers }))}
              />
            ) : (
              <p className="notice">This list&apos;s concerts don&apos;t have any songs yet.</p>
            )}
          </>
        ) : (
          <p className="notice">
            Make a saved list in the songs tab (like &quot;2026&quot;, or every show by one artist), and its tier list
            will appear here.
          </p>
        ))}
    </section>
  );
}

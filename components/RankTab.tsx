"use client";

// The Rank tab: rank songs you've heard live, your custom lists (songs from Spotify),
// or your saved lists (groups of concerts, made in the Songs tab). Each has its own tier list.

import { useEffect, useMemo, useState } from "react";
import type { RankItem, SongCount } from "@/lib/types";
import { countSongs } from "@/lib/songs";
import { concertsInList } from "@/lib/savedLists";
import { toRankItems } from "@/lib/playlistSources";
import { peekResume } from "@/lib/resumePlaylist";
import { mergeFilteredTiers, type Tiers } from "@/lib/tiers";
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
  const [start] = useState<{ mode: Mode; savedId?: string; artist?: string }>(() => {
    if (initialList) return { mode: "saved", savedId: initialList };
    const r = peekResume();
    if (r?.kind === "tiers") {
      if (r.context.startsWith("saved:")) return { mode: "saved", savedId: r.context.slice(6), artist: r.artist };
      if (r.context.startsWith("custom:")) return { mode: "custom" };
      if (r.context === "live") return { mode: "live", artist: r.artist };
    }
    return { mode: "live" };
  });
  useEffect(() => {
    if (initialList) onInitialListUsed?.(); // it's been used, so a later visit starts normally
  }, [initialList, onInitialListUsed]);

  const [mode, setMode] = useState<Mode>(start.mode);
  const [savedId, setSavedId] = useState<string>(start.savedId ?? data.savedLists[0]?.id ?? "");
  // Showing only one artist's songs ("" = all artists). The same tier list either way.
  const [artist, setArtist] = useState<string>(start.artist ?? "");

  const liveItems: RankItem[] = useMemo(() => toRankItems(songs), [songs]);

  // The selected saved list's songs, always worked out from its concerts
  const savedList = data.savedLists.find((l) => l.id === savedId) ?? data.savedLists[0];
  const savedItems: RankItem[] = useMemo(
    () => (savedList ? toRankItems(countSongs(concertsInList(savedList, data.concerts))) : []),
    [savedList, data.concerts]
  );

  // One artist's songs from a list of items ("" = everything)
  const onlyArtist = (items: RankItem[]) => (artist ? items.filter((i) => i.artist === artist) : items);

  // Saving changes made while one artist is showing: put them back into the full tiers, keeping
  // every other artist's songs exactly where they were (mergeFilteredTiers, tested)
  function saveFiltered(fullTiers: Tiers, items: RankItem[], save: (tiers: Tiers) => void) {
    if (!artist) return save;
    const visible = new Set(onlyArtist(items).map((i) => i.key));
    return (filtered: Tiers) => save(mergeFilteredTiers(fullTiers, filtered, visible));
  }

  const liveShown = onlyArtist(liveItems);
  const savedShown = onlyArtist(savedItems);

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
        {(["live", "custom", "saved"] as const).map((m) => (
          <button
            key={m}
            className={mode === m ? "active" : ""}
            onClick={() => {
              setMode(m);
              setArtist(""); // each mode starts showing all artists
            }}
          >
            {m === "live" ? "Songs I've heard live" : m === "custom" ? "Custom lists" : "Saved lists"}
          </button>
        ))}
      </div>

      {mode === "live" &&
        (liveItems.length > 0 ? (
          <>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <ArtistPicker items={liveItems} value={artist} onChange={setArtist} />
              <TierPlaylistButton
                items={liveShown}
                tiers={data.liveTiers}
                listName={artist ? `${artist} live` : "Songs heard live"}
                context="live"
                artist={artist || undefined}
                spotifyConnected={spotifyConnected}
                onCreated={data.addPlaylist}
              />
            </div>
            <TierBoard
              key={artist} // a fresh board when switching artists
              items={liveShown}
              tiers={data.liveTiers}
              onChange={saveFiltered(data.liveTiers, liveItems, data.setLiveTiers)}
            />
          </>
        ) : (
          <p className="notice">Add some concerts in the concerts tab first.</p>
        ))}
      {mode === "custom" && <CustomLists data={data} spotifyConnected={spotifyConnected} />}

      {mode === "saved" &&
        (savedList ? (
          <>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <select
                className="select"
                value={savedList.id}
                onChange={(e) => {
                  setSavedId(e.target.value);
                  setArtist("");
                }}
              >
                {data.savedLists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <ArtistPicker items={savedItems} value={artist} onChange={setArtist} />
              <TierPlaylistButton
                items={savedShown}
                tiers={savedList.tiers}
                listName={artist ? `${savedList.name}: ${artist}` : savedList.name}
                context={`saved:${savedList.id}`}
                artist={artist || undefined}
                spotifyConnected={spotifyConnected}
                onCreated={data.addPlaylist}
              />
            </div>
            {savedItems.length > 0 ? (
              <TierBoard
                key={`${savedList.id}|${artist}`}
                items={savedShown}
                tiers={savedList.tiers}
                onChange={saveFiltered(savedList.tiers, savedItems, (tiers) =>
                  data.updateSavedList(savedList.id, (l) => ({ ...l, tiers }))
                )}
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

// "All artists", or one artist's songs. Artists with the most songs come first.
function ArtistPicker({ items, value, onChange }: { items: RankItem[]; value: string; onChange: (a: string) => void }) {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.artist, (counts.get(i.artist) ?? 0) + 1);
  const artists = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (artists.length < 2) return null; // only one artist: nothing to choose

  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Show artist">
      <option value="">All artists</option>
      {artists.map(([name, count]) => (
        <option key={name} value={name}>
          {name} ({count})
        </option>
      ))}
    </select>
  );
}

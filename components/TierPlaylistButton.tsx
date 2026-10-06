"use client";

// "Make a playlist" for a tier list: pick which tiers to include, then open the playlist builder.
// Songs go in tier order (S first), keeping each tier's order from your dragging.

import { useEffect, useState } from "react";
import type { RankItem, SavedPlaylist } from "@/lib/types";
import { TIER_COLORS, TIER_NAMES, type TierName, type Tiers } from "@/lib/tiers";
import { tierSongsForPlaylist } from "@/lib/playlistSources";
import { clearResume, peekResume } from "@/lib/resumePlaylist";
import PlaylistBuilder, { type PlaylistSong } from "./PlaylistBuilder";

type Props = {
  items: RankItem[];
  tiers: Tiers;
  listName: string; // e.g. "Songs heard live" or a custom list's name
  context: string; // which tier list this is: "live", "saved:<id>", or "custom:<id>"
  artist?: string; // set when the tier list is showing only one artist's songs
  spotifyConnected: boolean | null;
  onCreated: (playlist: SavedPlaylist) => void;
};

export default function TierPlaylistButton({ items, tiers, listName, context, artist, spotifyConnected, onCreated }: Props) {
  // Returning from connecting Spotify mid-playlist: reopen the builder with the same tiers ticked
  const [resume] = useState(() => {
    const r = peekResume();
    return r?.kind === "tiers" && r.context === context && r.artist === artist ? r : null;
  });
  useEffect(() => {
    if (resume) clearResume(); // only reopen once
  }, [resume]);

  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<TierName[]>(resume?.tiers ?? ["S", "A"]);
  const [building, setBuilding] = useState<PlaylistSong[] | null>(() =>
    resume ? tierSongsForPlaylist(items, tiers, resume.tiers) : null
  );

  const itemsByKey = new Map(items.map((i) => [i.key, i]));

  function toggle(tier: TierName) {
    setPicked((prev) => (prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]));
  }

  // The songs in the picked tiers, in order: all of S, then A, and so on
  const chosen: RankItem[] = TIER_NAMES.filter((t) => picked.includes(t)).flatMap((t) =>
    (tiers[t] ?? []).map((key) => itemsByKey.get(key)).filter((i): i is RankItem => i !== undefined)
  );

  function start() {
    setBuilding(tierSongsForPlaylist(items, tiers, picked));
    setPicking(false);
  }

  const tierLabel = TIER_NAMES.filter((t) => picked.includes(t)).join(" + ");

  return (
    <>
      <button className="btn btn-ghost btn-small" onClick={() => setPicking(!picking)}>
        Make a playlist
      </button>

      {picking && (
        <div className="panel">
          <strong>Which tiers?</strong>
          <div className="tier-pick">
            {TIER_NAMES.map((tier) => (
              <label key={tier}>
                <input type="checkbox" checked={picked.includes(tier)} onChange={() => toggle(tier)} />
                <span className="tier-btn" style={{ background: TIER_COLORS[tier], display: "inline-grid", placeItems: "center" }}>
                  {tier}
                </span>
                <span className="muted">({(tiers[tier] ?? []).filter((k) => itemsByKey.has(k)).length})</span>
              </label>
            ))}
          </div>
          <div className="form-row">
            <button className="btn btn-light btn-small" onClick={start} disabled={chosen.length === 0}>
              Continue with {chosen.length} songs
            </button>
            <button className="btn btn-ghost btn-small" onClick={() => setPicking(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {building && (
        <PlaylistBuilder
          songs={building}
          defaultName={`Encore: ${listName} (${tierLabel})`}
          source={`${tierLabel} tiers of ${listName}`}
          spotifyConnected={spotifyConnected}
          returnTab="rank"
          sourceRef={{ kind: "tiers", context, tiers: TIER_NAMES.filter((t) => picked.includes(t)), artist }}
          onCreated={onCreated}
          onClose={() => setBuilding(null)}
        />
      )}
    </>
  );
}

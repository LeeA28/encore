"use client";

import { useState } from "react";
import type { SongCount } from "@/lib/types";
import {
  TIERS,
  type Tier,
  type Rankings,
  type Placement,
  startPlacement,
  opponentIndex,
  isDone,
  answer,
  insert,
  removeSong,
} from "@/lib/ranking";

type Props = {
  songs: SongCount[];
  rankings: Rankings;
  setRankings: (rankings: Rankings) => void;
};

const TIER_LABELS: Record<Tier, string> = {
  loved: "Loved it",
  fine: "It was fine",
  disliked: "Didn't like it",
};

export default function RankSongs({ songs, rankings, setRankings }: Props) {
  // The comparison in progress (null = not currently comparing). Not saved: it's only temporary.
  const [placement, setPlacement] = useState<Placement | null>(null);

  const songsByKey = new Map(songs.map((s) => [s.key, s]));
  const label = (key: string) => {
    const s = songsByKey.get(key);
    return s ? `${s.name} (${s.artist})` : key;
  };

  // Your full ranking, best first: every loved song, then fine, then disliked.
  // Songs from concerts you've since removed are skipped.
  const ranked = TIERS.flatMap((tier) =>
    rankings[tier].filter((key) => songsByKey.has(key)).map((key) => ({ key, tier }))
  );
  const rankedKeys = new Set(ranked.map((r) => r.key));
  const unranked = songs.filter((s) => !rankedKeys.has(s.key));

  // The song being ranked right now: the one mid-comparison, or else the next unranked song
  const current = placement?.songKey ?? unranked[0]?.key;

  function chooseTier(tier: Tier) {
    if (!current) return;
    const p = startPlacement(rankings, current, tier);
    if (isDone(p)) {
      setRankings(insert(rankings, p)); // empty tier: no comparisons needed, insert right away
    } else {
      setPlacement(p);
    }
  }

  function choose(preferNew: boolean) {
    if (!placement) return;
    const next = answer(placement, preferNew);
    if (isDone(next)) {
      setRankings(insert(rankings, next));
      setPlacement(null);
    } else {
      setPlacement(next);
    }
  }

  if (songs.length === 0) {
    return <p>Add some concerts in the Concerts tab first.</p>;
  }

  return (
    <section>
      <h2>Rank your songs</h2>
      <p>
        {ranked.length} of {songs.length} ranked
      </p>

      {/* Step 1 for each song: pick a tier */}
      {current && !placement && (
        <div>
          <p>
            How did you feel about <strong>{label(current)}</strong>?
          </p>
          {TIERS.map((tier) => (
            <button key={tier} onClick={() => chooseTier(tier)}>
              {TIER_LABELS[tier]}
            </button>
          ))}
        </div>
      )}

      {/* Step 2: compare against songs already in that tier until its position is found */}
      {placement && (
        <div>
          <p>Which do you like more?</p>
          <button onClick={() => choose(true)}>{label(placement.songKey)}</button>
          {" or "}
          <button onClick={() => choose(false)}>{label(rankings[placement.tier][opponentIndex(placement)])}</button>
          <div>
            <button onClick={() => setPlacement(null)}>Cancel</button>
          </div>
        </div>
      )}

      {!current && <p>Every song is ranked!</p>}

      <h3>Your ranking</h3>
      <ol>
        {ranked.map((r) => (
          <li key={r.key}>
            {label(r.key)} [{TIER_LABELS[r.tier]}]{" "}
            {/* Re-rank = remove it, so it becomes unranked and comes up again */}
            <button onClick={() => setRankings(removeSong(rankings, r.key))} disabled={placement !== null}>
              Re-rank
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

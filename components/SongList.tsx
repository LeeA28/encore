"use client";

import type { SongCount } from "@/lib/types";

type Props = {
  songs: SongCount[];
  concertCount: number;
};

export default function SongList({ songs, concertCount }: Props) {
  if (songs.length === 0) {
    return <p>Add some concerts in the Concerts tab first.</p>;
  }

  // Total performances heard = the sum of every song's count
  const totalHeard = songs.reduce((sum, s) => sum + s.timesHeard, 0);

  return (
    <section>
      <h2>Most heard live</h2>
      <p>
        {concertCount} concerts, {totalHeard} songs heard, {songs.length} different songs
      </p>
      {/* Placeholder until the Spotify phase */}
      <button onClick={() => alert("Spotify playlists are coming in Phase 3.")}>Make a playlist</button>
      <ol>
        {songs.map((s) => (
          <li key={s.key}>
            {s.name} by {s.artist}
            {s.coverOf && ` (cover of ${s.coverOf})`}: {s.timesHeard}x
          </li>
        ))}
      </ol>
    </section>
  );
}

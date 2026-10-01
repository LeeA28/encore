// POST /api/spotify/match  body: { songs: [{ key, name, artist, coverOf? }, ...] } (up to 10 at a time)
// For each song: search Spotify, score the results, and return the best match plus a few alternatives.
// The page sends songs in small batches, so it can show progress and so we go easy on Spotify's rate limit.
//
// One song's searches failing never stops the others: that song comes back with failed: true,
// and the page offers to retry it.

import { NextRequest, NextResponse } from "next/server";
import { SpotifyError, pauseBetweenRequests, searchTracks, type SpotifyTrack } from "@/lib/spotify";
import { GOOD_SCORE, GREAT_SCORE, buildQueries, scoreTrack, toTrackMatch, type SongToMatch } from "@/lib/matching";
import { spotifyErrorResponse } from "@/lib/spotifyRoute";

const MAX_SONGS = 10;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const songs: SongToMatch[] = Array.isArray(body?.songs) ? body.songs.slice(0, MAX_SONGS) : [];
  if (songs.length === 0) return NextResponse.json({ error: "No songs to match." }, { status: 400 });

  try {
    const results = [];
    for (const song of songs) {
      // Every track found by any of the searches, with its best score (keyed by track id, so no duplicates)
      const scored = new Map<string, { track: SpotifyTrack; score: number }>();
      let searchesWorked = 0;

      for (const query of buildQueries(song)) {
        try {
          const tracks = await searchTracks(query);
          searchesWorked++;
          for (const track of tracks) {
            const score = scoreTrack(song, track);
            if (score > (scored.get(track.id)?.score ?? 0)) scored.set(track.id, { track, score });
          }
        } catch (err) {
          // Login problems affect every song, so stop and report them right away
          if (err instanceof SpotifyError && (err.status === 401 || err.status === 403)) throw err;
          // Anything else (even after retries): try this song's next search instead of giving up
          console.warn(`Search failed for "${query}":`, err instanceof Error ? err.message : err);
        }
        await pauseBetweenRequests();
        // Found an excellent match already? Skip the remaining (less precise) searches.
        if ([...scored.values()].some((s) => s.score >= GREAT_SCORE)) break;
      }

      const ranked = [...scored.values()].sort((a, b) => b.score - a.score);
      const best = ranked[0];
      results.push({
        key: song.key,
        match: best && best.score >= GOOD_SCORE ? toTrackMatch(best.track) : null,
        candidates: ranked.slice(0, 5).map((r) => toTrackMatch(r.track)), // alternatives for "Change"
        // Every search for this song failed: "not found" would be misleading, so flag it for a retry
        failed: searchesWorked === 0,
      });
    }
    return NextResponse.json({ results });
  } catch (err) {
    return spotifyErrorResponse(err);
  }
}

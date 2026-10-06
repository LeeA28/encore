// Pure: turning a playlist's source (PlaylistSource) into the songs to put in it.
// Used both when a playlist is first made and when it's updated later, so both always agree.

import type { Concert, CustomList, PlaylistSource, RankItem, SavedList, SongCount } from "./types";
import type { PlaylistSong } from "@/components/PlaylistBuilder";
import { countSongs, groupByArtist } from "./songs";
import { concertsInList } from "./savedLists";
import { TIER_NAMES, type Tiers } from "./tiers";

export type SourceData = {
  concerts: Concert[];
  savedLists: SavedList[];
  liveTiers: Tiers;
  customLists: CustomList[];
};

// Song counts → tier-list items (shared with the Rank tab)
export function toRankItems(songs: SongCount[]): RankItem[] {
  return songs.map((s) => ({
    key: s.key,
    name: s.name,
    artist: s.artist,
    coverOf: s.coverOf, // needed to find covers on Spotify
    spotifyId: s.spotifyId, // songs added from Spotify skip matching
    detail: `heard ${s.timesHeard}×`,
  }));
}

// Songs heard live → playlist songs, grouped by artist (artists ordered by their most-heard song)
export function songsForPlaylist(songs: SongCount[]): PlaylistSong[] {
  return groupByArtist(songs).map((s) => ({
    key: s.key,
    name: s.name,
    artist: s.artist,
    coverOf: s.coverOf,
    // Songs you added from Spotify already know their exact track, so they skip matching
    match: s.spotifyId ? { id: s.spotifyId, name: s.name, artist: s.coverOf ?? s.artist } : undefined,
  }));
}

// A tier list's chosen tiers → playlist songs, in tier order (all of S, then A...), keeping each tier's order
export function tierSongsForPlaylist(items: RankItem[], tiers: Tiers, picked: string[]): PlaylistSong[] {
  const byKey = new Map(items.map((i) => [i.key, i]));
  return TIER_NAMES.filter((t) => picked.includes(t))
    .flatMap((t) => (tiers[t] ?? []).map((key) => byKey.get(key)))
    .filter((i): i is RankItem => i !== undefined)
    .map((item) => ({
      key: item.key,
      name: item.name,
      artist: item.artist,
      coverOf: item.coverOf,
      match: item.spotifyId ? { id: item.spotifyId, name: item.name, artist: item.artist, album: item.detail } : undefined,
    }));
}

// The items and tiers behind a tier list's context ("live", "saved:<id>", "custom:<id>")
export function tierListFor(context: string, data: SourceData): { items: RankItem[]; tiers: Tiers } | null {
  if (context === "live") return { items: toRankItems(countSongs(data.concerts)), tiers: data.liveTiers };
  const [kind, id] = context.split(":");
  if (kind === "saved") {
    const list = data.savedLists.find((l) => l.id === id);
    return list ? { items: toRankItems(countSongs(concertsInList(list, data.concerts))), tiers: list.tiers } : null;
  }
  if (kind === "custom") {
    const list = data.customLists.find((l) => l.id === id);
    return list ? { items: list.items, tiers: list.tiers } : null;
  }
  return null;
}

// Rebuild a playlist's songs from its source. Returns null if the source no longer exists
// (e.g. its saved list was deleted), so the playlist can't be updated.
export function songsForSource(source: PlaylistSource, data: SourceData): PlaylistSong[] | null {
  if (source.kind === "songs") {
    if (source.listId === "all") return songsForPlaylist(countSongs(data.concerts));
    const list = data.savedLists.find((l) => l.id === source.listId);
    return list ? songsForPlaylist(countSongs(concertsInList(list, data.concerts))) : null;
  }
  const tierList = tierListFor(source.context, data);
  if (!tierList) return null;
  // Made while showing one artist: only that artist's songs
  const items = source.artist ? tierList.items.filter((i) => i.artist === source.artist) : tierList.items;
  return tierSongsForPlaylist(items, tierList.tiers, source.tiers);
}

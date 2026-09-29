// Shared types, used by both the server (API routes) and the browser (components).
// Keeping them in one file means both sides always agree on the data's shape.

export type Song = {
  name: string;
  coverOf?: string; // the original artist, only if this song was a cover
};

export type Concert = {
  id: string;
  date: string; // "yyyy-MM-dd", e.g. "2025-03-14"
  artist: string;
  venue: string;
  city: string;
  country?: string; // optional: concerts saved before countries were added won't have one
  url: string; // this concert's page on setlist.fm
  songs: Song[]; // only songs performed live, in setlist order
};

// One song, with how many of your concerts you heard it at
export type SongCount = {
  key: string; // stable id: normalized "artist|song"
  name: string;
  artist: string; // who performed it live
  coverOf?: string;
  timesHeard: number; // number of different concerts where you heard it
  concertIds: string[];
};

// Anything that can go in a tier list: a song heard live, or a song added from Spotify
export type RankItem = {
  key: string; // stable id: normalized "artist|song", so duplicates merge
  name: string;
  artist: string;
  detail?: string; // extra info to show, like "heard 3x" or the album name
  spotifyId?: string; // Spotify track id, for making playlists later
};

// A user-made list of songs to rank (a discography, some albums, handpicked songs...)
export type CustomList = {
  id: string;
  name: string;
  items: RankItem[];
  tiers: Record<"S" | "A" | "B" | "C" | "D", string[]>;
};

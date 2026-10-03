// Shared types, used by both the server (API routes) and the browser (components).
// Keeping them in one file means both sides always agree on the data's shape.

export type Song = {
  name: string;
  coverOf?: string; // the original artist, only if this song was a cover
  addedByYou?: boolean; // added by the user, because setlist.fm's setlist was missing it (e.g. a secret song)
  spotifyId?: string; // for songs added from Spotify: the exact track, so it never needs matching
};

export type Concert = {
  id: string;
  date: string; // "yyyy-MM-dd", e.g. "2025-03-14"
  artist: string;
  venue: string;
  city: string;
  country?: string; // optional: concerts saved before countries were added won't have one
  tour?: string; // the tour name, if setlist.fm has one
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
  spotifyId?: string; // known Spotify track (from a song you added from Spotify), so playlists skip matching
};

// Anything that can go in a tier list: a song heard live, or a song added from Spotify
export type RankItem = {
  key: string; // stable id: normalized "artist|song", so duplicates merge
  name: string;
  artist: string;
  detail?: string; // extra info to show, like "heard 3x" or the album name
  spotifyId?: string; // Spotify track id (songs added from Spotify already have one)
  coverOf?: string; // for songs heard live: the original artist, if it was a cover
};

// A Spotify track that a song was matched to
export type TrackMatch = {
  id: string; // Spotify track id
  name: string;
  artist: string;
  album?: string;
};

// A playlist Encore created in someone's Spotify account
export type SavedPlaylist = {
  spotifyId: string;
  name: string;
  url: string; // opens the playlist in Spotify
  trackCount: number;
  source: string; // what it was made from, e.g. "Songs heard live" or "S + A tiers: Radiohead discography"
  createdAt: string;
};

// A user-made list of songs to rank (a discography, some albums, handpicked songs...)
export type CustomList = {
  id: string;
  name: string;
  items: RankItem[];
  tiers: Record<"S" | "A" | "B" | "C" | "D", string[]>;
};

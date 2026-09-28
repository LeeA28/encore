// Shared types, used by both the server (API route) and the browser (page).
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
  url: string; // this concert's page on setlist.fm
  songs: Song[]; // only songs performed live, in setlist order
};
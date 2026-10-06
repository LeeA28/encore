// Pure functions for upcoming concerts (from Ticketmaster's event data)

import { normalize } from "./songs";

export type UpcomingShow = {
  artist: string; // the recommended artist this show is for
  name: string; // the event's name
  date: string; // "yyyy-MM-dd"
  venue: string;
  city: string;
  url: string; // the event's Ticketmaster page
};

// Ticketmaster's event JSON (only the parts Encore uses)
export type TicketmasterEvent = {
  name: string;
  url: string;
  dates?: { start?: { localDate?: string } };
  _embedded?: {
    venues?: { name?: string; city?: { name?: string } }[];
    attractions?: { name: string }[];
  };
};

const compact = (s: string) => normalize(s).replace(/&/g, "and").replace(/[^\p{L}\p{N}]/gu, "");

// Ticketmaster's keyword search is loose (searching "Charlie Puth" can return tribute nights or
// festivals that only mention him). Keep only events where the artist is actually one of the performers.
export function showsForArtist(artist: string, events: TicketmasterEvent[]): UpcomingShow[] {
  return events
    .filter((e) => (e._embedded?.attractions ?? []).some((a) => compact(a.name) === compact(artist)))
    .map((e) => ({
      artist,
      name: e.name,
      date: e.dates?.start?.localDate ?? "",
      venue: e._embedded?.venues?.[0]?.name ?? "",
      city: e._embedded?.venues?.[0]?.city?.name ?? "",
      url: e.url,
    }))
    .filter((s) => s.date !== "");
}

// Ticketmaster wants times like "2026-10-06T00:00:00Z". Rounding to the start of the day keeps
// the request the same all day, so cached answers can be reused.
export function searchWindow(today: Date, months: number): { start: string; end: string } {
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + months);
  const format = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z"); // drop the milliseconds
  return { start: format(start), end: format(end) };
}

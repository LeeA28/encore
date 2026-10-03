// Pure functions for artist recommendations ("content-based": recommending artists similar to
// the ones you already like). No API calls here, so it's all testable.
//
//  1. Taste profile: a score for every artist you know, from your tier rankings and concerts
//  2. Seeds: your top artists, whose similar artists get looked up (on Last.fm)
//  3. Candidates: each similar artist scores (your artist's score × similarity), summed over
//     all your artists that point to it. Artists you already know are left out.

import type { Concert, CustomList, SongCount } from "./types";
import { TIER_NAMES, type TierName, type Tiers } from "./tiers";
import { normalize } from "./songs";

export const TIER_POINTS: Record<TierName, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 };
export const CONCERT_POINTS = 1;

export type ArtistTaste = {
  artist: string; // display name
  score: number;
  tierCounts: Record<TierName, number>; // how many of their songs you've put in each tier
  concerts: number; // how many of their concerts you've been to
};

export type TasteProfile = Map<string, ArtistTaste>; // keyed by normalized artist name

export type SimilarArtist = { name: string; match: number; mbid?: string }; // match: similarity from 0 to 1

// Artists to leave out of recommendations: members of your top bands and their other performing names
// (whose solo music you likely know). Matched by MusicBrainz ID (reliable, since some members release
// music under a different name) or by name (the fallback when an artist has no ID).
export type Exclusions = { ids: Set<string>; names: Set<string> };

export const NO_EXCLUSIONS: Exclusions = { ids: new Set(), names: new Set() };

// Pure: builds the lookup from plain lists (the shape the server sends)
export function toExclusions(ids: string[], names: string[]): Exclusions {
  return { ids: new Set(ids), names: new Set(names.map(normalize)) };
}

// Pure: a stricter name comparison for spotting duplicates: "&" and "and" are the same,
// and punctuation is ignored ("Anderson .Paak & Silk Sonic" = "Anderson Paak and Silk Sonic")
export function canonicalName(name: string): string {
  return normalize(name)
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N} ]/gu, "") // keep only letters, numbers, and spaces (any language)
    .replace(/\s+/g, " ")
    .trim();
}

// Pure: the separate artists in a collaboration credit, like "Bruno Mars, Anderson .Paak & Silk Sonic"
// → ["Bruno Mars", "Anderson .Paak", "Silk Sonic"]. A normal name comes back as just itself.
export function splitCollaboration(name: string): string[] {
  return name
    .split(/\s*(?:,|&|\+|\bfeat\.?|\bft\.?|\bwith\b|\bx\b|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

export type Recommendation = {
  artist: string;
  mbid?: string; // MusicBrainz ID, when known (used to keep a band over its members)
  score: number;
  because: ArtistTaste; // the artist of yours that contributed the most
  contribution: number; // how many points that artist contributed
};

function entryFor(profile: TasteProfile, artist: string): ArtistTaste {
  const key = normalize(artist);
  let entry = profile.get(key);
  if (!entry) {
    entry = { artist, score: 0, tierCounts: { S: 0, A: 0, B: 0, C: 0, D: 0 }, concerts: 0 };
    profile.set(key, entry);
  }
  return entry;
}

// Step 1: points for every song in your tiers (S = 5 ... D = 1), plus 1 point per concert
export function buildTasteProfile(input: {
  concerts: Concert[];
  songs: SongCount[]; // to look up which artist each live tier song belongs to
  liveTiers: Tiers;
  customLists: CustomList[];
}): TasteProfile {
  const profile: TasteProfile = new Map();

  const addTiers = (tiers: Tiers, artistOf: (key: string) => string | undefined) => {
    for (const tier of TIER_NAMES) {
      for (const key of tiers[tier] ?? []) {
        const artist = artistOf(key);
        if (!artist) continue; // a song that no longer exists
        const entry = entryFor(profile, artist);
        entry.tierCounts[tier]++;
        entry.score += TIER_POINTS[tier];
      }
    }
  };

  const liveArtists = new Map(input.songs.map((s) => [s.key, s.artist]));
  addTiers(input.liveTiers, (key) => liveArtists.get(key));

  for (const list of input.customLists) {
    const listArtists = new Map(list.items.map((i) => [i.key, i.artist]));
    addTiers(list.tiers, (key) => listArtists.get(key));
  }

  for (const concert of input.concerts) {
    const entry = entryFor(profile, concert.artist);
    entry.concerts++;
    entry.score += CONCERT_POINTS;
  }

  return profile;
}

// Step 2: your highest-scoring artists
export function pickSeeds(profile: TasteProfile, count = 8): ArtistTaste[] {
  return [...profile.values()]
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score || a.artist.localeCompare(b.artist))
    .slice(0, count);
}

// Step 3: score every similar artist, skip ones you already know, and keep the best
export function scoreCandidates(
  profile: TasteProfile,
  similarBySeed: Record<string, SimilarArtist[]>, // keyed by the seed's display name
  limit = 10,
  exclude: Exclusions = NO_EXCLUSIONS
): Recommendation[] {
  // True for an artist you already know, or a member of one of your top bands
  const isKnown = (name: string) => profile.has(normalize(name)) || exclude.names.has(normalize(name));
  const candidates = new Map<string, Recommendation>();

  for (const [seedName, similar] of Object.entries(similarBySeed)) {
    const seed = profile.get(normalize(seedName));
    if (!seed) continue;
    for (const { name, match, mbid } of similar) {
      // Skip: an artist you already know, or a member of one of your top bands (e.g. a 5SOS member's
      // solo music). The other way around is allowed: a solo top artist's band can be suggested.
      if (isKnown(name) || (mbid && exclude.ids.has(mbid))) continue;
      // Skip collaboration credits that include someone you already know
      // ("Bruno Mars, Anderson .Paak & Silk Sonic" when you've seen Bruno Mars)
      if (splitCollaboration(name).some(isKnown)) continue;
      // Two spellings of the same name count as one candidate
      const key = canonicalName(name);
      const points = seed.score * match;
      const entry = candidates.get(key) ?? { artist: name, mbid, score: 0, because: seed, contribution: 0 };
      entry.score += points;
      // Remember which of your artists contributed the most, for the "Because..." reason
      if (points > entry.contribution) {
        entry.because = seed;
        entry.contribution = points;
      }
      candidates.set(key, entry);
    }
  }

  return [...candidates.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

// Pure: for variety, when a band and its own members are both recommended, keep only the band.
// memberOf: for each candidate's MusicBrainz ID, the IDs of bands they're a member of.
// (Recommender systems call this "diversity": not filling the list with near-identical picks.)
export function diversify(recs: Recommendation[], memberOf: Record<string, string[]>): Recommendation[] {
  const recommendedIds = new Set(recs.map((r) => r.mbid).filter(Boolean));
  return recs.filter((r) => !(r.mbid && (memberOf[r.mbid] ?? []).some((band) => recommendedIds.has(band))));
}

// A short, human reason for a recommendation, based on your strongest signal for that artist
export function reasonFor(taste: ArtistTaste): string {
  for (const tier of TIER_NAMES) {
    const n = taste.tierCounts[tier];
    if (n > 0) return `Because you ranked ${n} ${n === 1 ? "song" : "songs"} by ${taste.artist} in ${tier} tier`;
  }
  const c = taste.concerts;
  return `Because you've seen ${taste.artist} live${c > 1 ? ` ${c} times` : ""}`;
}

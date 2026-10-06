// Geohash: a way of writing a location as a short string, like "dpz83" for downtown Toronto.
// Ticketmaster's event search takes locations in this form (its "geoPoint" parameter).
//
// How it works: the world is split in half again and again, alternating between longitude
// (east/west) and latitude (north/south). Each split adds one bit: 1 if the point is in the upper
// half, 0 if the lower. Every 5 bits become one character, from a 32-character alphabet.
// So more characters = smaller box = more precise (9 characters is about 5 metres).

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"; // no a, i, l, o (too easy to confuse)

export function encodeGeohash(latitude: number, longitude: number, precision = 9): string {
  let latRange = [-90, 90];
  let lonRange = [-180, 180];
  let hash = "";
  let bits = 0; // the 5 bits being collected for the next character
  let bitCount = 0;
  let useLongitude = true; // the first split is east/west

  while (hash.length < precision) {
    const range = useLongitude ? lonRange : latRange;
    const value = useLongitude ? longitude : latitude;
    const mid = (range[0] + range[1]) / 2;
    if (value >= mid) {
      bits = bits * 2 + 1; // upper half: add a 1 bit
      range[0] = mid;
    } else {
      bits = bits * 2; // lower half: add a 0 bit
      range[1] = mid;
    }
    if (useLongitude) lonRange = range;
    else latRange = range;
    useLongitude = !useLongitude;

    if (++bitCount === 5) {
      hash += BASE32[bits];
      bits = 0;
      bitCount = 0;
    }
  }
  return hash;
}

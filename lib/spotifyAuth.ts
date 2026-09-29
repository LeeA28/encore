// Spotify login ("OAuth Authorization Code flow"), server-only.
//
// How it works:
//  1. /api/spotify/login sends the user to Spotify's login page
//  2. The user approves Encore, and Spotify sends them back to /api/spotify/callback with a one-time "code"
//  3. The server trades that code (plus our secret) for an access token and a refresh token
//  4. Tokens are stored in httpOnly cookies: the browser holds them but JavaScript can't read them
//  5. Access tokens expire after an hour, so getAccessToken() quietly uses the refresh token to get a new one

import { cookies } from "next/headers";

export const COOKIE = {
  access: "spotify_access_token",
  refresh: "spotify_refresh_token",
  expires: "spotify_expires_at",
  state: "spotify_auth_state",
};

// What Encore asks permission for. Browsing albums needs no special scope; these are for making playlists later.
export const SCOPES = ["playlist-modify-private", "playlist-modify-public"];

const TOKEN_URL = "https://accounts.spotify.com/api/token";

export function getConfig() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Spotify settings are missing from .env.local");
  }
  return { clientId, clientSecret, redirectUri };
}

export const cookieOptions = {
  httpOnly: true, // JavaScript in the browser can't read it, which protects the token
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production", // HTTPS-only once deployed
  path: "/",
};

export type TokenResponse = {
  access_token: string;
  expires_in: number; // seconds until the access token expires (usually 3600)
  refresh_token?: string;
};

// Asks Spotify for tokens. Used both for the first login and for refreshing.
export async function requestTokens(body: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret } = getConfig();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // "Basic" auth = "clientId:clientSecret" encoded in base64, proving the request comes from Encore
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body: new URLSearchParams(body),
  });
  if (!res.ok) {
    throw new Error(`Spotify token request failed (status ${res.status})`);
  }
  return res.json();
}

// Returns a valid access token, refreshing it first if it has expired. null = not connected.
export async function getAccessToken(): Promise<string | null> {
  const store = await cookies();
  const access = store.get(COOKIE.access)?.value;
  const refresh = store.get(COOKIE.refresh)?.value;
  const expiresAt = Number(store.get(COOKIE.expires)?.value ?? 0);

  // Still valid for at least another minute? Use it.
  if (access && Date.now() < expiresAt - 60_000) return access;
  if (!refresh) return null;

  try {
    const tokens = await requestTokens({ grant_type: "refresh_token", refresh_token: refresh });
    saveTokens(store, tokens);
    return tokens.access_token;
  } catch {
    return null; // refresh failed (e.g. the user removed Encore's access in their Spotify settings)
  }
}

type CookieStore = Awaited<ReturnType<typeof cookies>>;

export function saveTokens(store: CookieStore, tokens: TokenResponse) {
  const month = 60 * 60 * 24 * 30;
  store.set(COOKIE.access, tokens.access_token, { ...cookieOptions, maxAge: month });
  store.set(COOKIE.expires, String(Date.now() + tokens.expires_in * 1000), { ...cookieOptions, maxAge: month });
  // Spotify only sometimes sends a new refresh token; keep the old one if not
  if (tokens.refresh_token) {
    store.set(COOKIE.refresh, tokens.refresh_token, { ...cookieOptions, maxAge: month * 6 });
  }
}

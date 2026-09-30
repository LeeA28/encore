// GET /api/spotify/callback: Spotify sends the user back here after they approve (or decline)

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, getConfig, requestTokens, saveTokens } from "@/lib/spotifyAuth";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const store = await cookies();
  const savedState = store.get(COOKIE.state)?.value;
  const tab = store.get(COOKIE.returnTab)?.value ?? "concerts";
  store.delete(COOKIE.state);
  store.delete(COOKIE.returnTab);

  // Back to the tab the user started from, with an error message if something went wrong
  const back = (error?: string) =>
    NextResponse.redirect(
      new URL(`/?tab=${tab}${error ? `&spotifyError=${encodeURIComponent(error)}` : ""}`, request.url)
    );

  if (params.get("error")) return back("Spotify login was cancelled.");
  if (!code || !state || state !== savedState) return back("Spotify login failed. Please try again.");

  try {
    const { redirectUri } = getConfig();
    // Trade the one-time code for tokens (this uses our secret, which is why it happens on the server)
    const tokens = await requestTokens({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
    saveTokens(store, tokens);
    return back();
  } catch (err) {
    console.error(err);
    return back("Couldn't finish connecting to Spotify.");
  }
}

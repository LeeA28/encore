// GET /api/spotify/login?returnTo=songs: sends the user to Spotify to approve Encore

import { NextRequest, NextResponse } from "next/server";
import { COOKIE, SCOPES, cookieOptions, getConfig } from "@/lib/spotifyAuth";

const TABS = ["concerts", "songs", "rank", "discover"];

export async function GET(request: NextRequest) {
  const { clientId, redirectUri } = getConfig();

  // A random value we'll check when Spotify sends the user back. If it doesn't match,
  // the login didn't start from Encore, so we reject it (this blocks a kind of attack called CSRF).
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES.join(" "),
    state,
  });

  const response = NextResponse.redirect(`https://accounts.spotify.com/authorize?${params}`);
  response.cookies.set(COOKIE.state, state, { ...cookieOptions, maxAge: 600 }); // valid for 10 minutes

  // Remember which tab the user was on, so the callback can send them back there.
  // Only known tab names are accepted, so this can't be used to redirect somewhere unexpected.
  const returnTo = request.nextUrl.searchParams.get("returnTo") ?? "";
  response.cookies.set(COOKIE.returnTab, TABS.includes(returnTo) ? returnTo : "concerts", {
    ...cookieOptions,
    maxAge: 600,
  });
  return response;
}

// GET /api/spotify/login: sends the user to Spotify to approve Encore

import { NextResponse } from "next/server";
import { COOKIE, SCOPES, cookieOptions, getConfig } from "@/lib/spotifyAuth";

export async function GET() {
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
  return response;
}

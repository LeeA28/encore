// GET /auth/callback?code=...
// Where Supabase's default emails send people: after confirming an email, or from a "reset password" link.
// The one-time code is traded for a login session, so clicking the link logs you in directly.
//
// This works in the same browser you signed up with: at sign-up, the browser stored a secret
// (part of a security check called PKCE), and the code only works together with that secret.
// On another device the email is still confirmed, so we just ask the person to log in.

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOrigin } from "@/lib/siteUrl";

export async function GET(request: NextRequest) {
  const origin = getOrigin(request);
  const code = request.nextUrl.searchParams.get("code");
  // ?next=reset comes from "forgot password" links: after logging in, ask for a new password.
  // Only this exact value is accepted, so the link can't be used to send people anywhere else.
  const isReset = request.nextUrl.searchParams.get("next") === "reset";

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(isReset ? "/?reset=1" : "/?confirmed=1", origin));
  }

  if (isReset) {
    const message =
      "That reset link didn't work. It may have expired, or been opened in a different browser than the one you requested it from. Request a new one from Log in → Forgot password.";
    return NextResponse.redirect(new URL(`/?authError=${encodeURIComponent(message)}`, origin));
  }

  const message = "Your email is confirmed. Log in to continue.";
  return NextResponse.redirect(new URL(`/?authNotice=${encodeURIComponent(message)}`, origin));
}

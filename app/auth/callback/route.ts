// GET /auth/callback?code=...
// Where Supabase's default confirmation email sends people after it confirms their email.
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

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/?confirmed=1", origin));
  }

  const message = "Your email is confirmed. Log in to continue.";
  return NextResponse.redirect(new URL(`/?authNotice=${encodeURIComponent(message)}`, origin));
}

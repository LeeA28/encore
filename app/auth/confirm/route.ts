// GET /auth/confirm?token_hash=...&type=email   (or type=recovery, for "reset your password" links)
// Custom email template links point here (they work on any device). We ask Supabase to verify the token,
// which also logs the user in (by setting their login cookies), then send them to the homepage.

import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOrigin } from "@/lib/siteUrl";

export async function GET(request: NextRequest) {
  const origin = getOrigin(request);
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    // type=recovery is a "reset your password" link: you're logged in now, so ask for the new password
    if (!error) return NextResponse.redirect(`${origin}/${type === "recovery" ? "?reset=1" : "?confirmed=1"}`);
  }

  const message =
    type === "recovery"
      ? "That reset link is invalid or has expired. Request a new one from Log in → Forgot password."
      : "That confirmation link is invalid or has expired. Try logging in to get a new one.";
  return NextResponse.redirect(`${origin}/?authError=${encodeURIComponent(message)}`);
}

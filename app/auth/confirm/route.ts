// GET /auth/confirm?token_hash=...&type=email
// The link in the "confirm your email" message points here. We ask Supabase to verify the token,
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
    if (!error) return NextResponse.redirect(`${origin}/?confirmed=1`);
  }

  const message = "That confirmation link is invalid or has expired. Try logging in to get a new one.";
  return NextResponse.redirect(`${origin}/?authError=${encodeURIComponent(message)}`);
}

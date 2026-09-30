// Keeps Supabase login sessions fresh. Runs on the server before each page request (see /proxy.ts).
// Login tokens expire, and this is where they get refreshed and saved back into cookies.
// Based on Supabase's official Next.js setup.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response; // not set up yet: let the page load anyway

  const supabase = createServerClient(url, key, {
    cookies: {
      // How Supabase reads the login cookies from the incoming request
      getAll() {
        return request.cookies.getAll();
      },
      // How Supabase saves refreshed cookies: onto the request (for this page) and the response (for the browser)
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  // Checking the login is what triggers a refresh when needed. Don't remove this line.
  await supabase.auth.getClaims();

  return response;
}

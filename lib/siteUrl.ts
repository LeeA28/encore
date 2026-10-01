// The address to send people back to after a redirect (Spotify login, email confirmation).
//
// Why not just use request.url? Next.js's dev server reports it as "localhost:3000" even when you're
// on "127.0.0.1:3000", and cookies belong to one exact address, so landing on the other one looks
// like being logged out. Instead we use the Host header: the address your browser actually used.
// Once deployed, set SITE_URL in the environment (e.g. https://encore.example.com) to always use it.

import type { NextRequest } from "next/server";

export function getOrigin(request: NextRequest): string {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return host ? `${protocol}://${host}` : request.nextUrl.origin;
}


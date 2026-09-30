// Next.js 16 "proxy" (called "middleware" in older versions): code that runs on the server
// before a request reaches a page. Here it refreshes the Supabase login session.

import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Skip files that never need a login check (Next.js internals and images)
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

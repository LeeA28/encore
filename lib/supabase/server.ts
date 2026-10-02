// The Supabase client for server code (API routes). It reads and writes the login cookies
// through Next.js's cookies() helper. Used by /auth/confirm to finish email confirmation.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "../database.types";

export async function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase settings are missing from .env.local");

  const store = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Only route handlers can set cookies; elsewhere, proxy.ts takes care of it
        }
      },
    },
  });
}

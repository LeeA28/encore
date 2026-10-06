// The Supabase client used in the browser (for login and reading/saving data).
// The URL and publishable key are public on purpose: Row Level Security in the database
// (see supabase/schema.sql) is what stops anyone from touching other users' data.

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../database.types";

// True when this copy of Encore has Supabase settings. Without them, Encore runs entirely in the
// browser (as a guest), and features that share data between users quietly switch off.
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase settings are missing from .env.local (restart the dev server after adding them)");
  }
  // createBrowserClient reuses one client for the whole page, so calling this repeatedly is fine.
  // <Database> tells it about Encore's tables, so table and column names are checked by TypeScript.
  return createBrowserClient<Database>(url, key);
}

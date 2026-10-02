// Short names for the generated database types, so the rest of the code can say
// Row<"concerts"> instead of Database["public"]["Tables"]["concerts"]["Row"].
// (Kept separate from database.types.ts, since that file gets replaced every time types are regenerated.)

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type { Json } from "./database.types";

type PublicTables = Database["public"]["Tables"];
export type TableName = keyof PublicTables; // "concerts" | "custom_lists" | "live_tiers" | "playlists"

export type Row<T extends TableName> = PublicTables[T]["Row"];
export type Insert<T extends TableName> = PublicTables[T]["Insert"];

// A Supabase client that knows Encore's tables. Misspelled tables or columns become TypeScript errors.
export type EncoreSupabase = SupabaseClient<Database>;

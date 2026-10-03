// Types describing Encore's database: every table, and every column's type.
//
// THIS FILE IS GENERATED. Don't edit it by hand: after changing the database (with a new migration),
// run `npm run db:types` to regenerate it from your real Supabase database.
// (This first version was written to match the migrations, so the code works before you've
// run the generator; your first `npm run db:types` replaces it with the real thing.)
//
// For each table:
//  - Row:    what you get back when reading
//  - Insert: what you can send when adding a row (columns with defaults are optional)
//  - Update: what you can send when changing a row (everything is optional)

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      concerts: {
        Row: {
          added_at: string;
          artist: string;
          city: string;
          country: string | null;
          date: string;
          setlist_id: string;
          songs: Json;
          tour: string | null;
          url: string;
          user_id: string;
          venue: string;
        };
        Insert: {
          added_at?: string;
          artist: string;
          city?: string;
          country?: string | null;
          date: string;
          setlist_id: string;
          songs?: Json;
          tour?: string | null;
          url: string;
          user_id?: string;
          venue: string;
        };
        Update: {
          added_at?: string;
          artist?: string;
          city?: string;
          country?: string | null;
          date?: string;
          setlist_id?: string;
          songs?: Json;
          tour?: string | null;
          url?: string;
          user_id?: string;
          venue?: string;
        };
        Relationships: [];
      };
      custom_lists: {
        Row: {
          created_at: string;
          id: string;
          items: Json;
          name: string;
          tiers: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          items?: Json;
          name: string;
          tiers?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          items?: Json;
          name?: string;
          tiers?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      live_tiers: {
        Row: {
          tiers: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          tiers: Json;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          tiers?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      match_votes: {
        Row: {
          song_key: string;
          track_album: string | null;
          track_artist: string;
          track_id: string;
          track_name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          song_key: string;
          track_album?: string | null;
          track_artist: string;
          track_id: string;
          track_name: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          song_key?: string;
          track_album?: string | null;
          track_artist?: string;
          track_id?: string;
          track_name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      song_additions: {
        Row: {
          created_at: string;
          setlist_id: string;
          song_name: string;
          song_norm: string;
          spotify_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          setlist_id: string;
          song_name: string;
          song_norm: string;
          spotify_id?: string | null;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          setlist_id?: string;
          song_name?: string;
          song_norm?: string;
          spotify_id?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      playlists: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          source: string;
          spotify_id: string;
          track_count: number;
          url: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          source: string;
          spotify_id: string;
          track_count: number;
          url: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          source?: string;
          spotify_id?: string;
          track_count?: number;
          url?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      get_concert_additions: {
        Args: { setlist_ids: string[] };
        Returns: {
          people: number;
          setlist_id: string;
          song_name: string;
          spotify_id: string;
        }[];
      };
      get_shared_matches: {
        Args: { song_keys: string[] };
        Returns: {
          song_key: string;
          track_album: string;
          track_artist: string;
          track_id: string;
          track_name: string;
          votes: number;
        }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

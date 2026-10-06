export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      concerts: {
        Row: {
          added_at: string
          artist: string
          city: string
          country: string | null
          date: string
          setlist_id: string
          songs: Json
          tour: string | null
          url: string
          user_id: string
          venue: string
        }
        Insert: {
          added_at?: string
          artist: string
          city?: string
          country?: string | null
          date: string
          setlist_id: string
          songs?: Json
          tour?: string | null
          url: string
          user_id?: string
          venue: string
        }
        Update: {
          added_at?: string
          artist?: string
          city?: string
          country?: string | null
          date?: string
          setlist_id?: string
          songs?: Json
          tour?: string | null
          url?: string
          user_id?: string
          venue?: string
        }
        Relationships: []
      }
      custom_lists: {
        Row: {
          created_at: string
          id: string
          items: Json
          name: string
          tiers: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          name: string
          tiers?: Json
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          name?: string
          tiers?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      live_tiers: {
        Row: {
          tiers: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          tiers: Json
          updated_at?: string
          user_id?: string
        }
        Update: {
          tiers?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      match_votes: {
        Row: {
          song_key: string
          track_album: string | null
          track_artist: string
          track_id: string
          track_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          song_key: string
          track_album?: string | null
          track_artist: string
          track_id: string
          track_name: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          song_key?: string
          track_album?: string | null
          track_artist?: string
          track_id?: string
          track_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      playlists: {
        Row: {
          created_at: string
          id: string
          name: string
          source: string
          source_ref: Json | null
          spotify_id: string
          track_count: number
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          source: string
          source_ref?: Json | null
          spotify_id: string
          track_count: number
          url: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          source?: string
          source_ref?: Json | null
          spotify_id?: string
          track_count?: number
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_lists: {
        Row: {
          concert_ids: string[]
          created_at: string
          id: string
          name: string
          tiers: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          concert_ids?: string[]
          created_at?: string
          id?: string
          name: string
          tiers?: Json
          updated_at?: string
          user_id?: string
        }
        Update: {
          concert_ids?: string[]
          created_at?: string
          id?: string
          name?: string
          tiers?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      song_additions: {
        Row: {
          created_at: string
          setlist_id: string
          song_name: string
          song_norm: string
          spotify_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          setlist_id: string
          song_name: string
          song_norm: string
          spotify_id?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          setlist_id?: string
          song_name?: string
          song_norm?: string
          spotify_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_co_attended_artists: {
        Args: { setlist_ids: string[] }
        Returns: {
          artist: string
          people: number
        }[]
      }
      get_concert_additions: {
        Args: { setlist_ids: string[] }
        Returns: {
          people: number
          setlist_id: string
          song_name: string
          spotify_id: string
        }[]
      }
      get_shared_matches: {
        Args: { song_keys: string[] }
        Returns: {
          song_key: string
          track_album: string
          track_artist: string
          track_id: string
          track_name: string
          votes: number
        }[]
      }
      hook_before_user_created: { Args: { event: Json }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

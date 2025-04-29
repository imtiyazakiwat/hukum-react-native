export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          avatar_url: string | null
          is_guest: boolean
          created_at: string
          updated_at: string
          last_seen: string
        }
        Insert: {
          id: string
          username: string
          avatar_url?: string | null
          is_guest?: boolean
          created_at?: string
          updated_at?: string
          last_seen?: string
        }
        Update: {
          id?: string
          username?: string
          avatar_url?: string | null
          is_guest?: boolean
          created_at?: string
          updated_at?: string
          last_seen?: string
        }
      }
      user_stats: {
        Row: {
          user_id: string
          games_played: number
          games_won: number
          rating: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          games_played?: number
          games_won?: number
          rating?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          games_played?: number
          games_won?: number
          rating?: number
          created_at?: string
          updated_at?: string
        }
      }
      lobbies: {
        Row: {
          id: string
          name: string
          host_id: string
          max_players: number
          is_private: boolean
          invite_code: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          host_id: string
          max_players?: number
          is_private?: boolean
          invite_code?: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          host_id?: string
          max_players?: number
          is_private?: boolean
          invite_code?: string
          status?: string
          created_at?: string
        }
      }
      games: {
        Row: {
          id: string
          lobby_id: string
          status: string
          current_player: number
          hukum_suit: string | null
          starting_suit: string | null
          current_round: number
          team_a_score: number
          team_b_score: number
          round_winner: string | null
          game_winner: string | null
          round_start_time: string | null
          turn_start_time: string | null
          turn_max_seconds: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lobby_id: string
          status?: string
          current_player?: number
          hukum_suit?: string | null
          starting_suit?: string | null
          current_round?: number
          team_a_score?: number
          team_b_score?: number
          round_winner?: string | null
          game_winner?: string | null
          round_start_time?: string | null
          turn_start_time?: string | null
          turn_max_seconds?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lobby_id?: string
          status?: string
          current_player?: number
          hukum_suit?: string | null
          starting_suit?: string | null
          current_round?: number
          team_a_score?: number
          team_b_score?: number
          round_winner?: string | null
          game_winner?: string | null
          round_start_time?: string | null
          turn_start_time?: string | null
          turn_max_seconds?: number
          created_at?: string
          updated_at?: string
        }
      }
      game_players: {
        Row: {
          id: string
          game_id: string
          user_id: string
          player_position: number
          team: string
          is_connected: boolean
          last_action_time: string
        }
        Insert: {
          id?: string
          game_id: string
          user_id: string
          player_position: number
          team: string
          is_connected?: boolean
          last_action_time?: string
        }
        Update: {
          id?: string
          game_id?: string
          user_id?: string
          player_position?: number
          team?: string
          is_connected?: boolean
          last_action_time?: string
        }
      }
      player_hands: {
        Row: {
          id: string
          game_id: string
          player_id: string
          cards: Json
        }
        Insert: {
          id?: string
          game_id: string
          player_id: string
          cards: Json
        }
        Update: {
          id?: string
          game_id?: string
          player_id?: string
          cards?: Json
        }
      }
      table_cards: {
        Row: {
          id: string
          game_id: string
          player_id: string
          card: Json
          played_at: string
        }
        Insert: {
          id?: string
          game_id: string
          player_id: string
          card: Json
          played_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          player_id?: string
          card?: Json
          played_at?: string
        }
      }
      game_history: {
        Row: {
          id: string
          game_id: string
          winner_team: string
          team_a_score: number
          team_b_score: number
          hukum_suit: string
          duration_seconds: number | null
          completed_at: string
        }
        Insert: {
          id?: string
          game_id: string
          winner_team: string
          team_a_score: number
          team_b_score: number
          hukum_suit: string
          duration_seconds?: number | null
          completed_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          winner_team?: string
          team_a_score?: number
          team_b_score?: number
          hukum_suit?: string
          duration_seconds?: number | null
          completed_at?: string
        }
      }
      game_invitations: {
        Row: {
          id: string
          lobby_id: string
          sender_id: string
          recipient_email: string | null
          status: string
          created_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          lobby_id: string
          sender_id: string
          recipient_email?: string | null
          status?: string
          created_at?: string
          expires_at?: string
        }
        Update: {
          id?: string
          lobby_id?: string
          sender_id?: string
          recipient_email?: string | null
          status?: string
          created_at?: string
          expires_at?: string
        }
      }
      matchmaking_queue: {
        Row: {
          id: string
          user_id: string
          rating: number
          joined_at: string
        }
        Insert: {
          id?: string
          user_id: string
          rating?: number
          joined_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          rating?: number
          joined_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_players: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
} 
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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      balances: {
        Row: {
          cny: number
          eur: number
          kzt: number
          rub: number
          user_id: string
          uzs: number
        }
        Insert: {
          cny?: number
          eur?: number
          kzt?: number
          rub?: number
          user_id: string
          uzs?: number
        }
        Update: {
          cny?: number
          eur?: number
          kzt?: number
          rub?: number
          user_id?: string
          uzs?: number
        }
        Relationships: [
          {
            foreignKeyName: "balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          id: string
          name: string
          no_receipt: boolean
          visible_to: string
        }
        Insert: {
          id?: string
          name: string
          no_receipt?: boolean
          visible_to?: string
        }
        Update: {
          id?: string
          name?: string
          no_receipt?: boolean
          visible_to?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          comment: string | null
          currency: string
          date: string
          id: string
          performed_by: string | null
          receipt_url: string | null
          truck: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          category: string
          comment?: string | null
          currency?: string
          date?: string
          id?: string
          performed_by?: string | null
          receipt_url?: string | null
          truck?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          comment?: string | null
          currency?: string
          date?: string
          id?: string
          performed_by?: string | null
          receipt_url?: string | null
          truck?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mileage: {
        Row: {
          date: string
          id: string
          km: number
          photo_url: string | null
          truck: string | null
          user_id: string | null
        }
        Insert: {
          date?: string
          id?: string
          km: number
          photo_url?: string | null
          truck?: string | null
          user_id?: string | null
        }
        Update: {
          date?: string
          id?: string
          km?: number
          photo_url?: string | null
          truck?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mileage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_balances: {
        Row: {
          cny: number
          eur: number
          kzt: number
          rub: number
          user_id: string
          uzs: number
        }
        Insert: {
          cny?: number
          eur?: number
          kzt?: number
          rub?: number
          user_id: string
          uzs?: number
        }
        Update: {
          cny?: number
          eur?: number
          kzt?: number
          rub?: number
          user_id?: string
          uzs?: number
        }
        Relationships: [
          {
            foreignKeyName: "pre_balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      transfers: {
        Row: {
          amount: number
          comment: string | null
          currency: string
          date: string
          from_driver_id: string | null
          id: string
          performed_by: string | null
          to_driver_id: string | null
        }
        Insert: {
          amount: number
          comment?: string | null
          currency: string
          date?: string
          from_driver_id?: string | null
          id?: string
          performed_by?: string | null
          to_driver_id?: string | null
        }
        Update: {
          amount?: number
          comment?: string | null
          currency?: string
          date?: string
          from_driver_id?: string | null
          id?: string
          performed_by?: string | null
          to_driver_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transfers_from_driver_id_fkey"
            columns: ["from_driver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_to_driver_id_fkey"
            columns: ["to_driver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      trucks: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          available_currencies: string | null
          created_at: string | null
          id: string
          legacy_id: number | null
          login: string
          name: string
          password: string
          role: string
        }
        Insert: {
          available_currencies?: string | null
          created_at?: string | null
          id?: string
          legacy_id?: number | null
          login: string
          name: string
          password: string
          role?: string
        }
        Update: {
          available_currencies?: string | null
          created_at?: string | null
          id?: string
          legacy_id?: number | null
          login?: string
          name?: string
          password?: string
          role?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

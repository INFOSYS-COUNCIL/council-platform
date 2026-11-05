
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "approved_council_accounts": {
                  Row: {
                    "activated_at": string | null,"activated_user_id": string | null,"created_at": string,"department_id": string | null,"email": string,"id": string,"is_active": boolean,"position_id": string | null,"registered_by": string | null,"role": Database["public"]['Enums']["member_role"],"student_no": string | null,"term_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activated_at"?: string | null,"activated_user_id"?: string | null,"created_at"?: string,"department_id"?: string | null,"email": string,"id"?: string,"is_active"?: boolean,"position_id"?: string | null,"registered_by"?: string | null,"role": Database["public"]['Enums']["member_role"],"student_no"?: string | null,"term_id": string
                  }
                  Update: {
                    "activated_at"?: string | null,"activated_user_id"?: string | null,"created_at"?: string,"department_id"?: string | null,"email"?: string,"id"?: string,"is_active"?: boolean,"position_id"?: string | null,"registered_by"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"student_no"?: string | null,"term_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "approved_council_accounts_activated_user_id_fkey"
      columns: ["activated_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approved_council_accounts_registered_by_fkey"
      columns: ["registered_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approved_council_accounts_term_id_fkey"
      columns: ["term_id"]
isOneToOne: false
      referencedRelation: "terms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approved_department_same_term"
      columns: ["term_id","department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["term_id","id"]
    },{
      foreignKeyName: "approved_position_same_term"
      columns: ["term_id","position_id"]
isOneToOne: false
      referencedRelation: "positions"
      referencedColumns: ["term_id","id"]
    }
                  ]
                },"departments": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"name": string,"sort_order": number,"term_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"sort_order"?: number,"term_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number,"term_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "departments_term_id_fkey"
      columns: ["term_id"]
isOneToOne: false
      referencedRelation: "terms"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "approved_account_id": string | null,"department_id": string | null,"id": string,"is_active": boolean,"joined_at": string,"left_at": string | null,"position_id": string | null,"role": Database["public"]['Enums']["member_role"],"term_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_account_id"?: string | null,"department_id"?: string | null,"id"?: string,"is_active"?: boolean,"joined_at"?: string,"left_at"?: string | null,"position_id"?: string | null,"role": Database["public"]['Enums']["member_role"],"term_id": string,"user_id": string
                  }
                  Update: {
                    "approved_account_id"?: string | null,"department_id"?: string | null,"id"?: string,"is_active"?: boolean,"joined_at"?: string,"left_at"?: string | null,"position_id"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"term_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_approved_same_term"
      columns: ["term_id","approved_account_id"]
isOneToOne: false
      referencedRelation: "approved_council_accounts"
      referencedColumns: ["term_id","id"]
    },{
      foreignKeyName: "memberships_department_same_term"
      columns: ["term_id","department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["term_id","id"]
    },{
      foreignKeyName: "memberships_position_same_term"
      columns: ["term_id","position_id"]
isOneToOne: false
      referencedRelation: "positions"
      referencedColumns: ["term_id","id"]
    },{
      foreignKeyName: "memberships_term_id_fkey"
      columns: ["term_id"]
isOneToOne: false
      referencedRelation: "terms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"positions": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"name": string,"sort_order": number,"term_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"sort_order"?: number,"term_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number,"term_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "positions_term_id_fkey"
      columns: ["term_id"]
isOneToOne: false
      referencedRelation: "terms"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"email": string,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"email": string,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"email"?: string,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"terms": {
                  Row: {
                    "created_at": string,"ends_on": string | null,"id": string,"name": string,"starts_on": string | null,"status": Database["public"]['Enums']["term_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ends_on"?: string | null,"id"?: string,"name": string,"starts_on"?: string | null,"status"?: Database["public"]['Enums']["term_status"]
                  }
                  Update: {
                    "created_at"?: string,"ends_on"?: string | null,"id"?: string,"name"?: string,"starts_on"?: string | null,"status"?: Database["public"]['Enums']["term_status"]
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "activate_membership":
{ Args: Record<PropertyKey, never>; Returns: {
              "approved_account_id": string | null,
"department_id": string | null,
"id": string,
"is_active": boolean,
"joined_at": string,
"left_at": string | null,
"position_id": string | null,
"role": Database["public"]['Enums']["member_role"],
"term_id": string,
"user_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "memberships"
        isOneToOne: false
        isSetofReturn: true
      } },
"cancel_approved_account":
{ Args: { "p_account_id": string }; Returns: {
              "activated_at": string | null,
"activated_user_id": string | null,
"created_at": string,
"department_id": string | null,
"email": string,
"id": string,
"is_active": boolean,
"position_id": string | null,
"registered_by": string | null,
"role": Database["public"]['Enums']["member_role"],
"student_no": string | null,
"term_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "approved_council_accounts"
        isOneToOne: true
        isSetofReturn: false
      } },
"change_member_role":
{ Args: { "p_department_id": string,"p_membership_id": string,"p_position_id"?: string,"p_role": Database["public"]['Enums']["member_role"] }; Returns: {
              "approved_account_id": string | null,
"department_id": string | null,
"id": string,
"is_active": boolean,
"joined_at": string,
"left_at": string | null,
"position_id": string | null,
"role": Database["public"]['Enums']["member_role"],
"term_id": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "memberships"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_department":
{ Args: { "p_name": string,"p_sort_order"?: number,"p_term_id": string }; Returns: {
              "created_at": string,
"id": string,
"is_active": boolean,
"name": string,
"sort_order": number,
"term_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "departments"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_position":
{ Args: { "p_name": string,"p_sort_order"?: number,"p_term_id": string }; Returns: {
              "created_at": string,
"id": string,
"is_active": boolean,
"name": string,
"sort_order": number,
"term_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "positions"
        isOneToOne: true
        isSetofReturn: false
      } },
"end_membership":
{ Args: { "p_membership_id": string }; Returns: {
              "approved_account_id": string | null,
"department_id": string | null,
"id": string,
"is_active": boolean,
"joined_at": string,
"left_at": string | null,
"position_id": string | null,
"role": Database["public"]['Enums']["member_role"],
"term_id": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "memberships"
        isOneToOne: true
        isSetofReturn: false
      } },
"hook_before_user_created":
{ Args: { "event": Json }; Returns: Json
                           },
"register_approved_accounts":
{ Args: { "p_rows": Json,"p_term_id": string }; Returns: {
              "account_id": string,"email": string,"error": string,"row_no": number
            }[]
                           },
"set_approved_student_no":
{ Args: { "p_account_id": string,"p_student_no": string }; Returns: {
              "activated_at": string | null,
"activated_user_id": string | null,
"created_at": string,
"department_id": string | null,
"email": string,
"id": string,
"is_active": boolean,
"position_id": string | null,
"registered_by": string | null,
"role": Database["public"]['Enums']["member_role"],
"student_no": string | null,
"term_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "approved_council_accounts"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_department_active":
{ Args: { "p_active": boolean,"p_department_id": string }; Returns: {
              "created_at": string,
"id": string,
"is_active": boolean,
"name": string,
"sort_order": number,
"term_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "departments"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_position_active":
{ Args: { "p_active": boolean,"p_position_id": string }; Returns: {
              "created_at": string,
"id": string,
"is_active": boolean,
"name": string,
"sort_order": number,
"term_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "positions"
        isOneToOne: true
        isSetofReturn: false
      } },
"update_approved_account":
{ Args: { "p_account_id": string,"p_department_id": string,"p_position_id"?: string,"p_role": Database["public"]['Enums']["member_role"] }; Returns: {
              "activated_at": string | null,
"activated_user_id": string | null,
"created_at": string,
"department_id": string | null,
"email": string,
"id": string,
"is_active": boolean,
"position_id": string | null,
"registered_by": string | null,
"role": Database["public"]['Enums']["member_role"],
"student_no": string | null,
"term_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "approved_council_accounts"
        isOneToOne: true
        isSetofReturn: false
      } },
"update_department":
{ Args: { "p_department_id": string,"p_name": string,"p_sort_order": number }; Returns: {
              "created_at": string,
"id": string,
"is_active": boolean,
"name": string,
"sort_order": number,
"term_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "departments"
        isOneToOne: true
        isSetofReturn: false
      } },
"update_position":
{ Args: { "p_name": string,"p_position_id": string,"p_sort_order": number }; Returns: {
              "created_at": string,
"id": string,
"is_active": boolean,
"name": string,
"sort_order": number,
"term_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "positions"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "member_role": "MEMBER"|"DIRECTOR"|"EXECUTIVE","term_status": "DRAFT"|"ACTIVE"|"CLOSED"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "member_role": ["MEMBER", "DIRECTOR", "EXECUTIVE"],"term_status": ["DRAFT", "ACTIVE", "CLOSED"]
          }
        }
} as const

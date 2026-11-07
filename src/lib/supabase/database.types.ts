
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "activity_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"after_summary": Json | null,"before_summary": Json | null,"created_at": string,"id": number,"resource_id": string,"resource_type": string,"term_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"after_summary"?: Json | null,"before_summary"?: Json | null,"created_at"?: string,"id"?: never,"resource_id": string,"resource_type": string,"term_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"after_summary"?: Json | null,"before_summary"?: Json | null,"created_at"?: string,"id"?: never,"resource_id"?: string,"resource_type"?: string,"term_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_logs_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_logs_term_id_fkey"
      columns: ["term_id"]
isOneToOne: false
      referencedRelation: "terms"
      referencedColumns: ["id"]
    }
                  ]
                },"approved_council_accounts": {
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
                },"task_access_rules": {
                  Row: {
                    "created_at": string,"department_id": string | null,"granted_by": string,"id": string,"role_group": Database["public"]['Enums']["acl_role_group"] | null,"subject_type": Database["public"]['Enums']["acl_subject_type"],"task_id": string,"term_id": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"department_id"?: string | null,"granted_by": string,"id"?: string,"role_group"?: Database["public"]['Enums']["acl_role_group"] | null,"subject_type": Database["public"]['Enums']["acl_subject_type"],"task_id": string,"term_id": string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"department_id"?: string | null,"granted_by"?: string,"id"?: string,"role_group"?: Database["public"]['Enums']["acl_role_group"] | null,"subject_type"?: Database["public"]['Enums']["acl_subject_type"],"task_id"?: string,"term_id"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_access_department_same_term"
      columns: ["term_id","department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["term_id","id"]
    },{
      foreignKeyName: "task_access_rules_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_access_rules_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_access_task_same_term"
      columns: ["term_id","task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["term_id","id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "archived_at": string | null,"archived_by": string | null,"assignee_id": string | null,"completed_at": string | null,"created_at": string,"creator_id": string,"department_id": string,"description": string,"due_date": string | null,"id": string,"manager_id": string,"priority": Database["public"]['Enums']["task_priority"],"start_date": string | null,"status": Database["public"]['Enums']["task_status"],"term_id": string,"title": string,"updated_at": string,"visibility_mode": Database["public"]['Enums']["visibility_mode"]
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"archived_by"?: string | null,"assignee_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"creator_id": string,"department_id": string,"description"?: string,"due_date"?: string | null,"id"?: string,"manager_id": string,"priority"?: Database["public"]['Enums']["task_priority"],"start_date"?: string | null,"status"?: Database["public"]['Enums']["task_status"],"term_id": string,"title": string,"updated_at"?: string,"visibility_mode"?: Database["public"]['Enums']["visibility_mode"]
                  }
                  Update: {
                    "archived_at"?: string | null,"archived_by"?: string | null,"assignee_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"creator_id"?: string,"department_id"?: string,"description"?: string,"due_date"?: string | null,"id"?: string,"manager_id"?: string,"priority"?: Database["public"]['Enums']["task_priority"],"start_date"?: string | null,"status"?: Database["public"]['Enums']["task_status"],"term_id"?: string,"title"?: string,"updated_at"?: string,"visibility_mode"?: Database["public"]['Enums']["visibility_mode"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_archived_by_fkey"
      columns: ["archived_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_department_same_term"
      columns: ["term_id","department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["term_id","id"]
    },{
      foreignKeyName: "tasks_manager_id_fkey"
      columns: ["manager_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_term_id_fkey"
      columns: ["term_id"]
isOneToOne: false
      referencedRelation: "terms"
      referencedColumns: ["id"]
    }
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
"add_task_access_rule":
{ Args: { "p_department_id"?: string,"p_role_group"?: Database["public"]['Enums']["acl_role_group"],"p_subject_type": Database["public"]['Enums']["acl_subject_type"],"p_task_id": string,"p_user_id"?: string }; Returns: {
              "created_at": string,
"department_id": string | null,
"granted_by": string,
"id": string,
"role_group": Database["public"]['Enums']["acl_role_group"] | null,
"subject_type": Database["public"]['Enums']["acl_subject_type"],
"task_id": string,
"term_id": string,
"user_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "task_access_rules"
        isOneToOne: true
        isSetofReturn: false
      } },
"archive_task":
{ Args: { "p_task_id": string }; Returns: {
              "archived_at": string | null,
"archived_by": string | null,
"assignee_id": string | null,
"completed_at": string | null,
"created_at": string,
"creator_id": string,
"department_id": string,
"description": string,
"due_date": string | null,
"id": string,
"manager_id": string,
"priority": Database["public"]['Enums']["task_priority"],
"start_date": string | null,
"status": Database["public"]['Enums']["task_status"],
"term_id": string,
"title": string,
"updated_at": string,
"visibility_mode": Database["public"]['Enums']["visibility_mode"]
            }
                          SetofOptions: {
        from: "*"
        to: "tasks"
        isOneToOne: true
        isSetofReturn: false
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
{ Args: { "p_department_id"?: string,"p_membership_id": string,"p_position_id"?: string,"p_role": Database["public"]['Enums']["member_role"] }; Returns: {
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
"change_task_status":
{ Args: { "p_status": Database["public"]['Enums']["task_status"],"p_task_id": string }; Returns: {
              "archived_at": string | null,
"archived_by": string | null,
"assignee_id": string | null,
"completed_at": string | null,
"created_at": string,
"creator_id": string,
"department_id": string,
"description": string,
"due_date": string | null,
"id": string,
"manager_id": string,
"priority": Database["public"]['Enums']["task_priority"],
"start_date": string | null,
"status": Database["public"]['Enums']["task_status"],
"term_id": string,
"title": string,
"updated_at": string,
"visibility_mode": Database["public"]['Enums']["visibility_mode"]
            }
                          SetofOptions: {
        from: "*"
        to: "tasks"
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
"create_task":
{ Args: { "p_assignee_id"?: string,"p_department_id": string,"p_description"?: string,"p_due_date"?: string,"p_priority"?: Database["public"]['Enums']["task_priority"],"p_start_date"?: string,"p_term_id": string,"p_title": string,"p_visibility_mode"?: Database["public"]['Enums']["visibility_mode"] }; Returns: {
              "archived_at": string | null,
"archived_by": string | null,
"assignee_id": string | null,
"completed_at": string | null,
"created_at": string,
"creator_id": string,
"department_id": string,
"description": string,
"due_date": string | null,
"id": string,
"manager_id": string,
"priority": Database["public"]['Enums']["task_priority"],
"start_date": string | null,
"status": Database["public"]['Enums']["task_status"],
"term_id": string,
"title": string,
"updated_at": string,
"visibility_mode": Database["public"]['Enums']["visibility_mode"]
            }
                          SetofOptions: {
        from: "*"
        to: "tasks"
        isOneToOne: true
        isSetofReturn: false
      } },
"end_membership":
{ Args: { "p_membership_id": string,"p_transfer_to"?: string }; Returns: {
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
"membership_responsibilities":
{ Args: { "p_membership_id": string }; Returns: {
              "assigned_open_tasks": number,"managed_open_tasks": number,"restricted_managed_tasks": number
            }[]
                           },
"register_approved_accounts":
{ Args: { "p_rows": Json,"p_term_id": string }; Returns: {
              "account_id": string,"email": string,"error": string,"row_no": number
            }[]
                           },
"remove_task_access_rule":
{ Args: { "p_rule_id": string }; Returns: undefined
                           },
"restore_task":
{ Args: { "p_task_id": string }; Returns: {
              "archived_at": string | null,
"archived_by": string | null,
"assignee_id": string | null,
"completed_at": string | null,
"created_at": string,
"creator_id": string,
"department_id": string,
"description": string,
"due_date": string | null,
"id": string,
"manager_id": string,
"priority": Database["public"]['Enums']["task_priority"],
"start_date": string | null,
"status": Database["public"]['Enums']["task_status"],
"term_id": string,
"title": string,
"updated_at": string,
"visibility_mode": Database["public"]['Enums']["visibility_mode"]
            }
                          SetofOptions: {
        from: "*"
        to: "tasks"
        isOneToOne: true
        isSetofReturn: false
      } },
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
"set_task_manager":
{ Args: { "p_manager_id": string,"p_task_id": string }; Returns: {
              "archived_at": string | null,
"archived_by": string | null,
"assignee_id": string | null,
"completed_at": string | null,
"created_at": string,
"creator_id": string,
"department_id": string,
"description": string,
"due_date": string | null,
"id": string,
"manager_id": string,
"priority": Database["public"]['Enums']["task_priority"],
"start_date": string | null,
"status": Database["public"]['Enums']["task_status"],
"term_id": string,
"title": string,
"updated_at": string,
"visibility_mode": Database["public"]['Enums']["visibility_mode"]
            }
                          SetofOptions: {
        from: "*"
        to: "tasks"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_task_visibility":
{ Args: { "p_mode": Database["public"]['Enums']["visibility_mode"],"p_task_id": string }; Returns: {
              "archived_at": string | null,
"archived_by": string | null,
"assignee_id": string | null,
"completed_at": string | null,
"created_at": string,
"creator_id": string,
"department_id": string,
"description": string,
"due_date": string | null,
"id": string,
"manager_id": string,
"priority": Database["public"]['Enums']["task_priority"],
"start_date": string | null,
"status": Database["public"]['Enums']["task_status"],
"term_id": string,
"title": string,
"updated_at": string,
"visibility_mode": Database["public"]['Enums']["visibility_mode"]
            }
                          SetofOptions: {
        from: "*"
        to: "tasks"
        isOneToOne: true
        isSetofReturn: false
      } },
"update_approved_account":
{ Args: { "p_account_id": string,"p_department_id"?: string,"p_position_id"?: string,"p_role": Database["public"]['Enums']["member_role"] }; Returns: {
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
      } },
"update_task":
{ Args: { "p_assignee_id": string,"p_due_date": string,"p_priority": Database["public"]['Enums']["task_priority"],"p_start_date": string,"p_task_id": string,"p_title": string }; Returns: {
              "archived_at": string | null,
"archived_by": string | null,
"assignee_id": string | null,
"completed_at": string | null,
"created_at": string,
"creator_id": string,
"department_id": string,
"description": string,
"due_date": string | null,
"id": string,
"manager_id": string,
"priority": Database["public"]['Enums']["task_priority"],
"start_date": string | null,
"status": Database["public"]['Enums']["task_status"],
"term_id": string,
"title": string,
"updated_at": string,
"visibility_mode": Database["public"]['Enums']["visibility_mode"]
            }
                          SetofOptions: {
        from: "*"
        to: "tasks"
        isOneToOne: true
        isSetofReturn: false
      } },
"update_task_description":
{ Args: { "p_description": string,"p_task_id": string }; Returns: {
              "archived_at": string | null,
"archived_by": string | null,
"assignee_id": string | null,
"completed_at": string | null,
"created_at": string,
"creator_id": string,
"department_id": string,
"description": string,
"due_date": string | null,
"id": string,
"manager_id": string,
"priority": Database["public"]['Enums']["task_priority"],
"start_date": string | null,
"status": Database["public"]['Enums']["task_status"],
"term_id": string,
"title": string,
"updated_at": string,
"visibility_mode": Database["public"]['Enums']["visibility_mode"]
            }
                          SetofOptions: {
        from: "*"
        to: "tasks"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "acl_role_group": "ALL_COUNCIL"|"DIRECTORS"|"EXECUTIVES","acl_subject_type": "DEPARTMENT"|"USER"|"ROLE_GROUP","member_role": "MEMBER"|"DIRECTOR"|"EXECUTIVE","task_priority": "LOW"|"NORMAL"|"HIGH","task_status": "TODO"|"IN_PROGRESS"|"REVIEW"|"DONE","term_status": "DRAFT"|"ACTIVE"|"CLOSED","visibility_mode": "DEFAULT"|"RESTRICTED"
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
            "acl_role_group": ["ALL_COUNCIL", "DIRECTORS", "EXECUTIVES"],"acl_subject_type": ["DEPARTMENT", "USER", "ROLE_GROUP"],"member_role": ["MEMBER", "DIRECTOR", "EXECUTIVE"],"task_priority": ["LOW", "NORMAL", "HIGH"],"task_status": ["TODO", "IN_PROGRESS", "REVIEW", "DONE"],"term_status": ["DRAFT", "ACTIVE", "CLOSED"],"visibility_mode": ["DEFAULT", "RESTRICTED"]
          }
        }
} as const

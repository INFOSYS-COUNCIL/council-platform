
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
                },"dashboard_links": {
                  Row: {
                    "created_at": string,"description": string,"icon_key": string | null,"id": string,"is_active": boolean,"name": string,"sort_order": number,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string,"icon_key"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"sort_order"?: number,"url": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"icon_key"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number,"url"?: string
                  }
                  Relationships: [
                    
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
                },"event_access_rules": {
                  Row: {
                    "created_at": string,"department_id": string | null,"event_id": string,"granted_by": string,"id": string,"role_group": Database["public"]['Enums']["acl_role_group"] | null,"subject_type": Database["public"]['Enums']["acl_subject_type"],"term_id": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"department_id"?: string | null,"event_id": string,"granted_by": string,"id"?: string,"role_group"?: Database["public"]['Enums']["acl_role_group"] | null,"subject_type": Database["public"]['Enums']["acl_subject_type"],"term_id": string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"department_id"?: string | null,"event_id"?: string,"granted_by"?: string,"id"?: string,"role_group"?: Database["public"]['Enums']["acl_role_group"] | null,"subject_type"?: Database["public"]['Enums']["acl_subject_type"],"term_id"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_access_department_same_term"
      columns: ["term_id","department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["term_id","id"]
    },{
      foreignKeyName: "event_access_event_same_term"
      columns: ["term_id","event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["term_id","id"]
    },{
      foreignKeyName: "event_access_rules_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_access_rules_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_resources": {
                  Row: {
                    "created_at": string,"description": string,"event_id": string,"external_url": string | null,"id": string,"resource_type": Database["public"]['Enums']["event_resource_type"],"size_bytes": number | null,"storage_path": string | null,"term_id": string,"title": string,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string,"event_id": string,"external_url"?: string | null,"id"?: string,"resource_type": Database["public"]['Enums']["event_resource_type"],"size_bytes"?: number | null,"storage_path"?: string | null,"term_id": string,"title": string,"uploaded_by": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"event_id"?: string,"external_url"?: string | null,"id"?: string,"resource_type"?: Database["public"]['Enums']["event_resource_type"],"size_bytes"?: number | null,"storage_path"?: string | null,"term_id"?: string,"title"?: string,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_resources_event_same_term"
      columns: ["term_id","event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["term_id","id"]
    },{
      foreignKeyName: "event_resources_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "created_at": string,"created_by": string,"description": string,"ends_at": string | null,"id": string,"manager_id": string,"name": string,"owner_department_id": string,"starts_at": string | null,"status": Database["public"]['Enums']["event_status"],"term_id": string,"updated_at": string,"visibility_mode": Database["public"]['Enums']["event_visibility"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"description"?: string,"ends_at"?: string | null,"id"?: string,"manager_id": string,"name": string,"owner_department_id": string,"starts_at"?: string | null,"status"?: Database["public"]['Enums']["event_status"],"term_id": string,"updated_at"?: string,"visibility_mode"?: Database["public"]['Enums']["event_visibility"]
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"description"?: string,"ends_at"?: string | null,"id"?: string,"manager_id"?: string,"name"?: string,"owner_department_id"?: string,"starts_at"?: string | null,"status"?: Database["public"]['Enums']["event_status"],"term_id"?: string,"updated_at"?: string,"visibility_mode"?: Database["public"]['Enums']["event_visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_department_same_term"
      columns: ["term_id","owner_department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["term_id","id"]
    },{
      foreignKeyName: "events_manager_id_fkey"
      columns: ["manager_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_term_id_fkey"
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
                },"schedules": {
                  Row: {
                    "created_at": string,"created_by": string,"description": string,"end_date": string | null,"ends_at": string | null,"event_id": string | null,"id": string,"is_all_day": boolean,"location": string,"start_date": string | null,"starts_at": string | null,"term_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"description"?: string,"end_date"?: string | null,"ends_at"?: string | null,"event_id"?: string | null,"id"?: string,"is_all_day": boolean,"location"?: string,"start_date"?: string | null,"starts_at"?: string | null,"term_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"description"?: string,"end_date"?: string | null,"ends_at"?: string | null,"event_id"?: string | null,"id"?: string,"is_all_day"?: boolean,"location"?: string,"start_date"?: string | null,"starts_at"?: string | null,"term_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "schedules_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "schedules_event_same_term"
      columns: ["term_id","event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["term_id","id"]
    },{
      foreignKeyName: "schedules_term_id_fkey"
      columns: ["term_id"]
isOneToOne: false
      referencedRelation: "terms"
      referencedColumns: ["id"]
    }
                  ]
                },"suggestion_authors": {
                  Row: {
                    "author_user_id": string,"request_id": string,"suggestion_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_user_id": string,"request_id": string,"suggestion_id": string
                  }
                  Update: {
                    "author_user_id"?: string,"request_id"?: string,"suggestion_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "suggestion_authors_author_user_id_fkey"
      columns: ["author_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "suggestion_authors_suggestion_id_fkey"
      columns: ["suggestion_id"]
isOneToOne: true
      referencedRelation: "suggestions"
      referencedColumns: ["id"]
    }
                  ]
                },"suggestion_messages": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"message_type": Database["public"]['Enums']["suggestion_message_type"],"suggestion_id": string,"writer_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"message_type": Database["public"]['Enums']["suggestion_message_type"],"suggestion_id": string,"writer_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"message_type"?: Database["public"]['Enums']["suggestion_message_type"],"suggestion_id"?: string,"writer_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "suggestion_messages_suggestion_id_fkey"
      columns: ["suggestion_id"]
isOneToOne: false
      referencedRelation: "suggestions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "suggestion_messages_writer_id_fkey"
      columns: ["writer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"suggestions": {
                  Row: {
                    "assigned_department_id": string | null,"assigned_user_id": string | null,"content": string,"created_at": string,"id": string,"resolved_at": string | null,"status": Database["public"]['Enums']["suggestion_status"],"term_id": string,"title": string,"updated_at": string,"withdrawn_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_department_id"?: string | null,"assigned_user_id"?: string | null,"content": string,"created_at"?: string,"id"?: string,"resolved_at"?: string | null,"status"?: Database["public"]['Enums']["suggestion_status"],"term_id": string,"title": string,"updated_at"?: string,"withdrawn_at"?: string | null
                  }
                  Update: {
                    "assigned_department_id"?: string | null,"assigned_user_id"?: string | null,"content"?: string,"created_at"?: string,"id"?: string,"resolved_at"?: string | null,"status"?: Database["public"]['Enums']["suggestion_status"],"term_id"?: string,"title"?: string,"updated_at"?: string,"withdrawn_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "suggestions_assigned_user_id_fkey"
      columns: ["assigned_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "suggestions_department_same_term"
      columns: ["term_id","assigned_department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["term_id","id"]
    },{
      foreignKeyName: "suggestions_term_id_fkey"
      columns: ["term_id"]
isOneToOne: false
      referencedRelation: "terms"
      referencedColumns: ["id"]
    }
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
"add_event_access_rule":
{ Args: { "p_department_id"?: string,"p_event_id": string,"p_role_group"?: Database["public"]['Enums']["acl_role_group"],"p_subject_type": Database["public"]['Enums']["acl_subject_type"],"p_user_id"?: string }; Returns: {
              "created_at": string,
"department_id": string | null,
"event_id": string,
"granted_by": string,
"id": string,
"role_group": Database["public"]['Enums']["acl_role_group"] | null,
"subject_type": Database["public"]['Enums']["acl_subject_type"],
"term_id": string,
"user_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "event_access_rules"
        isOneToOne: true
        isSetofReturn: false
      } },
"add_event_link":
{ Args: { "p_description"?: string,"p_event_id": string,"p_title": string,"p_url": string }; Returns: {
              "created_at": string,
"description": string,
"event_id": string,
"external_url": string | null,
"id": string,
"resource_type": Database["public"]['Enums']["event_resource_type"],
"size_bytes": number | null,
"storage_path": string | null,
"term_id": string,
"title": string,
"uploaded_by": string
            }
                          SetofOptions: {
        from: "*"
        to: "event_resources"
        isOneToOne: true
        isSetofReturn: false
      } },
"add_suggestion_message":
{ Args: { "p_body": string,"p_suggestion_id": string,"p_type": Database["public"]['Enums']["suggestion_message_type"] }; Returns: {
              "body": string,
"created_at": string,
"id": string,
"message_type": Database["public"]['Enums']["suggestion_message_type"],
"suggestion_id": string,
"writer_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "suggestion_messages"
        isOneToOne: true
        isSetofReturn: false
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
"assign_suggestion":
{ Args: { "p_department_id": string,"p_suggestion_id": string,"p_user_id": string }; Returns: undefined
                           },
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
"change_event_status":
{ Args: { "p_event_id": string,"p_status": Database["public"]['Enums']["event_status"] }; Returns: {
              "created_at": string,
"created_by": string,
"description": string,
"ends_at": string | null,
"id": string,
"manager_id": string,
"name": string,
"owner_department_id": string,
"starts_at": string | null,
"status": Database["public"]['Enums']["event_status"],
"term_id": string,
"updated_at": string,
"visibility_mode": Database["public"]['Enums']["event_visibility"]
            }
                          SetofOptions: {
        from: "*"
        to: "events"
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
"change_suggestion_status":
{ Args: { "p_status": Database["public"]['Enums']["suggestion_status"],"p_suggestion_id": string }; Returns: undefined
                           },
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
"create_dashboard_link":
{ Args: { "p_description"?: string,"p_name": string,"p_sort_order"?: number,"p_url": string }; Returns: {
              "created_at": string,
"description": string,
"icon_key": string | null,
"id": string,
"is_active": boolean,
"name": string,
"sort_order": number,
"url": string
            }
                          SetofOptions: {
        from: "*"
        to: "dashboard_links"
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
"create_event":
{ Args: { "p_description"?: string,"p_ends_at"?: string,"p_name": string,"p_owner_department_id": string,"p_starts_at"?: string,"p_term_id": string,"p_visibility_mode"?: Database["public"]['Enums']["event_visibility"] }; Returns: {
              "created_at": string,
"created_by": string,
"description": string,
"ends_at": string | null,
"id": string,
"manager_id": string,
"name": string,
"owner_department_id": string,
"starts_at": string | null,
"status": Database["public"]['Enums']["event_status"],
"term_id": string,
"updated_at": string,
"visibility_mode": Database["public"]['Enums']["event_visibility"]
            }
                          SetofOptions: {
        from: "*"
        to: "events"
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
"create_schedule":
{ Args: { "p_description"?: string,"p_end_date": string,"p_ends_at": string,"p_event_id": string,"p_is_all_day": boolean,"p_location"?: string,"p_start_date": string,"p_starts_at": string,"p_term_id": string,"p_title": string }; Returns: {
              "created_at": string,
"created_by": string,
"description": string,
"end_date": string | null,
"ends_at": string | null,
"event_id": string | null,
"id": string,
"is_all_day": boolean,
"location": string,
"start_date": string | null,
"starts_at": string | null,
"term_id": string,
"title": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "schedules"
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
"delete_dashboard_link":
{ Args: { "p_link_id": string }; Returns: undefined
                           },
"delete_event_resource":
{ Args: { "p_resource_id": string }; Returns: string
                           },
"delete_schedule":
{ Args: { "p_schedule_id": string }; Returns: undefined
                           },
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
"register_event_upload":
{ Args: { "p_description"?: string,"p_event_id": string,"p_storage_path": string,"p_title": string }; Returns: {
              "created_at": string,
"description": string,
"event_id": string,
"external_url": string | null,
"id": string,
"resource_type": Database["public"]['Enums']["event_resource_type"],
"size_bytes": number | null,
"storage_path": string | null,
"term_id": string,
"title": string,
"uploaded_by": string
            }
                          SetofOptions: {
        from: "*"
        to: "event_resources"
        isOneToOne: true
        isSetofReturn: false
      } },
"remove_event_access_rule":
{ Args: { "p_rule_id": string }; Returns: undefined
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
"set_dashboard_link_active":
{ Args: { "p_active": boolean,"p_link_id": string }; Returns: undefined
                           },
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
"set_event_visibility":
{ Args: { "p_event_id": string,"p_mode": Database["public"]['Enums']["event_visibility"] }; Returns: {
              "created_at": string,
"created_by": string,
"description": string,
"ends_at": string | null,
"id": string,
"manager_id": string,
"name": string,
"owner_department_id": string,
"starts_at": string | null,
"status": Database["public"]['Enums']["event_status"],
"term_id": string,
"updated_at": string,
"visibility_mode": Database["public"]['Enums']["event_visibility"]
            }
                          SetofOptions: {
        from: "*"
        to: "events"
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
"submit_suggestion":
{ Args: { "p_content": string,"p_request_id": string,"p_title": string }; Returns: string
                           },
"suggestion_author_identity":
{ Args: { "p_suggestion_id": string }; Returns: {
              "display_name": string,"email": string
            }[]
                           },
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
"update_event":
{ Args: { "p_description": string,"p_ends_at": string,"p_event_id": string,"p_manager_id": string,"p_name": string,"p_starts_at": string }; Returns: {
              "created_at": string,
"created_by": string,
"description": string,
"ends_at": string | null,
"id": string,
"manager_id": string,
"name": string,
"owner_department_id": string,
"starts_at": string | null,
"status": Database["public"]['Enums']["event_status"],
"term_id": string,
"updated_at": string,
"visibility_mode": Database["public"]['Enums']["event_visibility"]
            }
                          SetofOptions: {
        from: "*"
        to: "events"
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
      } },
"withdraw_suggestion":
{ Args: { "p_suggestion_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "acl_role_group": "ALL_COUNCIL"|"DIRECTORS"|"EXECUTIVES","acl_subject_type": "DEPARTMENT"|"USER"|"ROLE_GROUP","event_resource_type": "UPLOAD"|"EXTERNAL_LINK","event_status": "PLANNING"|"ACTIVE"|"COMPLETED"|"ARCHIVED","event_visibility": "ALL_COUNCIL"|"RESTRICTED","member_role": "MEMBER"|"DIRECTOR"|"EXECUTIVE","suggestion_message_type": "AUTHOR_VISIBLE"|"INTERNAL","suggestion_status": "RECEIVED"|"IN_REVIEW"|"RESOLVED"|"CLOSED","task_priority": "LOW"|"NORMAL"|"HIGH","task_status": "TODO"|"IN_PROGRESS"|"REVIEW"|"DONE","term_status": "DRAFT"|"ACTIVE"|"CLOSED","visibility_mode": "DEFAULT"|"RESTRICTED"
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
            "acl_role_group": ["ALL_COUNCIL", "DIRECTORS", "EXECUTIVES"],"acl_subject_type": ["DEPARTMENT", "USER", "ROLE_GROUP"],"event_resource_type": ["UPLOAD", "EXTERNAL_LINK"],"event_status": ["PLANNING", "ACTIVE", "COMPLETED", "ARCHIVED"],"event_visibility": ["ALL_COUNCIL", "RESTRICTED"],"member_role": ["MEMBER", "DIRECTOR", "EXECUTIVE"],"suggestion_message_type": ["AUTHOR_VISIBLE", "INTERNAL"],"suggestion_status": ["RECEIVED", "IN_REVIEW", "RESOLVED", "CLOSED"],"task_priority": ["LOW", "NORMAL", "HIGH"],"task_status": ["TODO", "IN_PROGRESS", "REVIEW", "DONE"],"term_status": ["DRAFT", "ACTIVE", "CLOSED"],"visibility_mode": ["DEFAULT", "RESTRICTED"]
          }
        }
} as const

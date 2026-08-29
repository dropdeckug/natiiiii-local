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
  public: {
    Tables: {
      agent_run_steps: {
        Row: {
          args: Json
          ended_at: string | null
          id: string
          idx: number
          result_excerpt: string | null
          run_id: string
          started_at: string
          status: string
          tool: string
          user_id: string
        }
        Insert: {
          args?: Json
          ended_at?: string | null
          id?: string
          idx: number
          result_excerpt?: string | null
          run_id: string
          started_at?: string
          status?: string
          tool: string
          user_id: string
        }
        Update: {
          args?: Json
          ended_at?: string | null
          id?: string
          idx?: number
          result_excerpt?: string | null
          run_id?: string
          started_at?: string
          status?: string
          tool?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_run_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          project_id: string
          prompt: string
          started_at: string
          status: string
          step_count: number
          summary: string | null
          trigger: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          project_id: string
          prompt: string
          started_at?: string
          status?: string
          step_count?: number
          summary?: string | null
          trigger?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          project_id?: string
          prompt?: string
          started_at?: string
          status?: string
          step_count?: number
          summary?: string | null
          trigger?: string
          user_id?: string
        }
        Relationships: []
      }
      appearance_configs: {
        Row: {
          created_at: string
          default_theme: string
          edge_to_edge_enabled: boolean
          edge_to_edge_nav_color: string
          icon_background_color: string
          icon_corner_radius_pct: number
          icon_foreground_path: string | null
          icon_letter_fallback: string | null
          icon_padding_pct: number
          id: string
          project_id: string
          splash_bg_color: string
          splash_bg_color_dark: string
          splash_duration_ms: number
          splash_image_path: string | null
          splash_resize_mode: string
          staged: boolean
          status_bar_color: string
          status_bar_color_dark: string
          status_bar_style: string
          status_bar_visible: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_theme?: string
          edge_to_edge_enabled?: boolean
          edge_to_edge_nav_color?: string
          icon_background_color?: string
          icon_corner_radius_pct?: number
          icon_foreground_path?: string | null
          icon_letter_fallback?: string | null
          icon_padding_pct?: number
          id?: string
          project_id: string
          splash_bg_color?: string
          splash_bg_color_dark?: string
          splash_duration_ms?: number
          splash_image_path?: string | null
          splash_resize_mode?: string
          staged?: boolean
          status_bar_color?: string
          status_bar_color_dark?: string
          status_bar_style?: string
          status_bar_visible?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_theme?: string
          edge_to_edge_enabled?: boolean
          edge_to_edge_nav_color?: string
          icon_background_color?: string
          icon_corner_radius_pct?: number
          icon_foreground_path?: string | null
          icon_letter_fallback?: string | null
          icon_padding_pct?: number
          id?: string
          project_id?: string
          splash_bg_color?: string
          splash_bg_color_dark?: string
          splash_duration_ms?: number
          splash_image_path?: string | null
          splash_resize_mode?: string
          staged?: boolean
          status_bar_color?: string
          status_bar_color_dark?: string
          status_bar_style?: string
          status_bar_visible?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      build_events: {
        Row: {
          build_id: string | null
          created_at: string
          id: string
          message: string | null
          meta: Json
          phase: string
          project_id: string | null
          status: string
          step: string
          user_id: string
        }
        Insert: {
          build_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          meta?: Json
          phase: string
          project_id?: string | null
          status?: string
          step: string
          user_id: string
        }
        Update: {
          build_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          meta?: Json
          phase?: string
          project_id?: string | null
          status?: string
          step?: string
          user_id?: string
        }
        Relationships: []
      }
      build_logs: {
        Row: {
          build_id: string | null
          conclusion: string | null
          created_at: string
          event_message: string
          id: string
          job_name: string | null
          level: string
          log_type: string
          meta: Json
          phase: string | null
          platform: string
          project_id: string | null
          raw_excerpt: string | null
          run_id: number | null
          status_code: number | null
          step_name: string | null
          ts: string
          user_id: string
        }
        Insert: {
          build_id?: string | null
          conclusion?: string | null
          created_at?: string
          event_message: string
          id?: string
          job_name?: string | null
          level?: string
          log_type?: string
          meta?: Json
          phase?: string | null
          platform?: string
          project_id?: string | null
          raw_excerpt?: string | null
          run_id?: number | null
          status_code?: number | null
          step_name?: string | null
          ts?: string
          user_id: string
        }
        Update: {
          build_id?: string | null
          conclusion?: string | null
          created_at?: string
          event_message?: string
          id?: string
          job_name?: string | null
          level?: string
          log_type?: string
          meta?: Json
          phase?: string | null
          platform?: string
          project_id?: string | null
          raw_excerpt?: string | null
          run_id?: number | null
          status_code?: number | null
          step_name?: string | null
          ts?: string
          user_id?: string
        }
        Relationships: []
      }
      build_runs: {
        Row: {
          commit_sha: string | null
          diagnostic: string | null
          ended_at: string | null
          id: string
          model: string | null
          phase: string
          project_id: string
          repo_name: string | null
          run_id: number | null
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          commit_sha?: string | null
          diagnostic?: string | null
          ended_at?: string | null
          id?: string
          model?: string | null
          phase?: string
          project_id: string
          repo_name?: string | null
          run_id?: number | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          commit_sha?: string | null
          diagnostic?: string | null
          ended_at?: string | null
          id?: string
          model?: string | null
          phase?: string
          project_id?: string
          repo_name?: string | null
          run_id?: number | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      builds: {
        Row: {
          aab_url: string | null
          apk_url: string | null
          app_name: string
          build_metadata: Json | null
          completed_at: string | null
          created_at: string
          engine: string
          error: string | null
          error_info: Json | null
          id: string
          logs: Json
          package_name: string
          project_id: string | null
          qa_report: Json | null
          repo_name: string | null
          repo_url: string | null
          source_repo_name: string | null
          stage: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          aab_url?: string | null
          apk_url?: string | null
          app_name: string
          build_metadata?: Json | null
          completed_at?: string | null
          created_at?: string
          engine: string
          error?: string | null
          error_info?: Json | null
          id?: string
          logs?: Json
          package_name: string
          project_id?: string | null
          qa_report?: Json | null
          repo_name?: string | null
          repo_url?: string | null
          source_repo_name?: string | null
          stage?: string
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          aab_url?: string | null
          apk_url?: string | null
          app_name?: string
          build_metadata?: Json | null
          completed_at?: string | null
          created_at?: string
          engine?: string
          error?: string | null
          error_info?: Json | null
          id?: string
          logs?: Json
          package_name?: string
          project_id?: string | null
          qa_report?: Json | null
          repo_name?: string | null
          repo_url?: string | null
          source_repo_name?: string | null
          stage?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "builds_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          project_id: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      keystores: {
        Row: {
          created_at: string | null
          id: string
          imported: boolean
          is_active: boolean | null
          key_alias: string
          key_password_encrypted: string | null
          keystore_path: string | null
          md5: string | null
          project_id: string | null
          sha1: string | null
          sha256: string | null
          signing_mode: string | null
          store_password_encrypted: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          imported?: boolean
          is_active?: boolean | null
          key_alias: string
          key_password_encrypted?: string | null
          keystore_path?: string | null
          md5?: string | null
          project_id?: string | null
          sha1?: string | null
          sha256?: string | null
          signing_mode?: string | null
          store_password_encrypted?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          imported?: boolean
          is_active?: boolean | null
          key_alias?: string
          key_password_encrypted?: string | null
          keystore_path?: string | null
          md5?: string | null
          project_id?: string | null
          sha1?: string | null
          sha256?: string | null
          signing_mode?: string | null
          store_password_encrypted?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "keystores_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      plugin_secrets: {
        Row: {
          created_at: string
          file_path: string | null
          id: string
          plugin_id: string
          project_id: string
          secret_key: string
          secret_value: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_path?: string | null
          id?: string
          plugin_id: string
          project_id: string
          secret_key: string
          secret_value?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_path?: string | null
          id?: string
          plugin_id?: string
          project_id?: string
          secret_key?: string
          secret_value?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plugin_secrets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      project_apps: {
        Row: {
          access_token_hash: string | null
          app_id_slug: string
          build_output_dir: string | null
          config: Json
          created_at: string
          display_name: string | null
          engine: string | null
          id: string
          last_build_id: string | null
          min_sdk: number | null
          nickname: string
          package_id: string | null
          package_name: string | null
          platform: string
          project_id: string
          render_screenshot_url: string | null
          render_verified: boolean | null
          signing_sha1: string | null
          signing_sha256: string | null
          status: string | null
          target_sdk: number | null
          updated_at: string
          user_id: string
          version_code: number | null
          version_name: string | null
          webdir: string | null
        }
        Insert: {
          access_token_hash?: string | null
          app_id_slug: string
          build_output_dir?: string | null
          config?: Json
          created_at?: string
          display_name?: string | null
          engine?: string | null
          id?: string
          last_build_id?: string | null
          min_sdk?: number | null
          nickname: string
          package_id?: string | null
          package_name?: string | null
          platform: string
          project_id: string
          render_screenshot_url?: string | null
          render_verified?: boolean | null
          signing_sha1?: string | null
          signing_sha256?: string | null
          status?: string | null
          target_sdk?: number | null
          updated_at?: string
          user_id: string
          version_code?: number | null
          version_name?: string | null
          webdir?: string | null
        }
        Update: {
          access_token_hash?: string | null
          app_id_slug?: string
          build_output_dir?: string | null
          config?: Json
          created_at?: string
          display_name?: string | null
          engine?: string | null
          id?: string
          last_build_id?: string | null
          min_sdk?: number | null
          nickname?: string
          package_id?: string | null
          package_name?: string | null
          platform?: string
          project_id?: string
          render_screenshot_url?: string | null
          render_verified?: boolean | null
          signing_sha1?: string | null
          signing_sha256?: string | null
          status?: string | null
          target_sdk?: number | null
          updated_at?: string
          user_id?: string
          version_code?: number | null
          version_name?: string | null
          webdir?: string | null
        }
        Relationships: []
      }
      project_configs: {
        Row: {
          auth_providers: Json
          created_at: string
          database_url: string | null
          env_vars: Json
          project_id: string
          storage_bucket: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_providers?: Json
          created_at?: string
          database_url?: string | null
          env_vars?: Json
          project_id: string
          storage_bucket?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_providers?: Json
          created_at?: string
          database_url?: string | null
          env_vars?: Json
          project_id?: string
          storage_bucket?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_cpr: {
        Row: {
          app_root: string
          blocking: boolean
          blueprint: Json
          build_command: string | null
          build_tool: string | null
          build_tool_label: string | null
          canonical_checksum: string | null
          canonical_package_json: Json | null
          canonical_path: string | null
          capacitor_major: number
          compatibility: string
          cpr_version: number
          created_at: string
          dependency_audit: Json | null
          finished_at: string | null
          framework: string | null
          framework_label: string | null
          id: string
          install_command: string | null
          node_version: string
          original_package_json: Json | null
          output_candidates: Json
          output_confidence: string
          output_dir: string | null
          package_manager: string
          project_id: string
          quick_scan: Json | null
          report: Json | null
          started_at: string
          status: string
          transform_summary: Json | null
          updated_at: string
          user_id: string
          verify_result: Json | null
        }
        Insert: {
          app_root?: string
          blocking?: boolean
          blueprint?: Json
          build_command?: string | null
          build_tool?: string | null
          build_tool_label?: string | null
          canonical_checksum?: string | null
          canonical_package_json?: Json | null
          canonical_path?: string | null
          capacitor_major?: number
          compatibility?: string
          cpr_version?: number
          created_at?: string
          dependency_audit?: Json | null
          finished_at?: string | null
          framework?: string | null
          framework_label?: string | null
          id?: string
          install_command?: string | null
          node_version?: string
          original_package_json?: Json | null
          output_candidates?: Json
          output_confidence?: string
          output_dir?: string | null
          package_manager?: string
          project_id: string
          quick_scan?: Json | null
          report?: Json | null
          started_at?: string
          status?: string
          transform_summary?: Json | null
          updated_at?: string
          user_id: string
          verify_result?: Json | null
        }
        Update: {
          app_root?: string
          blocking?: boolean
          blueprint?: Json
          build_command?: string | null
          build_tool?: string | null
          build_tool_label?: string | null
          canonical_checksum?: string | null
          canonical_package_json?: Json | null
          canonical_path?: string | null
          capacitor_major?: number
          compatibility?: string
          cpr_version?: number
          created_at?: string
          dependency_audit?: Json | null
          finished_at?: string | null
          framework?: string | null
          framework_label?: string | null
          id?: string
          install_command?: string | null
          node_version?: string
          original_package_json?: Json | null
          output_candidates?: Json
          output_confidence?: string
          output_dir?: string | null
          package_manager?: string
          project_id?: string
          quick_scan?: Json | null
          report?: Json | null
          started_at?: string
          status?: string
          transform_summary?: Json | null
          updated_at?: string
          user_id?: string
          verify_result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "project_cpr_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_index: {
        Row: {
          ai_hints: Json
          build_command: string | null
          build_tool: string | null
          build_tool_label: string | null
          created_at: string
          dependencies: Json
          dev_dependencies: Json
          entry_html: string | null
          framework: string | null
          has_build_script: boolean | null
          has_localhost_calls: boolean | null
          has_package_json: boolean | null
          id: string
          indexed_at: string
          localhost_files: Json
          node_version: string | null
          normalization: Json
          output_dir: string | null
          output_dir_source: string | null
          package_manager: string | null
          project_id: string
          project_root: string | null
          remediations: Json
          render_checked_at: string | null
          render_screenshot_url: string | null
          render_verified: boolean | null
          router_mode: string | null
          shape: string
          static_blockers: Json
          static_capable: boolean
          updated_at: string
          user_id: string
          warnings: Json
        }
        Insert: {
          ai_hints?: Json
          build_command?: string | null
          build_tool?: string | null
          build_tool_label?: string | null
          created_at?: string
          dependencies?: Json
          dev_dependencies?: Json
          entry_html?: string | null
          framework?: string | null
          has_build_script?: boolean | null
          has_localhost_calls?: boolean | null
          has_package_json?: boolean | null
          id?: string
          indexed_at?: string
          localhost_files?: Json
          node_version?: string | null
          normalization?: Json
          output_dir?: string | null
          output_dir_source?: string | null
          package_manager?: string | null
          project_id: string
          project_root?: string | null
          remediations?: Json
          render_checked_at?: string | null
          render_screenshot_url?: string | null
          render_verified?: boolean | null
          router_mode?: string | null
          shape?: string
          static_blockers?: Json
          static_capable?: boolean
          updated_at?: string
          user_id: string
          warnings?: Json
        }
        Update: {
          ai_hints?: Json
          build_command?: string | null
          build_tool?: string | null
          build_tool_label?: string | null
          created_at?: string
          dependencies?: Json
          dev_dependencies?: Json
          entry_html?: string | null
          framework?: string | null
          has_build_script?: boolean | null
          has_localhost_calls?: boolean | null
          has_package_json?: boolean | null
          id?: string
          indexed_at?: string
          localhost_files?: Json
          node_version?: string | null
          normalization?: Json
          output_dir?: string | null
          output_dir_source?: string | null
          package_manager?: string | null
          project_id?: string
          project_root?: string | null
          remediations?: Json
          render_checked_at?: string | null
          render_screenshot_url?: string | null
          render_verified?: boolean | null
          router_mode?: string | null
          shape?: string
          static_blockers?: Json
          static_capable?: boolean
          updated_at?: string
          user_id?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "project_index_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_plugins: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          npm_package: string | null
          plugin_id: string
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          npm_package?: string | null
          plugin_id: string
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          npm_package?: string | null
          plugin_id?: string
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_plugins_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_render_checks: {
        Row: {
          app_id: string | null
          build_id: string | null
          created_at: string
          id: string
          notes: string | null
          passed: boolean
          project_id: string
          screenshot_url: string | null
          user_id: string
        }
        Insert: {
          app_id?: string | null
          build_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          passed?: boolean
          project_id: string
          screenshot_url?: string | null
          user_id: string
        }
        Update: {
          app_id?: string | null
          build_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          passed?: boolean
          project_id?: string
          screenshot_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_render_checks_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "project_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_render_checks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_snapshots: {
        Row: {
          config_state: Json
          created_at: string
          file_count: number
          file_hash: string
          id: string
          plugin_state: Json
          project_id: string
          project_shape: string | null
          project_state: Json
          render_verified: boolean | null
          screenshot_url: string | null
          size_kb: number
          storage_path: string
          user_id: string
        }
        Insert: {
          config_state?: Json
          created_at?: string
          file_count?: number
          file_hash: string
          id?: string
          plugin_state?: Json
          project_id: string
          project_shape?: string | null
          project_state?: Json
          render_verified?: boolean | null
          screenshot_url?: string | null
          size_kb?: number
          storage_path: string
          user_id: string
        }
        Update: {
          config_state?: Json
          created_at?: string
          file_count?: number
          file_hash?: string
          id?: string
          plugin_state?: Json
          project_id?: string
          project_shape?: string | null
          project_state?: Json
          render_verified?: boolean | null
          screenshot_url?: string | null
          size_kb?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_sources: {
        Row: {
          always_pull: boolean
          app_root: string | null
          branch: string | null
          build_command: string | null
          build_command_override: string | null
          clone_depth: number | null
          created_at: string
          environment: string | null
          last_synced_at: string | null
          output_dir: string | null
          pat_encrypted: string | null
          project_id: string
          repo_url: string | null
          scan_result: Json | null
          source_type: string
          updated_at: string
          upload_file_path: string | null
          user_id: string
        }
        Insert: {
          always_pull?: boolean
          app_root?: string | null
          branch?: string | null
          build_command?: string | null
          build_command_override?: string | null
          clone_depth?: number | null
          created_at?: string
          environment?: string | null
          last_synced_at?: string | null
          output_dir?: string | null
          pat_encrypted?: string | null
          project_id: string
          repo_url?: string | null
          scan_result?: Json | null
          source_type: string
          updated_at?: string
          upload_file_path?: string | null
          user_id: string
        }
        Update: {
          always_pull?: boolean
          app_root?: string | null
          branch?: string | null
          build_command?: string | null
          build_command_override?: string | null
          clone_depth?: number | null
          created_at?: string
          environment?: string | null
          last_synced_at?: string | null
          output_dir?: string | null
          pat_encrypted?: string | null
          project_id?: string
          repo_url?: string | null
          scan_result?: Json | null
          source_type?: string
          updated_at?: string
          upload_file_path?: string | null
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          default_app_id: string | null
          description: string | null
          engine: string | null
          framework: string | null
          icon_url: string | null
          id: string
          keystore_id: string | null
          name: string
          plan: string | null
          platforms: Json | null
          preferred_ai_model: string | null
          project_id_slug: string | null
          secret_key_hash: string | null
          signing_fingerprint: string | null
          source_type: string | null
          source_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_app_id?: string | null
          description?: string | null
          engine?: string | null
          framework?: string | null
          icon_url?: string | null
          id?: string
          keystore_id?: string | null
          name: string
          plan?: string | null
          platforms?: Json | null
          preferred_ai_model?: string | null
          project_id_slug?: string | null
          secret_key_hash?: string | null
          signing_fingerprint?: string | null
          source_type?: string | null
          source_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_app_id?: string | null
          description?: string | null
          engine?: string | null
          framework?: string | null
          icon_url?: string | null
          id?: string
          keystore_id?: string | null
          name?: string
          plan?: string | null
          platforms?: Json | null
          preferred_ai_model?: string | null
          project_id_slug?: string | null
          secret_key_hash?: string | null
          signing_fingerprint?: string | null
          source_type?: string | null
          source_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      repair_knowledge: {
        Row: {
          created_at: string
          error_type: string
          failure_count: number
          file_pattern: string | null
          fix_pattern: Json
          hit_count: number
          id: string
          signature: string
          step_name: string | null
          subject: string | null
          success_count: number
          summary: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_type: string
          failure_count?: number
          file_pattern?: string | null
          fix_pattern?: Json
          hit_count?: number
          id?: string
          signature: string
          step_name?: string | null
          subject?: string | null
          success_count?: number
          summary?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_type?: string
          failure_count?: number
          file_pattern?: string | null
          fix_pattern?: Json
          hit_count?: number
          id?: string
          signature?: string
          step_name?: string | null
          subject?: string | null
          success_count?: number
          summary?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      repair_sessions: {
        Row: {
          attempts: number
          build_id: string | null
          created_at: string
          id: string
          original_error: string | null
          outcome: string
          patches: Json
          project_id: string | null
          run_id: string | null
          signature: string | null
          step_name: string
          transcript: Json
          updated_at: string
          user_id: string
          user_summary: string | null
        }
        Insert: {
          attempts?: number
          build_id?: string | null
          created_at?: string
          id?: string
          original_error?: string | null
          outcome?: string
          patches?: Json
          project_id?: string | null
          run_id?: string | null
          signature?: string | null
          step_name: string
          transcript?: Json
          updated_at?: string
          user_id: string
          user_summary?: string | null
        }
        Update: {
          attempts?: number
          build_id?: string | null
          created_at?: string
          id?: string
          original_error?: string | null
          outcome?: string
          patches?: Json
          project_id?: string | null
          run_id?: string | null
          signature?: string | null
          step_name?: string
          transcript?: Json
          updated_at?: string
          user_id?: string
          user_summary?: string | null
        }
        Relationships: []
      }
      user_ai_preferences: {
        Row: {
          agent_mode: string
          created_at: string
          default_model: string
          effort: string
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_mode?: string
          created_at?: string
          default_model?: string
          effort?: string
          provider?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_mode?: string
          created_at?: string
          default_model?: string
          effort?: string
          provider?: string
          updated_at?: string
          user_id?: string
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

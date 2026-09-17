# Admin Platform — build prompt for a new project

The admin panel becomes its own Lovable project with its own address and login, connected to this platform's existing Supabase database (project ref `noiioxcxpvfzsqdayjfq`). Nothing in this codebase changes.

## What I will do here

1. Add a migration to this project's database so the admin platform has something to authorise against: an `app_role` enum, a `user_roles` table (grants + RLS + `has_role()` security-definer function), and an `admin_audit_log` table. You get the first admin role.
2. Save the full build prompt below to `ADMIN_PLATFORM_PROMPT.md` so you can copy it into the new project in one go.

Everything else is built in the new project.

## The prompt to paste into the new Lovable project

---

Build **NativeForge Admin**, a standalone internal admin platform that manages another product (a mobile app build platform). It is read-and-act: operators inspect everything and take corrective action. Build the entire interface against realistic sample data first; keep every screen's data behind hooks so swapping to live data later is a one-line change per section.

**Backend**: connect to the existing Supabase project `noiioxcxpvfzsqdayjfq` rather than creating new tables. Access is gated by the `user_roles` table and the `has_role(auth.uid(), 'admin')` function that already exist there. Email/password login; anyone without the admin role sees a "no access" screen. Every destructive action writes a row to `admin_audit_log`.

**Shell**: dense operator console — left rail of sections, top bar with global search (users, projects, builds, app IDs), environment badge, and a Sample/Live data toggle. Dark-first, high information density, monospace for IDs and logs, semantic color tokens only. Not a marketing dashboard: think a control room.

**Sections**

- **Overview** — total users, projects, builds today, build success rate, average duration, failures needing attention, live activity feed, red alerts for stuck builds and failing repairs.
- **Users** — searchable table (name, email, joined, project count, build count, role). Detail drawer: profile, grant/revoke admin, their projects and recent builds, suspend or delete with confirmation.
- **Projects** — every project with owner, framework, engine, source type, app count, last build. Detail: source sync state, project index (framework, build command, output dir), CPR result, plugins, config, snapshots. Actions: re-index, delete.
- **Apps** — registered apps per project: package name, engine, version name/code, min/target SDK, signing fingerprints, render-verified state with screenshot preview.
- **Builds** — full history with filters by status, platform, project and date. Detail: stage timeline, event stream, error info, QA report, APK/AAB artifacts with download. Actions: retry, cancel, delete artifacts.
- **Logs** — combined build logs and build events, filtered by project, run, phase, step and level. Clickable JSON inspector with syntax highlighting and Overview/Raw tabs.
- **Repairs** — repair sessions with outcome, attempt count, original error, patches applied; plus the shared repair knowledge base with hit, success and failure counts. Action: re-run a repair.
- **AI** — agent runs and their individual steps (tool, arguments, result excerpt, duration), model mix, effort settings, per-user AI preferences, request volume over time, cost estimate.
- **Storage** — bucket usage, largest artifacts, orphaned files, keystores. Guarded cleanup action.
- **Health** — edge function status, integration and secret presence by name only (never values), recent runtime errors, database row counters.

**Tables to read from** (existing): `profiles`, `user_roles`, `projects`, `project_apps`, `project_configs`, `project_index`, `project_cpr`, `project_plugins`, `project_sources`, `project_snapshots`, `project_render_checks`, `builds`, `build_runs`, `build_events`, `build_logs`, `repair_sessions`, `repair_knowledge`, `agent_runs`, `agent_run_steps`, `user_ai_preferences`, `keystores`, `plugin_secrets`, `admin_audit_log`.

**Rules**: never display secret values, only names and presence. Every delete, retry, cancel or role change goes through a confirm dialog naming exactly what will happen. Sections lazy-load. Sample data lives in one module shaped exactly like the real tables.

---

## Technical notes

- Migration runs against this project's database: `app_role` enum (`admin`, `moderator`, `user`), `user_roles` with unique `(user_id, role)`, grants to `authenticated`/`service_role`, RLS enabled, `has_role()` as `SECURITY DEFINER STABLE` with `search_path = public`; `admin_audit_log` (actor, action, target type/id, details JSONB, timestamp) readable and writable only by admins.
- Roles are deliberately kept out of `profiles` to avoid privilege escalation.
- The new project uses the same Supabase connection; no service-role key ever reaches its frontend — privileged reads that RLS cannot express go through edge functions in the new project.

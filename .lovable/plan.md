# Admin Panel

A single admin area at `/admin` covering everything on the platform: users, projects, apps, builds, logs, AI usage, storage and system health. Built with realistic sample (fake) data first so the whole interface can be reviewed and refined, then switched over to live data.

## Access

- Admin rights are stored in a dedicated roles table (never on the profile), checked server-side.
- You are granted the first admin role; from inside the panel you can grant or revoke admin for anyone else.
- Non-admins visiting `/admin` are redirected away; the entry link only appears for admins.

## Layout

Left rail with sections, top bar with global search and a live/sample data toggle.

```text
Admin
├─ Overview        KPIs, build success rate, activity feed, alerts
├─ Users           list, detail drawer, roles, their projects & builds
├─ Projects        list, detail: source, index, CPR status, snapshots
├─ Apps            registered apps, package IDs, signing, render checks
├─ Builds          all runs, status, duration, artifacts, failures
├─ Logs            build logs + build events, filter by project/run/level
├─ Repairs         repair sessions, outcomes, knowledge base hits
├─ AI              model usage, agent runs and steps, preferences, cost
├─ Storage         buckets, artifact sizes, keystores, cleanup
└─ Health          edge functions, integrations, secrets presence, errors
```

## Sections in detail

**Overview** — total users, projects, builds today, success rate, failures needing attention, average build duration, recent activity stream, and any red alerts (stuck builds, failing repairs).

**Users** — searchable table (name, email, joined, projects, builds, role). Row opens a detail panel: profile, role toggle (grant/revoke admin), their projects and recent builds, and destructive actions behind a confirm dialog.

**Projects** — every project with owner, framework/engine, source type, app count, last build. Detail view shows source sync state, project index (framework, build command, output dir), CPR result, plugins, config and snapshots.

**Apps** — registered apps per project: package name, engine, version, SDK levels, signing fingerprints, render-verified state with screenshot.

**Builds** — full build history with filters (status, platform, project, date). Detail shows stages, timeline of events, error info, QA report, artifacts (APK/AAB) with download.

**Logs** — combined build logs and build events with level/phase/step filters, JSON inspector, and jump-to-run.

**Repairs** — repair sessions with outcome, attempts, original error, patches applied, and the shared repair knowledge entries with hit/success counts.

**AI** — agent runs and their steps, model mix, effort settings, per-user AI preferences, request volume over time.

**Storage** — bucket usage, largest artifacts, orphaned files, keystores, and a guarded cleanup action.

**Health** — edge function status, integration/secret presence (names only, never values), recent runtime errors, database counters.

## Actions admins can take

Retry or cancel a build, re-run a repair, re-index a project, delete a project or app, revoke/grant admin, delete artifacts, and clear stuck build runs. Every destructive action asks for confirmation and is recorded in an admin audit log.

## Fake data first

All sections read from a single mock data module shaped exactly like the real tables, so the switch to live queries is a per-section swap with no UI rework. A toggle in the top bar marks whether the panel is showing sample or live data.

## Technical notes

- New route `/admin` in `App.tsx` with an `AdminGuard` wrapper; nested section routes.
- Migration: `app_role` enum, `user_roles` table with grants, RLS and a `has_role()` security-definer function; `admin_audit_log` table. Policies use `has_role(auth.uid(), 'admin')`.
- Existing UI conventions reused: settings `primitives.tsx` (SettingsHeader, Tabs), `ChatTimeline`/`CopilotTimeline` for event streams, `LogsExplorer` JSON highlighting, semantic tokens only — no hardcoded colors.
- Mock layer in `src/lib/admin/mockData.ts` plus `src/lib/admin/adminQueries.ts` exposing hooks that return mock or Supabase data based on the toggle; pages only ever call the hooks.
- Sections are lazy-loaded like the existing dashboard panels.

## Build order

1. Roles migration + audit log, admin guard, `/admin` shell and navigation.
2. Mock data module covering all entities.
3. Sections against mock data: Overview, Users, Projects, Apps, Builds, Logs, Repairs, AI, Storage, Health.
4. Actions with confirm dialogs + audit logging.
5. Swap sections to live queries.

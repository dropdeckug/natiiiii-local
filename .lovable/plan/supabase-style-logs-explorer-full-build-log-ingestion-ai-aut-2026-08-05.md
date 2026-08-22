j# Supabase-style Logs Explorer + full build log ingestion + AI auto-repair

## 1. Logs UI â rebuild to match the screenshots

Replace the current Logs console and delete the "Build Logs / Error Logs" middle column entirely. The Logs section becomes one full-width explorer with its own internal, resizable panels.

Layout (top to bottom):

```text
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
â Logs [BETA]  [x Reset]  | search  Log Type = pipeline x  + Add more filters   [refresh][cols][download][â¶ Live] â
âââââââââââââ¬ââââââââââââââââââââââââââââââââââââââââââââââââââââ¤
â FILTER    â  time-bucket bar chart (clickable to zoom range)  â
â SIDEBAR   âââââââââââââââââââââââââââââââââââââââââââââââââââââ¤
â Time Rangeâ  DATE | STATUS | METHOD | PATHNAME | MESSAGE       â
â Log Type  â  row  row  row ... (virtualized, striped, hover)   â
â Level     â                                                   â
â Platform  ââââ resizable splitter âââââââââââââââââââââââââââââ¤
â Phase     â  RAW JSON detail pane (opens on row click)        â
â Status    â  syntax-highlighted, copy button, collapse/expand â
â Method    â                                                   â
â Pathname  â                                                   â
âââââââââââââ´ââââââââââââââââââââââââââââââââââââââââââââââââââââ
```

Details to match the reference:
- Collapsible filter groups with checkbox rows, per-option counts on the right, `Only` hover action, level colour chips (2xx grey, 4xx amber, 5xx red), a search box inside long groups (Log Type), and a scrollable inner list.
- Header: `Reset` pill, panel-collapse icon, search input, filter tokens (`Log Type = pipeline` with an x), `Add more filters...`, and right-side icon buttons: refresh, column picker, download (CSV/JSON), and a `Live` toggle.
- Time-range selector with presets (15m, 60m, 3h, 24h, 7d, custom) driving the histogram and query.
- Histogram strip of per-bucket counts with error segments in red; drag-select narrows the range.
- Row click opens the bottom detail pane with the full row as raw JSON plus a formatted summary (job, step, phase, status code, conclusion, run URL). Splitter is draggable, pane is closable/maximisable.
- Everything scoped to the current project; a project/engine/app selector limits rows further.
- Mobile: sidebar becomes a drawer, table scrolls horizontally.

## 2. Make logs actually arrive

Today nothing is written during a build. Wire every producer into `build_logs`.

- Fix the client log sink to call the existing `build-apk` `export-logs` action (it returns parsed GitHub Actions lines) and bulk-insert the returned rows, tagged with project, build, run, platform and phase.
- Emit events at every stage of the two-phase build runner: start, repo push, workflow dispatch, each polled status change, per-job/per-step results, artifact download, keystore/signing, `npx cap sync`, install, dependency resolution, cleanup, and failure.
- Import full GitHub Actions job logs on both success and failure (currently only partly wired), including step names and `##[group]` boundaries, so the pipeline log type shows exactly what ran.
- Add producers for the remaining log types: API gateway calls (edge function invokes with method, pathname, status code, latency), AI gateway/assistant calls, plugin wiring, webhooks, and MCP so the filter list is real rather than decorative.
- Backfill `platform`, `phase`, `run_id`, `job_name`, `step_name`, `status_code`, `conclusion`, `meta.runUrl` on every row so the filters and the detail pane have data.
- Live mode subscribes to realtime inserts for the project and prepends rows without a refresh; paused mode buffers and shows a "N new" pill.

## 3. AI auto-repair that actually resumes

- On any phase failure, pull the error-level rows for that run out of `build_logs` (not just the toast text) and feed them to the repair function as grounded context.
- Show the repair loop in the Action Panel: tracing â diagnosing â patching files â pushing â re-triggering, with the diff of what changed.
- After a successful patch, push the fix and resume from the failed phase rather than phase 1, re-running `npx cap sync` so the patch reaches the native shell. Fall back to a full rebuild only when the failure is in setup/dependency resolution where a partial resume is unsafe.
- Classify failures (code-level, dependency, platform/runner, credentials) and record the classification on the log row so the UI can show whether it is auto-fixable.

## 4. AI provider

Switch the assistant and repair paths to the Lovable AI Gateway as the primary provider and retire the Vercel AI gateway path (kept only as an inactive fallback).

## Technical notes

- No schema change is expected: `build_logs` already carries project/build/run/platform/phase/job/step/type/level/status/conclusion/message/raw/meta/ts. Realtime publication and an index on `(project_id, ts desc)` will be added if missing.
- New UI lives under `src/components/logs/` split into `LogsExplorer`, `LogsFilterSidebar`, `LogsHistogram`, `LogsTable`, `LogDetailPane`, `LogsToolbar`; the old `LogsConsole` and the logs entries in `SectionPanel` are removed.
- Resizing uses the existing `react-resizable-panels` setup; the table is virtualized so 10k+ rows stay smooth.
- All colours come from existing semantic tokens; no hardcoded palette.

## Order of work

1. Log ingestion (sink fix + runner instrumentation + CI import) â without this the UI has nothing to show.
2. Logs Explorer UI and removal of the old column.
3. Live mode + detail pane + download/column controls.
4. AI repair resume-from-phase and Action Panel tracing.
5. Lovable AI Gateway switch.



- The full-page creation screen displays AI-returned `outputDir` and `entryPoint` directly and hides either field when the AI omits it. These build-critical values are optional in the AI schema, so the UI can show a blank output even though the deterministic indexer has a default.
- ZIP analysis currently keeps the first `package.json` and first `index.html` encountered. It does not expose all viable application roots for a monorepo or ask the user when several entries are plausible.
- Separate scanners currently choose entries differently: one takes the first file named `index.html`, while the shared indexer scores package roots automatically. This can make the creation screen, saved metadata, and build workflow disagree.
- The current source indexer defines `www` for plain HTML and the build runner forwards its result to Phase 3. However, a recent saved project is classified as `capacitor` with `dist`, showing that the persisted classification can still differ from the intended plain-HTML selection.
- `create-project` intentionally returns non-2xx responses when source normalization fails, but the caller throws Supabaseâs generic invoke error without reading the functionâs JSON error body. Current logs do not contain the reported failure, so the exact failing normalization condition is not yet confirmed.

## Implementation plan

### 1. Make deterministic discovery authoritative

- Extend the shared project indexer to return a list of viable app candidates. Each candidate will include the project/app root, source entry HTML path, framework/package file, build command, resolved output directory, and a reason for the match.
- Discover nested `index.html` files and associate each with its nearest compatible package/config root instead of selecting the first ZIP entry.
- Ignore generated/native/vendor folders such as `node_modules`, `dist`, `build`, `www`, `android`, and `ios` when discovering source entries.
- Preserve the selected root through re-indexing, including after plain-HTML grounding adds Capacitor dependencies.
- Keep framework-aware output rules, with plain HTML always resolving to `www` and a materialized `www/index.html`.

### 2. Add entry-point choice during project creation

- Run deterministic discovery immediately after upload or GitHub clone; use AI only for descriptive analysis and recommendations.
- If there is one viable candidate, select it automatically and show its full source entry path, app root, build command, and output directory.
- If several viable candidates exist in different folders, stop progression and show a required âChoose app entryâ selector with candidate paths and detected frameworks.
- Recompute the displayed metadata when the user changes the candidate. Never render a blank output value; unresolved metadata becomes an explicit blocking error rather than an empty field.
- Apply the same selector behavior to the full-page creator and the modal creator so monorepos behave consistently.

### 3. Persist the userâs selected build contract

- Send the selected app root/entry candidate to `create-project` with the stored source archive path.
- Re-run deterministic indexing inside the edge function and validate that the submitted candidate exists in the archive; do not trust client paths blindly.
- Ground only the selected application root, then verify the exact expected output entry before completing creation: plain HTML uses `<appRoot>/www/index.html`; framework projects retain their source entry and configured output directory.
- Persist matching, non-empty values in `project_index`, `project_sources.scan_result`, `project_sources.app_root`, `project_sources.output_dir`, and the creation response.
- Ensure later indexing and Phase 3 consume this persisted selection instead of independently choosing another root.

### 4. Fix and expose project-creation failures

- Check every database/storage operation in `create-project`, including config, source, snapshot, index, and project updates; fail with the exact operation and reason instead of continuing after a silent write error.
- Return structured JSON errors with a stable code, user-facing message, and relevant expected path.
- Update both creation callers to recover the JSON response body from failed function invocations and show the real server message instead of only âEdge Function returned a non-2xx status code.â
- Keep cleanup for incomplete projects, while making cleanup safe and logging any cleanup failure separately from the original cause.
- Add concise server logs around candidate selection, grounding, expected entry validation, and persistence so a future failure is traceable.

### 5. Align Phase 3 with the saved selection

- Feed the persisted app root and output directory into setup/rebuild workflows.
- Run install/build commands from the selected app root in monorepos.
- For plain HTML, execute the generated static copy and require `www/index.html`; for framework projects, require `<outputDir>/index.html`.
- Remove directory-only success checks: an existing empty or stale folder must not count as valid output.
- On failure, report selected root, command, expected output directory, and expected entry path in the build timeline.

## Technical verification

- Add deterministic indexer tests for root plain HTML, nested plain HTML, wrapped GitHub ZIPs, multiple independent entries, monorepo apps, generated-folder exclusions, and grounded static projects retaining `plain-html` + `www`.
- Add creation tests showing that one candidate auto-selects, multiple candidates require a choice, and a submitted selection is server-validated.
- Add persistence tests proving entry/root/output values match across `project_index`, `project_sources`, snapshots, and the creation response.
- Add edge-function error tests that verify callers receive the specific JSON failure reason.
- Add workflow tests proving Phase 3 executes in the selected app root and rejects output folders that do not contain `index.html`.
- Reproduce creation with a plain-HTML archive and a multi-app archive, then verify the displayed values, saved rows, normalized ZIP, and generated Phase 3 workflow end to end.
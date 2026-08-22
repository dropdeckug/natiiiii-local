k# Fix Capacitor plugin installation and plain-HTML normalization

## Confirmed problems

- Plugin handling is split across multiple paths. The two-phase runner resolves companion plugins and published versions, but generated GitHub workflows later run `npm install <package>` without the resolved version, which can replace a Capacitor-compatible version with the latest incompatible major.
- The older build path does not consistently expand required companion plugins and writes `"latest"` into `package.json`, so plugin imports, installed packages, and `cap sync` can disagree.
- Several plugin IDs exposed by the UI are not mapped consistently to the central plugin registry, causing selected plugins to be reported as unsupported or omitted from installation.
- Plain-HTML discovery only treats files named `index.html` as candidates. A valid multi-page HTML project without that exact filename produces no candidate, remains `unknown`, and project creation fails before the existing âpromote an HTML page to index.htmlâ logic can run.
- Static handling is inconsistent in generated workflows: the canonical indexer and creation flow use `www`, while Phase 1 still synthesizes and initializes some static projects with `dist`.
- The browser and Edge Function indexers contain parallel implementations, increasing the chance that creation, saved metadata, re-indexing, and builds choose different roots or outputs.

## Implementation plan

### 1. Make plugin resolution deterministic

- Create one plugin-resolution result used by every build path: canonical plugin ID, npm package, required companions, engine compatibility, and an exact compatible version/range.
- Normalize UI aliases before wiring so every selectable Capacitor plugin either maps to a real package or is blocked with a specific unsupported-package message.
- Resolve official Capacitor plugins to the installed `@capacitor/core` major and validate third-party packages against npm metadata before changing source files.
- Write the resolved versions to the selected app rootâs `package.json`; never write `latest` and never reinstall an unversioned package later in CI.
- Install all resolved packages in one deterministic dependency step, then verify `package.json`, `node_modules`, and Capacitorâs plugin list before running `cap sync android`.
- Treat a failed plugin install or sync as a blocking error and surface the exact package, requested version, npm error, selected app root, and sync output.

### 2. Support real multi-page plain-HTML projects

- Discover all source `.html` files outside generated/vendor/native folders, not only existing `index.html` files.
- Prefer an existing root `index.html`; otherwise rank likely home pages (`home.html`, `main.html`, shallowest HTML file) and require a user choice when several candidates are equally plausible.
- Represent the selected source page separately from the normalized runtime entry so the chosen page can be copied/promoted to `<appRoot>/www/index.html` without deleting or renaming the original.
- Copy the complete selected HTML project tree into `www`, preserving every HTML page, nested folder, stylesheet, script, image, font, and binary asset.
- Harden links and asset paths across every HTML/CSS page while preserving valid relative navigation between pages.
- Always classify this path as `plain-html` / `Plain HTML`, with `npm run build`, `www`, and a required `www/index.html`.

### 3. Keep creation, persistence, and builds on the same contract

- Make deterministic discovery authoritative in both project-creation screens; AI may describe the project but cannot override its root, entry, framework, command, or output directory.
- Pass the selected HTML/app candidate to `create-project`, validate it again against the stored archive, normalize it, and persist the same app root, source entry, runtime entry, framework, and `www` output everywhere.
- Preserve the saved selection during re-indexing and both build phases rather than independently rescanning for the first package or HTML file.
- Remove the remaining static `dist` synthesis and hardcoded `--web-dir dist` behavior from Phase 1; static setup and rebuild must use `www` and require a non-empty `www/index.html`.
- Run dependency installation, plugin reconciliation, web preparation, and Capacitor commands from the persisted app root for nested repositories and monorepos.

### 4. Align display and error reporting

- Add a proper Plain HTML framework label/icon fallback instead of showing âunknown.â
- Show the selected source page, app root, normalized entry (`www/index.html`), and output directory before creation.
- Return structured creation errors for âno HTML files,â âentry selection required,â âselected entry missing,â and âwww/index.html was not produced.â
- Preserve npm and `cap sync` diagnostics in the build activity feed instead of reducing failures to âplugin installation failed.â

## Technical verification

- Add plugin tests for UI aliases, companion expansion, Capacitor-major compatibility, third-party version resolution, no `latest` writes, missing packages, and failed `cap sync`.
- Add discovery/grounding tests for root static sites, nested repository wrappers, no-index multi-page sites, several possible home pages, nested assets, binary assets, relative page navigation, and generated-folder exclusions.
- Add persistence tests proving `plain-html`, selected source entry, app root, `www`, and `www/index.html` remain identical across creation, project index, source metadata, snapshots, setup, and rebuild.
- Add workflow tests proving Phase 1 and Phase 3 use `www`, run in the saved app root, install pinned plugin versions once, and fail when the expected entry or a selected plugin is missing.
- Reproduce one failing Capacitor-plugin build and one failing multi-page HTML repository end to end, verifying the final normalized archive and synced Android assets.  
And I want you to make the workflow to start very fast. So I want you to harden the speed to make workflows perform at a very high speed. Uh, even if the project is not started to GitHub or transferred back to the platform, make sure that speed is run faster. Even if the project is big
# Fix deployment imports, blank screens, and Android workflow generation

 Goal
Make the current source deploy reliably to Vercel and ensure every generated Android workflow remains valid when pluginsÃÂ¢ÃÂÃÂespecially any of the three edge-to-edge modesÃÂ¢ÃÂÃÂare enabled.

## Confirmed diagnosis
- The bare `logs` rule in `.gitignore` matches directories named `logs` at any depth, so `src/lib/logs/logSink.ts` and `src/components/logs/LogsExplorer.tsx` exist locally but are omitted from Git and therefore from Vercel.
- `src/main.tsx` imports the omitted logging module before React renders, so the missing file prevents the entire application bundle from starting and produces the blank deployment screen.
- Android workflows are assembled from large interpolated YAML and shell fragments. Their exact failing fragment still needs to be established by rendering and parsing each generated variant rather than guessing from the template source.

## Implementation
1. **Make the logging source deployable**
   - Scope the ignore rule to root-level runtime logs instead of every `logs` source directory.
   - Keep the current logging module and Logs Explorer in normal source control scope.
   - Add a lightweight repository check that fails if either required source module is ignored or absent.

2. **Protect application bootstrap**
   - Remove the logging subsystem from the critical synchronous render path.
   - Initialize API log tapping defensively so a future optional logging failure cannot prevent `App` from rendering.
   - Preserve existing log collection and Logs Explorer behavior when the module is available.

3. **Validate every generated workflow variant**
   - Render setup, rebuild, repository-source, and uploaded-source workflows with no plugins and with representative plugin sets.
   - Cover all edge-to-edge choices: spacer/fade, status-bar tint, and already-native edge-to-edge.
   - Parse the rendered YAML and syntax-check embedded shell scripts to identify the concrete failing interpolation, quoting, or heredoc boundary.

4. **Harden workflow and plugin generation**
   - Correct only the confirmed malformed YAML/shell fragments in the shared workflow generator.
   - Ensure plugin packages are installed before generated imports/configuration are used, while excluding deprecated edge-to-edge wrapper packages.
   - Replace fragile inline edge-to-edge shell mutation with a deterministic generated script or safely delimited step if validation identifies that block as the failure.
   - Keep workflow validation at generation time so invalid YAML is rejected before being committed or dispatched.

5. **Regression verification**
   - Run focused tests for source-module presence, app bootstrap, and workflow rendering.
   - Verify the local preview renders the dashboard and Logs Explorer without module-resolution errors.
   - Verify every generated workflow parses successfully and its shell steps pass syntax checks.
   - Confirm the production bundle succeeds with the same tracked-file set Vercel receives.

## Technical scope
- Expected files: `.gitignore`, `src/main.tsx`, logging source/components if typing fixes are required, `supabase/functions/build-apk/index.ts`, and focused regression tests/scripts.
- No dashboard redesign, unrelated dependency upgrades, database changes, or publishing in this work.
# Grounded Build Repair Pipeline

## Goal
Make automatic repair use the exact failed GitHub run, apply evidence-based source patches, visibly report every edited file, and retry with the patched snapshot without repeating the same ineffective fix.

## Implementation
1. **Run-scoped failure evidence**
   - Retrieve persisted `build_logs` by both project ID and GitHub run ID, newest first, then restore chronological order for AI context.
   - Merge persisted rows with freshly imported CI output, deduplicate them, and clearly report the log retrieval step and row count in the Action Panel.
   - Pass one canonical parsed failure through classification, prompting, and recurrence detection so warnings cannot change the diagnosed category.

2. **Stronger repair reasoning**
   - Use GPT-5 as the default model specifically for workflow/build repair through the Lovable AI Gateway.
   - Expand repair context for Vite configuration, package manifests, lock/config files, source entry points, and files named by unresolved imports.
   - Require the repair response to explain its evidence and return complete, validated file edits; reject no-op edits and paths that were not supplied for inspection.

3. **Patch persistence and transparent UI**
   - Record every repaired file with before/after content and line counts in the AI timeline so users can expand the actual diff.
   - Show explicit stages for fetching logs, diagnosing, patching, saving the source snapshot, uploading it, and re-triggering the exact failed phase.
   - Attach project/run/build identifiers to repair logs and persisted repair events.

4. **Loop prevention and retry integrity**
   - Normalize timestamps, run IDs, hashes, and CI noise out of failure fingerprints.
   - Detect no-op or repeated patch sets and stop before dispatching another identical build.
   - Verify that the uploaded retry archive contains the just-edited content before dispatch.

5. **Validation**
   - Add focused tests for run-scoped log retrieval, stable failure fingerprints, canonical classification, and diff event generation.
   - Resolve the current missing page-module build error so the platform preview compiles after these changes.

## Technical notes
- Existing row-level project ownership remains authoritative; log queries are additionally scoped to the authenticated user's project and exact run ID.
- Repair retries remain bounded; terminal AI Gateway errors stop immediately, while only rate limits and server failures receive bounded backoff.
- The interactive code-repair agent remains available for failures that cannot be solved by the structured first-pass repair.

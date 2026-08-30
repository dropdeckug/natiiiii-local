// AI Readiness Repair — pre-creation source repair agent.
//
// Receives the Canonical Project Representation (CPR summary + CI contract),
// the readiness findings and the contents of the files those findings point at,
// and returns complete, validated file edits the client applies to the
// in-memory project tree before the project is created.
//
// Input:  { canonical, findings[], files[{path,content}], attempt?, previousFailures?, model? }
// Output: { fileEdits[], fileDeletes[], packageJsonPatch[], notes, resolved[] }
//
// Never touches: .github/workflows/**, lockfiles, keystores, secrets.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { gatewayFetch } from "../_shared/aiGateway.ts";

const DEFAULT_MODEL = "google/gemini-3.1-pro-preview";
const FALLBACK_MODEL = "google/gemini-3.6-flash";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FORBIDDEN = [
  /^\.github\/workflows\//,
  /(^|\/)package-lock\.json$/,
  /(^|\/)bun\.lockb?$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /\.(keystore|jks|p12|mobileprovision)$/i,
];

const isForbidden = (p: string) => FORBIDDEN.some((re) => re.test(p));

const SYSTEM_PROMPT = `You are the NativeBridge readiness repair agent.

A user is importing a web project that will be packaged into a native app
(Capacitor -> Android/iOS) by a fixed GitHub Actions pipeline. Before the
project can be created, its source must be made compatible with that pipeline.

You receive:
  • canonical  — the Canonical Project Representation: framework, entry html,
                 build tool, build command, output dir, package manager, and the
                 exact CI contract (node version, capacitor major, install
                 command, build command, expected output dir, excluded globs).
  • findings   — the deterministic readiness findings that block creation.
  • files      — the complete current content of every file a finding points at,
                 plus package.json, vite config, index.html and entry modules.

Fix ONLY what the findings describe, but fix them COMPLETELY and in a way that
still builds under the CI contract.

Repair rules:
1. Env vars: create or extend \`.env\` and \`.env.example\` with every referenced
   VITE_*/NEXT_PUBLIC_*/REACT_APP_* key (empty or safe placeholder values), and
   make read sites tolerate an undefined value so the app cannot blank-screen.
2. Hardcoded http://localhost, ws://localhost or 127.0.0.1 outside a DEV guard:
   replace with an env-driven base URL guarded by \`import.meta.env.DEV\`.
   Cleartext traffic is blocked on Android release builds.
3. Vite config: set \`base: "./"\` (native shells load from file://), align
   \`build.outDir\` with canonical.outputDir, and remove production reliance on
   dev-server-only settings (proxy, host-bound HMR).
4. package.json: add genuinely imported but undeclared dependencies with real,
   stable semver ranges. Never invent package names. Never add "latest".
   Keep the build script consistent with canonical.ci.buildCommand.
5. Routing: if the app uses BrowserRouter without a basename in a file:// shell,
   switch it to HashRouter (import and usage) so deep links resolve.
6. index.html: rewrite absolute asset paths ("/assets/x.png") to relative
   ("./assets/x.png"). Drop references to assets that do not exist.
7. Delete files only when they conflict with the CI install/build strategy
   (stale lockfiles for a different package manager, conflicting configs).
8. NEVER edit or create anything under .github/workflows/, lockfiles, or
   keystores.
9. fileEdits[].newContent must be the COMPLETE new file content — never a diff,
   never a truncation, never a placeholder comment.
10. Only return an edit for a path that was supplied to you, unless you are
    creating a new file that the findings require (.env, .env.example).
11. Do not return an edit whose content equals the current content.

Emit your answer ONLY through the \`emit_repair\` tool.`;

const REPAIR_TOOL = {
  type: "function" as const,
  function: {
    name: "emit_repair",
    description: "Emit the readiness repair plan as structured JSON.",
    parameters: {
      type: "object",
      properties: {
        fileEdits: {
          type: "array",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              newContent: { type: "string" },
              reason: { type: "string" },
              findingId: { type: "string" },
            },
            required: ["path", "newContent", "reason"],
            additionalProperties: false,
          },
        },
        fileDeletes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              reason: { type: "string" },
            },
            required: ["path", "reason"],
            additionalProperties: false,
          },
        },
        packageJsonPatch: {
          type: "array",
          description: "Dependencies to add. Real npm names, real semver ranges.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              version: { type: "string" },
              dev: { type: "boolean" },
            },
            required: ["name", "version"],
            additionalProperties: false,
          },
        },
        resolved: {
          type: "array",
          description: "Ids of the findings this patch set resolves.",
          items: { type: "string" },
        },
        notes: { type: "string" },
      },
      required: ["fileEdits", "notes"],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const canonical = body?.canonical ?? {};
    const findings = Array.isArray(body?.findings) ? body.findings : [];
    const files = Array.isArray(body?.files) ? body.files : [];
    const previousFailures: string[] = Array.isArray(body?.previousFailures) ? body.previousFailures : [];
    const attempt = Number(body?.attempt) || 1;
    const model = typeof body?.model === "string" && body.model ? body.model : DEFAULT_MODEL;

    if (findings.length === 0) {
      return new Response(
        JSON.stringify({ fileEdits: [], fileDeletes: [], packageJsonPatch: [], resolved: [], notes: "No findings to repair." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const fileBlock = files
      .filter((f: any) => f?.path && typeof f.content === "string" && !isForbidden(f.path))
      .slice(0, 40)
      .map((f: any) => `--- FILE: ${f.path} ---\n${String(f.content).slice(0, 60_000)}`)
      .join("\n\n");

    const userPrompt = [
      `CANONICAL PROJECT REPRESENTATION:\n${JSON.stringify(canonical, null, 2)}`,
      `FINDINGS TO RESOLVE:\n${JSON.stringify(findings, null, 2)}`,
      previousFailures.length
        ? `PREVIOUS ATTEMPT (#${attempt - 1}) STILL FAILED THESE CHECKS — fix them differently:\n${previousFailures.join("\n")}`
        : "",
      `PROJECT FILES:\n${fileBlock}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const callModel = async (m: string) =>
      await gatewayFetch({
        model: m,
        payload: {
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          tools: [REPAIR_TOOL],
          tool_choice: { type: "function", function: { name: "emit_repair" } },
        },
      });

    let resp = await callModel(model);
    if (!resp.ok && (resp.status >= 500 || resp.status === 429) && model !== FALLBACK_MODEL) {
      resp = await callModel(FALLBACK_MODEL);
    }

    if (!resp.ok) {
      const text = await resp.text();
      return new Response(
        JSON.stringify({ error: `AI gateway error ${resp.status}`, detail: text.slice(0, 600), status: resp.status }),
        { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await resp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: any = {};
    if (call?.function?.arguments) {
      try {
        parsed = JSON.parse(call.function.arguments);
      } catch {
        parsed = {};
      }
    }
    if (!parsed.fileEdits && typeof data?.choices?.[0]?.message?.content === "string") {
      const match = data.choices[0].message.content.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch { /* ignore */ }
      }
    }

    const currentByPath = new Map<string, string>(
      files.filter((f: any) => f?.path).map((f: any) => [f.path, String(f.content ?? "")]),
    );

    const fileEdits = (Array.isArray(parsed.fileEdits) ? parsed.fileEdits : [])
      .filter((e: any) => e?.path && typeof e.newContent === "string")
      .filter((e: any) => !isForbidden(e.path))
      .filter((e: any) => currentByPath.get(e.path) !== e.newContent);

    const fileDeletes = (Array.isArray(parsed.fileDeletes) ? parsed.fileDeletes : [])
      .filter((d: any) => d?.path && !isForbidden(d.path));

    const packageJsonPatch = (Array.isArray(parsed.packageJsonPatch) ? parsed.packageJsonPatch : [])
      .filter((p: any) => p?.name && typeof p.version === "string" && p.version !== "latest");

    return new Response(
      JSON.stringify({
        fileEdits,
        fileDeletes,
        packageJsonPatch,
        resolved: Array.isArray(parsed.resolved) ? parsed.resolved : [],
        notes: typeof parsed.notes === "string" ? parsed.notes : "",
        model,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Readiness repair failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

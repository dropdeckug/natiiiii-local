// AI Repair Build — analyzes a code-level build failure and returns
// safe, minimal patches the client can apply to the in-memory file tree.
//
// Input:  { errorCategory, errorDetail, logs, affectedFiles[{path,content}],
//           packageJson, unresolvedImports[{specifier,filePath}], model? }
// Output: { fileEdits:[{path,newContent,reason}],
//           packageJsonPatch:{dependencies?,devDependencies?},
//           excludeFromBuild:string[], notes:string }
//
// Never touches: .github/workflows/**, package-lock.json, secrets.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { gatewayFetch, DEFAULT_MODEL } from "../_shared/aiGateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a build-repair agent for a Capacitor/Vite Android pipeline.
The user's web build failed because of CODE-level issues (bad imports, missing npm packages,
Deno-only specifiers like \`npm:foo\` or \`https://esm.sh/x\` leaking into the web build,
duplicate imports, syntax errors, missing exports).

You will receive the parsed error, a few affected file contents, and the current package.json.
Return STRICT JSON via the \`emit_repair\` tool with this shape:

{
  "fileEdits":  [{ "path": "...", "newContent": "...", "reason": "..." }],
  "packageJsonPatch": { "dependencies": {...}, "devDependencies": {...} },
  "excludeFromBuild": ["supabase/functions/**"],
  "notes": "1-3 sentence summary"
}

Rules — follow STRICTLY:
1. NEVER edit files under .github/workflows/, package-lock.json, bun.lockb, or any keystore.
2. For \`npm:pkg@x\` and \`https://esm.sh/pkg\` specifiers in files under \`supabase/functions/**\`,
   PREFER adding \`supabase/functions/**\` to \`excludeFromBuild\` instead of rewriting them
   (those files are Deno edge-function code and should not be in the web/Android build).
3. For \`npm:pkg\` specifiers in normal app code (src/**, etc.), rewrite to bare specifier
   (\`import x from "pkg"\`) AND add the package to packageJsonPatch.dependencies with a
   sensible recent version (e.g. "^latest-known-major"). Use well-known stable versions:
   react ^18.3.1, @supabase/supabase-js ^2.45.0.
4. For missing-module errors, add the exact package named by the build log to
   packageJsonPatch.dependencies. For official Capacitor packages, use the same major version
   already used by @capacitor/core in package.json. NEVER invent package names.
5. For duplicate-import / syntax / wrong-export errors, return a minimal corrected version
   of the file in fileEdits.
6. fileEdits[].newContent must be the COMPLETE new file content, not a diff.
7. If you cannot safely fix something, leave it out and explain in \`notes\`.
8. Output JSON ONLY through the tool call. No prose.`;

const REPAIR_TOOL = {
  type: "function" as const,
  function: {
    name: "emit_repair",
    description: "Emit the repair plan as structured JSON.",
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
            },
            required: ["path", "newContent", "reason"],
            additionalProperties: false,
          },
        },
        packageJsonPatch: {
          type: "array",
          description:
            "Packages to add to package.json. Each entry must be a real npm package name and a valid semver range.",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Exact npm package name, e.g. @capacitor/status-bar" },
              version: { type: "string", description: "Semver range, e.g. ^6.0.0" },
              dev: { type: "boolean", description: "true for devDependencies" },
            },
            required: ["name", "version", "dev"],
            additionalProperties: false,
          },
        },

        excludeFromBuild: { type: "array", items: { type: "string" } },
        notes: { type: "string" },
      },
      required: ["fileEdits", "packageJsonPatch", "excludeFromBuild", "notes"],
      additionalProperties: false,
    },
  },
};

const FORBIDDEN_PATH = (p: string) =>
  p.startsWith(".github/workflows/") ||
  p === "package-lock.json" ||
  p === "bun.lockb" ||
  p === "bun.lock" ||
  p.includes("/keystore") ||
  p.endsWith(".keystore") ||
  p.endsWith(".jks");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      errorCategory = "unknown",
      errorDetail = "",
      logs = "",
      affectedFiles = [],
      packageJson = null,
      unresolvedImports = [],
        enabledPlugins = [],
      model = DEFAULT_MODEL,
    } = body || {};

    if (!Deno.env.get("LOVABLE_API_KEY")) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userMsg = [
      `Error category: ${errorCategory}`,
      `Error detail: ${errorDetail}`,
      `Enabled plugin IDs: ${Array.isArray(enabledPlugins) && enabledPlugins.length ? enabledPlugins.join(", ") : "(none)"}`,
      `Scope rule: repair only the logged build failure. Do not add, configure, or search for plugin/auth features unless they are in Enabled plugin IDs.`,
      unresolvedImports.length > 0
        ? `\nUnresolved imports:\n${unresolvedImports
            .map((u: any) => `  - ${u.specifier} (${u.filePath})`)
            .join("\n")}`
        : "",
      logs ? `\nRecent build logs (last lines):\n${String(logs).slice(-3000)}` : "",
      packageJson
        ? `\nCurrent package.json (truncated):\n${JSON.stringify(packageJson, null, 2).slice(0, 4000)}`
        : "",
      `\nAffected file contents:`,
      ...affectedFiles.slice(0, 8).map(
        (f: any) =>
          `\n--- FILE: ${f.path} ---\n${String(f.content || "").slice(0, 6000)}\n--- END ---`
      ),
    ].join("\n");

    const aiResp = await gatewayFetch({
      model,
      payload: {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
        tools: [REPAIR_TOOL],
        tool_choice: { type: "function", function: { name: "emit_repair" } },
      },
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      return new Response(
        JSON.stringify({ error: `AI gateway error ${aiResp.status}`, detail: t.slice(0, 500) }),
        { status: aiResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "No tool call returned by AI" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let plan: any;
    try {
      plan = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(JSON.stringify({ error: "AI returned invalid JSON" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitize: strip forbidden file edits
    plan.fileEdits = (plan.fileEdits || []).filter((e: any) => e?.path && !FORBIDDEN_PATH(e.path));
    plan.excludeFromBuild = (plan.excludeFromBuild || []).filter(
      (p: any) => typeof p === "string" && !FORBIDDEN_PATH(p)
    );
    // The tool returns an array of {name, version, dev}; the client applies a
    // {dependencies, devDependencies} map. Normalize + reject junk names.
    const VALID_PKG = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/;
    const patch: { dependencies: Record<string, string>; devDependencies: Record<string, string> } = {
      dependencies: {},
      devDependencies: {},
    };
    for (const entry of Array.isArray(plan.packageJsonPatch) ? plan.packageJsonPatch : []) {
      const name = String(entry?.name || "").trim();
      const version = String(entry?.version || "").trim();
      if (!VALID_PKG.test(name) || !version) continue;
      (entry?.dev ? patch.devDependencies : patch.dependencies)[name] = version;
    }
    plan.packageJsonPatch = patch;

    plan.notes = String(plan.notes || "");

    return new Response(JSON.stringify(plan), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// AI Wiring engine — runs between Phase 1 (setup) and Phase 2 (rebuild).
// Uses Lovable AI Gateway with tool calling. Streams short thinking captions
// over Server-Sent Events so the Action Panel can show real-time progress.
//
// Request body: {
//   manifest: { installedPlugins: string[], framework: string, ... },
//   sourceFiles: { path: string, content: string }[],
//   enabledPlugins: string[],
//   pluginConfigs: Record<string, string>,
//   model?: string,
// }
//
// Streamed events (SSE):
//   data: { "type": "caption", "text": "Reading App.tsx" }
//   data: { "type": "patch",   "path": "src/main.tsx", "content": "..." }
//   data: { "type": "done",    "patches": [...], "reasoning": [...] }
//   data: { "type": "error",   "error": "..." }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { gatewayFetch, DEFAULT_MODEL } from "../_shared/aiGateway.ts";
import { buildKnowledgeDigest } from "../_shared/pluginKnowledge.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SourceFile { path: string; content: string }
interface Patch { path: string; content: string }

const MAX_FILES_IN_CONTEXT = 80;
const MAX_FILE_BYTES = 12000;
const MAX_LOOPS = 16;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "readFile",
      description: "Read the full content of a source file by path.",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    },
  },
  {
    type: "function",
    function: {
      name: "listFiles",
      description: "List every project file path. Optionally filter by a path substring (case-insensitive).",
      parameters: { type: "object", properties: { contains: { type: "string", description: "Optional path substring filter" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "searchFiles",
      description: "Search file CONTENTS for a substring/regex. Returns matching paths. Use this to discover where a feature is implemented.",
      parameters: { type: "object", properties: { pattern: { type: "string" } }, required: ["pattern"] },
    },
  },
  {
    type: "function",
    function: {
      name: "searchPaths",
      description: "Search file PATHS (not contents) for a substring/regex. Use to find files by name, e.g. 'login', 'auth', 'camera', 'service'.",
      parameters: { type: "object", properties: { pattern: { type: "string" } }, required: ["pattern"] },
    },
  },
  {
    type: "function",
    function: {
      name: "writeFile",
      description: "Emit a patched version of a file. Provide the FULL new file content. Creates the file if it does not exist.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
          reason: { type: "string", description: "Short reason for this change." },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "thinking",
      description: "Emit a short status caption (max 50 chars) describing what you're doing.",
      parameters: { type: "object", properties: { caption: { type: "string" } }, required: ["caption"] },
    },
  },
  {
    type: "function",
    function: {
      name: "done",
      description: "Signal that all required wiring is complete.",
      parameters: { type: "object", properties: { summary: { type: "string" } } },
    },
  },
];

function systemPrompt(manifest: any, plugins: string[], pluginConfigs: Record<string, string>) {
  const knowledge = buildKnowledgeDigest(plugins);
  const hasAuthPlugin = plugins.some((p) => /auth|sign-in|login/i.test(p));
  const envRule = Object.keys(pluginConfigs).length > 0
    ? "6. Create or update `.env` and `src/vite-env.d.ts` ONLY when an enabled plugin needs a provided `VITE_*` config value."
    : "6. Do NOT create or edit `.env` or `src/vite-env.d.ts`; no plugin config values were provided.";
  const discoveryHints = hasAuthPlugin
    ? "- auth/sign-in: AuthProvider, useAuth, SessionContext, login pages, supabase.auth.*\n"
    : "";
  return `You are NativeBridge AI Wiring Agent. Your job is to wire enabled Capacitor plugins into a user's web project after Phase 1 (npm dependencies installed).

## Manifest from Phase 1
${JSON.stringify(manifest, null, 2)}

## Enabled plugins (internal IDs)
${plugins.join(", ") || "(none)"}

## Plugin configuration values (from the user's Plugin Settings)
${Object.keys(pluginConfigs).length === 0 ? "(none provided)" : Object.entries(pluginConfigs).map(([k, v]) => `- ${k}: ${typeof v === "string" ? v.slice(0, 60) : "[file]"}`).join("\n")}

${knowledge}

## Your job — for EVERY enabled plugin, in order
If there are no enabled plugins, do not inspect auth/env files, do not write files, and call \`done\` immediately.
1. Emit a short \`thinking\` caption (≤ 50 chars) BEFORE every action.
2. **Discover where the plugin's intent already lives in this project.** Different projects use different file names. Do NOT assume hard-coded filenames. Use the tools:
   - \`listFiles\` (optionally with \`contains\`) to scan the file tree.
   - \`searchPaths\` to find files by NAME (e.g. for camera plugin search "camera|photo|capture"; for storage search "upload|file|attach"; for auth search "auth|login|signin|session|provider").
   - \`searchFiles\` to find files by CONTENT (e.g. existing API calls, hooks, providers).
3. \`readFile\` each strong candidate before editing — never guess.
4. **Wire INTO existing code, don't duplicate it.** If the project already has a hook/provider/service that handles the same intent, add the native plugin call there, gated by \`Capacitor.isNativePlatform()\` alongside the existing web flow. Only fall back to the entry file (main/App) if no better home exists.
5. For each plugin, use \`writeFile\` to inject:
   - The required import line in the most appropriate file(s).
   - The required initialization snippet using configuration values.
   - Env variable references (e.g. \`import.meta.env.VITE_*\`) when a config value is provided.
${envRule}
7. NEVER touch package.json, capacitor.config, or android/ios native files — Phase 1 already installed deps and Phase 3 injects native config files.
8. **CRITICAL: only import packages actually installed (listed in the manifest's \`installedPlugins\`/\`plugins\`). If a plugin failed to install, DO NOT add an import for it — emit thinking("Skipping <plugin> — not installed") and move on.**
9. When EVERY enabled plugin has been wired, skipped, or already-present, call \`done\` with a brief summary.

## Discovery hints by intent (NOT hard rules — verify with searchPaths/searchFiles first)
${discoveryHints}- Only use a hint if the matching plugin is enabled. Never search auth/login files unless an auth plugin is enabled.
- camera/photo: image upload handlers, file inputs, gallery components
- geolocation: map components, location hooks, address forms
- push/local notifications: notification service files, settings pages
- storage/filesystem: upload/download utilities, file managers
- biometrics: settings/security pages, lock screens
- share: share buttons, post/article views
- google-auth specifically: package is \`@capawesome/capacitor-google-sign-in\` exporting \`GoogleSignIn\`. Use \`VITE_GOOGLE_WEB_CLIENT_ID\`. Never use the unmaintained codetrix package.

## Rules
- Always emit a \`thinking\` caption first, then take the action.
- Edit MULTIPLE files per plugin when needed.
- Keep injections minimal — only what is required.
- Preserve existing code; never delete unrelated logic.
- If a file is already wired (import already exists), skip it but still call thinking("Already wired: <plugin>").
- ALWAYS finish with the \`done\` tool, even if no edits were needed.
`;
}

async function* streamGateway(messages: any[], model: string, _key: string): AsyncGenerator<any> {
  const resp = await gatewayFetch({ model, payload: { messages, tools: TOOLS, stream: false } });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI gateway ${resp.status}: ${text.slice(0, 300)}`);
  }
  const data = await resp.json();
  yield data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

  const sourceFiles: SourceFile[] = (body.sourceFiles || []).slice(0, 200);
  const enabledPlugins: string[] = body.enabledPlugins || [];
  const pluginConfigs: Record<string, string> = body.pluginConfigs || {};
  const manifest = body.manifest || {};
  const model: string = body.model || DEFAULT_MODEL;

  if (enabledPlugins.length === 0) {
    return new Response(`data: ${JSON.stringify({ type: "caption", text: "No enabled plugins" })}\n\ndata: ${JSON.stringify({ type: "done", patches: [], reasoning: ["No enabled plugins; skipped AI wiring."] })}\n\n`, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  // Index by path
  const fileIndex = new Map<string, string>();
  for (const f of sourceFiles) fileIndex.set(f.path, f.content);

  // Build a context preview: entry points + plugin-relevant files only. Do not
  // bias the model toward auth/env work unless an enabled plugin requires it.
  const ENTRY_RE = /\b(main|index|App)\.(tsx|ts|jsx|js)$/;
  const hasAuthPlugin = enabledPlugins.some((p) => /auth|sign-in|login/i.test(p));
  const hasConfigValues = Object.keys(pluginConfigs).length > 0;
  const AUTH_PATH_RE = /(auth|login|signin|sign-in|session|provider|context|useAuth|AuthProvider)/i;
  const AUTH_DIR_RE = /^src\/(contexts|providers|hooks|pages|components\/auth)\//i;
  const ENV_RE = /(^|\/)(\.env(\.\w+)?|vite-env\.d\.ts)$/;
  const AUTH_CONTENT_RE = /(supabase\.auth|signInWith|onAuthStateChange|useAuth\(|AuthProvider|GoogleAuth|GoogleSignIn|SignInWithApple|FacebookLogin)/;

  const scored = sourceFiles.map((f) => {
    let score = 0;
    if (ENTRY_RE.test(f.path)) score += 10;
    if (hasConfigValues && ENV_RE.test(f.path)) score += 8;
    if (hasAuthPlugin && AUTH_DIR_RE.test(f.path) && AUTH_PATH_RE.test(f.path)) score += 7;
    else if (hasAuthPlugin && AUTH_PATH_RE.test(f.path)) score += 5;
    if (hasAuthPlugin && AUTH_CONTENT_RE.test(f.content)) score += 4;
    return { f, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);

  const contextFiles = scored.slice(0, MAX_FILES_IN_CONTEXT).map((x) => x.f);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: any) => controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`));
      const messages: any[] = [
        { role: "system", content: systemPrompt(manifest, enabledPlugins, pluginConfigs) },
        {
          role: "user",
          content: `Candidate files (entry points plus files relevant to enabled plugins only). Use \`searchFiles\` and \`readFile\` to gather more context — DO NOT assume; explore only for enabled plugins.\n\n${contextFiles.map((f) => `### ${f.path}\n\`\`\`\n${f.content.slice(0, MAX_FILE_BYTES)}\n\`\`\``).join("\n\n")}`,
        },
      ];
      const patches: Patch[] = [];
      const reasoning: string[] = [];

      try {
        send({ type: "caption", text: "Analyzing project" });

        for (let loop = 0; loop < MAX_LOOPS; loop++) {
          let assistantMsg: any = null;
          for await (const data of streamGateway(messages, model, LOVABLE_API_KEY)) {
            assistantMsg = data?.choices?.[0]?.message;
          }
          if (!assistantMsg) break;
          messages.push(assistantMsg);

          const toolCalls = assistantMsg.tool_calls || [];
          if (toolCalls.length === 0) {
            // Model produced text only — assume done
            if (assistantMsg.content) reasoning.push(String(assistantMsg.content).slice(0, 300));
            break;
          }

          let isDone = false;
          for (const tc of toolCalls) {
            const name = tc.function?.name;
            let args: any = {};
            try { args = JSON.parse(tc.function?.arguments || "{}"); } catch {}

            let toolResult = "";
            if (name === "thinking") {
              const cap = String(args.caption || "").slice(0, 60);
              if (cap) send({ type: "caption", text: cap });
              toolResult = "ok";
            } else if (name === "readFile") {
              const path = String(args.path || "");
              const c = fileIndex.get(path);
              send({ type: "tool", op: "read", path });
              toolResult = c ? c.slice(0, MAX_FILE_BYTES) : `File not found: ${path}`;
            } else if (name === "listFiles") {
              const contains = String(args.contains || "").toLowerCase();
              const all = Array.from(fileIndex.keys());
              const filtered = contains ? all.filter((p) => p.toLowerCase().includes(contains)) : all;
              send({ type: "tool", op: "search", query: contains ? `paths~${contains}` : "all files", count: filtered.length });
              toolResult = filtered.slice(0, 200).join("\n") || "(no files)";
            } else if (name === "searchPaths") {
              const pat = String(args.pattern || "");
              const matches: string[] = [];
              try {
                const re = new RegExp(pat, "i");
                for (const f of sourceFiles) if (re.test(f.path)) matches.push(f.path);
              } catch {
                const lower = pat.toLowerCase();
                for (const f of sourceFiles) if (f.path.toLowerCase().includes(lower)) matches.push(f.path);
              }
              send({ type: "tool", op: "search", query: `path:${pat}`, count: matches.length });
              toolResult = matches.slice(0, 50).join("\n") || "(no path matches)";
            } else if (name === "searchFiles") {
              const pat = String(args.pattern || "");
              const matches: string[] = [];
              try {
                const re = new RegExp(pat, "i");
                for (const f of sourceFiles) if (re.test(f.content)) matches.push(f.path);
              } catch {
                const lower = pat.toLowerCase();
                for (const f of sourceFiles) if (f.content.toLowerCase().includes(lower)) matches.push(f.path);
              }
              send({ type: "tool", op: "search", query: pat, count: matches.length });
              toolResult = matches.slice(0, 30).join("\n") || "(no matches)";
            } else if (name === "writeFile") {
              const path = String(args.path || "");
              const content = String(args.content || "");
              const reason = String(args.reason || "AI wiring");
              if (path && content) {
                patches.push({ path, content });
                fileIndex.set(path, content);
                send({ type: "patch", path, reason });
                send({ type: "tool", op: "edit", path, reason });
                reasoning.push(`Wrote ${path}: ${reason}`);
                toolResult = `Patched ${path}`;
              } else {
                toolResult = "Missing path or content";
              }
            } else if (name === "done") {
              isDone = true;
              if (args.summary) reasoning.push(String(args.summary));
              toolResult = "ok";
            } else {
              toolResult = `Unknown tool: ${name}`;
            }

            messages.push({ role: "tool", tool_call_id: tc.id, content: toolResult });
          }

          if (isDone) break;
        }

        send({ type: "done", patches, reasoning });
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ type: "error", error: msg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
});

// Code Repair Agent — multi-turn tool-calling repair edge function.
//
// Bridges src/lib/repair/codeRepairAgent.ts to the AI Gateway router
// (Google AI Studio / Lovable AI Gateway) with the complete suite of
// project inspection, surgical patching, and verification tools.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { gatewayFetch, DEFAULT_MODEL } from "../_shared/aiGateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REPAIR_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "get_platform_context",
      description: "Returns the platform CI contract, runtime conventions, and path constraints.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "inspect",
      description: "Runs a sandboxed, read-only inspection command (rg, grep, sed, find, ls, cat, wc, head, tail) against the project tree.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The read-only inspection command to execute." },
        },
        required: ["command"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_lines",
      description: "Reads a specific range of lines from a project file.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative file path (e.g. 'src/App.tsx')." },
          start_line: { type: "number", description: "First line to read (1-indexed)." },
          end_line: { type: "number", description: "Last line to read (inclusive)." },
        },
        required: ["path", "start_line", "end_line"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_code",
      description: "Searches for a text pattern or regex across project files.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Text or regex pattern to search for." },
          paths: { type: "array", items: { type: "string" }, description: "Optional list of directories or files to constrain search to." },
          extension: { type: "string", description: "Optional file extension filter (e.g. 'ts', 'tsx')." },
          context: { type: "number", description: "Lines of surrounding context (0-5)." },
        },
        required: ["pattern"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_files",
      description: "Lists files in the project tree, optionally filtered by directory and extension.",
      parameters: {
        type: "object",
        properties: {
          directory: { type: "string", description: "Optional directory path to list." },
          extension: { type: "string", description: "Optional extension filter (e.g. 'json', 'ts')." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_file_structure",
      description: "Returns an outline of declarations and top-level symbols in a file.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative file path." },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "patch_file",
      description: "Applies a surgical, verbatim replacement to an inspected file. old_text must match exactly once.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative path to the file to patch." },
          old_text: { type: "string", description: "Verbatim substring currently in the file to replace." },
          new_text: { type: "string", description: "New replacement content." },
        },
        required: ["path", "old_text", "new_text"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "write_file",
      description: "Creates a new file or completely replaces the contents of an existing file (e.g. for creating config stubs or .env.example).",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative file path to write." },
          content: { type: "string", description: "Full content of the file." },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_file",
      description: "Deletes a conflicting or obsolete file (e.g. conflicting package-lock.json or duplicate config).",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative file path to delete." },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_folder",
      description: "Ensures a folder path exists in the project tree.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative directory path." },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_dependency",
      description: "Safely modifies or removes an npm package in package.json.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Exact npm package name." },
          version: { type: "string", description: "Semver range (e.g. '^18.3.1'). Required unless remove is true." },
          section: { type: "string", enum: ["dependencies", "devDependencies"], description: "Which dependency section to target." },
          remove: { type: "boolean", description: "Set to true to remove the package." },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "run_command",
      description: "Executes an essential build repair command: `npm pkg set/delete`, `npm install <pkg>`, `npm run build`, `npm test`, or `rm <lockfile>`.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Command to execute (e.g. 'npm pkg set type=module', 'npm install lucide-react', 'npm run build')." },
        },
        required: ["command"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "run_build_check",
      description: "Re-runs the failing build step to verify whether recent patches resolved the issue.",
      parameters: {
        type: "object",
        properties: {
          step: { type: "string", description: "Name of the failing step to verify (e.g. 'build', 'install')." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "fix_alias_sync",
      description: "Synchronizes path aliases from tsconfig.json (e.g. '@/*') into the bundler configuration (vite.config.ts).",
      parameters: {
        type: "object",
        properties: {
          alias: { type: "string", description: "Alias prefix (default: '@')." },
          target_path: { type: "string", description: "Target source directory (default: './src')." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "stub_missing_module",
      description: "Creates a safe module stub for an uncommitted component or module that breaks compilation without altering UI intent.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to missing module (e.g. 'src/components/Banner.tsx')." },
          export_type: { type: "string", enum: ["component", "module", "types", "function"], description: "Type of stub to generate." },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "record_knowledge",
      description: "Explicitly records a successful fix pattern or insight into the knowledge base so future runs take the fast path.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Brief summary of the fix" },
          key_insight: { type: "string", description: "The underlying root cause and resolution" },
        },
        required: ["summary"],
        additionalProperties: false,
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { messages = [], model = DEFAULT_MODEL } = body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await gatewayFetch({
      model,
      provider: "google-ai-studio",
      payload: {
        messages,
        tools: REPAIR_TOOLS,
      },
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.warn(`[code-repair-agent] model error ${aiResp.status}:`, errText);
      return new Response(
        JSON.stringify({ error: `Gemini API error ${aiResp.status}`, detail: errText.slice(0, 500) }),
        { status: aiResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await aiResp.json();
    const message = data?.choices?.[0]?.message;
    if (!message) {
      return new Response(JSON.stringify({ error: "No message returned by AI gateway" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

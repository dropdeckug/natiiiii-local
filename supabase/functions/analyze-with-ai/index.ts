import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { gatewayFetch, DEFAULT_MODEL } from "../_shared/aiGateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      fileList,
      indexHtmlContent,
      packageJsonContent,
      viteConfigContent,
      capacitorConfigContent,
      totalFiles,
      totalSize,
      stream,
    } = await req.json();
    if (!Deno.env.get("LOVABLE_API_KEY")) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const projectContext = `## Project Info
- Total files: ${totalFiles || 0}
- Total size: ${totalSize || "unknown"}

## File list (first 60):
${(fileList || []).slice(0, 60).join("\n")}

## index.html content:
\`\`\`html
${indexHtmlContent || "Not found"}
\`\`\`

## package.json content:
\`\`\`json
${packageJsonContent || "Not found"}
\`\`\`

## vite.config content:
\`\`\`ts
${viteConfigContent || "Not found"}
\`\`\`

## capacitor.config content:
\`\`\`ts
${capacitorConfigContent || "Not found"}
\`\`\``;

    // ─── STREAMING MODE: Real-time AI chat analysis ───
    if (stream) {
      const streamPrompt = `You are ForgeAI, a CPR build intelligence engineer analyzing a web project for conversion to a 100% self-contained native mobile app.

Analyze this project step-by-step and write a comprehensive markdown report. Be dynamic and specific about what you find. Use this exact structure:

1. Start with "I'm analyzing your project with CPR Intelligence..." 
2. Then analyze each area with markdown headers and bullet points:
   - **Project Structure & Topology** — file count, folder structure observations
   - **Framework & Dependencies** — detected framework, key dependencies, version info
   - **Self-Contained Dev Server & Redirection Audit** — check for any external dev server redirects (e.g. Laravel localhost:8000, laravel-vite-plugin, hardcoded URLs, server.url) and ensure the dev server points inside the app itself
   - **Build Configuration** — build scripts, output directory, entry points
   - **Compatibility Assessment** — check for native API usage, service workers, SSR concerns
   - **Engine Recommendation** — which engine (Capacitor, WebView, TWA) and why
3. End with a clear verdict: either "Your project looks great! Ready to build." or list specific issues that need fixing.

Be specific with numbers and file names. Use ✅ for passing checks, ⚠️ for warnings, ❌ for blockers.
Write naturally like a knowledgeable engineer explaining findings.

${projectContext}`;

      const response = await gatewayFetch({
        model: DEFAULT_MODEL,
        payload: {
          messages: [
            { role: "user", content: streamPrompt },
          ],
          stream: true,
        },
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await response.text();
        console.error("AI gateway stream error:", status, t);
        return new Response(JSON.stringify({ error: "AI service error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // ─── TOOL-CALL MODE: Structured metadata extraction ───
    const prompt = `Analyze this web project and extract key metadata for converting it into a native mobile/desktop app.

${projectContext}

Based on this project, extract the app metadata and provide your analysis.`;

    const response = await gatewayFetch({
      model: DEFAULT_MODEL,
      payload: {
        messages: [
          {
            role: "system",
            content: `You are a project analyzer for NativeBridge, a platform that converts web projects into native apps. 
You must extract metadata from the project files and provide actionable insights.
Always call the extract_project_metadata tool with your findings.`,
          },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_project_metadata",
              description: "Extract and return structured project metadata from analyzed files.",
              parameters: {
                type: "object",
                properties: {
                  appName: { type: "string", description: "App name extracted from <title> tag, package.json name, or manifest. Use a clean, readable name." },
                  description: { type: "string", description: "App description from meta tags or package.json description. Max 120 chars." },
                  framework: { type: "string", description: "Detected framework (React, Vue, Angular, Svelte, Next.js, plain HTML, etc.)" },
                  packageManager: { type: "string", description: "Detected package manager (npm, yarn, pnpm, bun)" },
                  hasFavicon: { type: "boolean", description: "Whether a favicon/icon file was found in the project" },
                  faviconPath: { type: "string", description: "Path to the favicon/icon file if found (e.g. public/favicon.ico, src/assets/logo.png)" },
                  suggestedEngine: { type: "string", enum: ["capacitor", "webview", "twa", "ionic", "electron"], description: "Best engine recommendation for this project" },
                  engineReason: { type: "string", description: "Brief reason for engine recommendation (1 sentence)" },
                  suggestedPlugins: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of recommended Capacitor plugin IDs based on project code (e.g. camera, geolocation, push-notifications)"
                  },
                  issues: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        severity: { type: "string", enum: ["error", "warning", "info"] },
                        message: { type: "string" },
                        file: { type: "string" }
                      },
                      required: ["severity", "message"]
                    },
                    description: "List of compatibility issues found"
                  },
                  analysisSteps: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        action: { type: "string", description: "Short action title, max 7 words." },
                        finding: { type: "string", description: "Brief finding after this step." }
                      },
                      required: ["action", "finding"]
                    },
                    description: "Step-by-step analysis actions with findings. Generate 5-8 steps."
                  },
                  assurance: { type: "string", enum: ["high", "medium", "low"], description: "Build confidence level" },
                  assuranceMessage: { type: "string", description: "Dynamic message about build readiness. Be specific and encouraging." },
                  buildCommand: { type: "string", description: "Build command (e.g. npm run build)" },
                  outputDir: { type: "string", description: "Build output directory (e.g. dist, build, .next)" },
                  entryPoint: { type: "string", description: "Main entry file path" }
                  ,projectShape: { type: "string", description: "Normalized project shape: vite-spa, react-cra, next-static, next-ssr, angular, vue, svelte, plain-html, monorepo, unknown" }
                  ,isSelfContained: { type: "boolean", description: "Whether the app is self-contained with no external server redirects" }
                  ,devServerRedirectIssues: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of detected external/Laravel dev server redirects or coupling issues"
                  }
                  ,selfContainedRemedies: {
                    type: "array",
                    items: { type: "string" },
                    description: "Remedies applied to make the app 100% self-contained"
                  }
                  ,needsBoilerplate: { type: "boolean", description: "Whether index.html appears to be missing HTML5 boilerplate such as doctype/head/body/viewport" }
                  ,remediationHints: {
                    type: "array",
                    items: { type: "string" },
                    description: "Deterministic build preparation hints such as synthesize package.json, add HTML boilerplate, use dist output, or select a workspace root."
                  }
                },
                required: ["appName", "framework", "suggestedEngine", "engineReason", "assurance", "assuranceMessage", "analysisSteps"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_project_metadata" } },
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const metadata = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(metadata), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "AI did not return structured data" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

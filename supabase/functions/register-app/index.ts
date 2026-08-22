import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function randomDigits(len: number) {
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map((b) => (b % 10).toString()).join("");
}
function randomHex(len: number) {
  return Array.from(crypto.getRandomValues(new Uint8Array(Math.ceil(len / 2))))
    .map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, len);
}
async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { projectSlug, nickname, platform, config } = await req.json();
    if (!projectSlug || !nickname || !platform) {
      return new Response(JSON.stringify({ error: "projectSlug, nickname, platform required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["ios", "android", "web", "desktop", "flutter"].includes(platform)) {
      return new Response(JSON.stringify({ error: "Invalid platform" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: project, error: pErr } = await supabase
      .from("projects").select("id, project_id_slug, user_id")
      .eq("project_id_slug", projectSlug).maybeSingle();
    if (pErr || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (project.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appIdSlug = `1:${randomDigits(6)}:${platform}:${randomHex(6)}`;
    const accessToken = `nbat_${randomHex(32)}`;
    const tokenHash = await sha256(accessToken);

    const { data: projectIndex } = await supabase
      .from("project_index")
      .select("output_dir")
      .eq("project_id", project.id)
      .maybeSingle();
    if (!projectIndex?.output_dir) {
      return new Response(JSON.stringify({ error: "Project source has not been normalized; a web output is required before adding an application" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: app, error: aErr } = await supabase.from("project_apps").insert({
      project_id: project.id,
      user_id: user.id,
      app_id_slug: appIdSlug,
      nickname,
      platform,
      access_token_hash: tokenHash,
      build_output_dir: projectIndex.output_dir,
      webdir: projectIndex.output_dir,
      config: config ?? {},
    }).select("*").single();
    if (aErr) throw aErr;

    const scopedEndpoint = `/v1/projects/${project.project_id_slug}/apps/${appIdSlug}`;

    // Auto-generated config file content per platform
    let configFile: { filename: string; content: string; mime: string } | null = null;
    const base = { project_id: project.project_id_slug, app_id: appIdSlug, nickname };
    if (platform === "android") {
      configFile = {
        filename: "nativebridge-services.json",
        mime: "application/json",
        content: JSON.stringify({ ...base, package_name: config?.packageName, sha1: config?.sha1 ?? null }, null, 2),
      };
    } else if (platform === "ios") {
      configFile = {
        filename: "NativeBridge-Info.plist",
        mime: "application/xml",
        content: `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n  <key>ProjectId</key><string>${project.project_id_slug}</string>\n  <key>AppId</key><string>${appIdSlug}</string>\n  <key>BundleId</key><string>${config?.bundleId ?? ""}</string>\n</dict>\n</plist>`,
      };
    } else if (platform === "web") {
      configFile = {
        filename: "nativebridge-config.js",
        mime: "application/javascript",
        content: `export const nativeBridgeConfig = ${JSON.stringify({ ...base, apiBase: scopedEndpoint }, null, 2)};\n`,
      };
    } else {
      configFile = {
        filename: "nativebridge.json",
        mime: "application/json",
        content: JSON.stringify({ ...base, platform, config: config ?? {} }, null, 2),
      };
    }

    return new Response(JSON.stringify({
      app, appIdSlug, accessToken, scopedEndpoint, configFile,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    console.error("register-app error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

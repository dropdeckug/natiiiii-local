// verify-render edge function
// Records a render-gate result: uploaded screenshot + pass/fail flag.
// Called by the CI job after running .github/scripts/render-check.mjs, or
// by the client to mark a manual verification pass.
//
// Body: { project_id: string, app_id?: string, passed: boolean,
//         screenshot_base64?: string, notes?: any, build_id?: string }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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

    const body = await req.json().catch(() => ({} as any));
    const projectId: string | undefined = body?.project_id;
    const appId: string | null = body?.app_id ?? null;
    const passed: boolean = !!body?.passed;
    const notes = body?.notes ?? null;
    const buildId: string | null = body?.build_id ?? null;
    const screenshotB64: string | undefined = body?.screenshot_base64;

    if (!projectId) {
      return new Response(JSON.stringify({ error: "project_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify project ownership
    const { data: project } = await supabase
      .from("projects").select("id, user_id").eq("id", projectId).maybeSingle();
    if (!project || project.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let screenshotUrl: string | null = null;
    if (screenshotB64) {
      const bytes = b64ToBytes(screenshotB64);
      const path = `${user.id}/${projectId}/renders/${Date.now()}.png`;
      const { error: upErr } = await supabase.storage
        .from("project-files")
        .upload(path, bytes, { contentType: "image/png", upsert: true });
      if (upErr) throw upErr;
      screenshotUrl = path;
    }

    // Insert history row
    await supabase.from("project_render_checks").insert({
      project_id: projectId,
      app_id: appId,
      user_id: user.id,
      passed,
      screenshot_url: screenshotUrl,
      notes,
      build_id: buildId,
    });

    // Update rolling index status
    await supabase.from("project_index").update({
      render_verified: passed,
      render_screenshot_url: screenshotUrl,
      render_checked_at: new Date().toISOString(),
    }).eq("project_id", projectId);

    // Update per-app render status when provided
    if (appId) {
      await supabase.from("project_apps").update({
        render_verified: passed,
        render_screenshot_url: screenshotUrl,
      }).eq("id", appId);
    }

    return new Response(JSON.stringify({ ok: true, passed, screenshot_url: screenshotUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    console.error("verify-render error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

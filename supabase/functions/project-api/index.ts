import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // Drop the function name prefix; keep the rest as /v1/projects/...
    const segs = url.pathname.split("/").filter(Boolean);
    const i = segs.indexOf("v1");
    const parts = i >= 0 ? segs.slice(i) : segs;

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    // parts: ["v1","projects",":slug", ...]
    if (parts[0] !== "v1" || parts[1] !== "projects" || !parts[2]) {
      return json({ error: "Not found" }, 404);
    }
    const slug = parts[2];
    const { data: project } = await supabase
      .from("projects").select("*").eq("project_id_slug", slug).maybeSingle();
    if (!project) return json({ error: "Project not found" }, 404);

    // GET /v1/projects/:slug
    if (parts.length === 3 && req.method === "GET") {
      return json({ data: project });
    }
    // GET /v1/projects/:slug/config
    if (parts[3] === "config" && parts.length === 4) {
      if (req.method === "GET") {
        const { data } = await supabase.from("project_configs").select("*").eq("project_id", project.id).maybeSingle();
        return json({ data });
      }
      if (req.method === "PATCH") {
        const body = await req.json();
        const { data, error } = await supabase.from("project_configs")
          .update(body).eq("project_id", project.id).select().maybeSingle();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      }
    }
    // GET /v1/projects/:slug/apps
    if (parts[3] === "apps" && parts.length === 4 && req.method === "GET") {
      const { data } = await supabase.from("project_apps").select("*").eq("project_id", project.id);
      return json({ data });
    }
    // GET /v1/projects/:slug/apps/:appId
    if (parts[3] === "apps" && parts[4] && parts.length === 5 && req.method === "GET") {
      const { data } = await supabase.from("project_apps")
        .select("*").eq("project_id", project.id).eq("app_id_slug", parts[4]).maybeSingle();
      if (!data) return json({ error: "App not found" }, 404);
      return json({ data });
    }
    // POST /v1/projects/:slug/apps/:appId/token (rotate)
    if (parts[3] === "apps" && parts[4] && parts[5] === "token" && req.method === "POST") {
      const newToken = `nbat_${Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b=>b.toString(16).padStart(2,"0")).join("")}`;
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(newToken));
      const hash = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
      const { error } = await supabase.from("project_apps")
        .update({ access_token_hash: hash })
        .eq("project_id", project.id).eq("app_id_slug", parts[4]);
      if (error) return json({ error: error.message }, 400);
      return json({ data: { accessToken: newToken } });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    console.error("project-api error", message);
    return json({ error: message }, 500);
  }
});

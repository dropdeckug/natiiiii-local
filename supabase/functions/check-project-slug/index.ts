import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const raw = url.searchParams.get("slug") || "";
    const slug = slugify(raw);

    if (slug.length < 2) {
      return new Response(JSON.stringify({ available: false, slug, reason: "too_short" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existing } = await supabase
      .from("projects")
      .select("id")
      .eq("project_id_slug", slug)
      .maybeSingle();

    if (!existing) {
      return new Response(JSON.stringify({ available: true, slug }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Suggest a free variant
    let suggestion = slug;
    for (let i = 2; i < 30; i++) {
      const candidate = `${slug}-${i}`;
      const { data } = await supabase
        .from("projects")
        .select("id")
        .eq("project_id_slug", candidate)
        .maybeSingle();
      if (!data) { suggestion = candidate; break; }
    }

    return new Response(JSON.stringify({ available: false, slug, suggestion }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

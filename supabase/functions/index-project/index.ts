// Deno edge function: index-project
// Downloads latest project source zip from storage, runs deterministic
// projectIndexer, and upserts row into public.project_index.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import JSZip from "https://esm.sh/jszip@3.10.1";
import {
  planProjectGrounding,
  type ProjectFile,
} from "../_shared/projectIndexer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TEXT_EXT = /\.(json|js|jsx|ts|tsx|mjs|cjs|html|htm|css|scss|md|txt|xml|svg|yml|yaml|env|gitignore|npmrc|toml|lock)$/i;

async function zipToFiles(blob: Blob): Promise<ProjectFile[]> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const files: ProjectFile[] = [];
  const entries = Object.values(zip.files) as any[];
  for (const entry of entries) {
    if (entry.dir) continue;
    const path = entry.name.replace(/^\/+/, "");
    const isText = TEXT_EXT.test(path);
    if (isText) {
      const content = await entry.async("string");
      files.push({ path, type: "file", content, size: content.length });
    } else {
      files.push({ path, type: "file", isBinary: true, size: 0 });
    }
  }
  return files;
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

    const body = await req.json().catch(() => ({}));
    const projectId: string | undefined = body?.project_id ?? body?.projectId;
    if (!projectId) {
      return new Response(JSON.stringify({ error: "project_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch project + latest snapshot to locate zip
    const { data: project, error: pErr } = await supabase
      .from("projects").select("id, name, user_id, source_url").eq("id", projectId).maybeSingle();
    if (pErr || !project) throw new Error(pErr?.message || "Project not found");
    if (project.user_id !== user.id) throw new Error("Forbidden");

    const { data: snapshot } = await supabase
      .from("project_snapshots")
      .select("id, storage_path")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const storagePath = snapshot?.storage_path || project.source_url;
    let files: ProjectFile[] = [];
    if (storagePath) {
      const { data: blob, error: dlErr } = await supabase.storage
        .from("project-files").download(storagePath);
      if (dlErr) console.warn("[index-project] download failed:", dlErr.message);
      if (blob) files = await zipToFiles(blob);
    }

    if (!files.length) {
      return new Response(JSON.stringify({ error: "Project source was not persisted; upload or reconnect the source before indexing" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: savedSource } = await supabase.from("project_sources")
      .select("app_root")
      .eq("project_id", projectId)
      .maybeSingle();
    const { index, patches, logs } = planProjectGrounding(files, project.name || "App", {
      preferredRoot: savedSource?.app_root || undefined,
    });
    if (!index.entryHtml || !index.outputDir) {
      return new Response(JSON.stringify({ error: "No valid web entry point/output could be resolved from project source" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const row = {
      project_id: projectId,
      user_id: user.id,
      shape: index.shape,
      framework: index.framework,
      package_manager: index.packageManager,
      project_root: index.projectRoot,
      entry_html: index.entryHtml,
      has_package_json: index.hasPackageJson,
      has_build_script: index.hasBuildScript,
      build_command: index.buildCommand,
      output_dir: index.outputDir || (index.shape === "plain-html" ? "www" : "dist"),
      dependencies: index.dependencies,
      dev_dependencies: index.devDependencies,
      remediations: index.remediations,
      warnings: index.warnings,
      indexed_at: new Date().toISOString(),
    };

    const { error: upErr } = await supabase
      .from("project_index")
      .upsert(row, { onConflict: "project_id" });
    if (upErr) throw upErr;

    await supabase.from("project_sources").update({
      app_root: index.projectRoot || null,
      build_command: index.buildCommand,
      output_dir: index.outputDir,
      scan_result: index,
    }).eq("project_id", projectId);
    await supabase.from("project_apps").update({
      build_output_dir: row.output_dir,
      webdir: row.output_dir,
    }).eq("project_id", projectId);

    if (snapshot?.id) {
      await supabase.from("project_snapshots")
        .update({ project_shape: index.shape })
        .eq("id", snapshot.id);
    }

    return new Response(JSON.stringify({
      ok: true, index, patches: patches.map(p => ({ path: p.path, reason: p.reason })), logs,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    console.error("index-project error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

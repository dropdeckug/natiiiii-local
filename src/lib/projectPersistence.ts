/**
 * Project Persistence Layer
 * Handles saving/loading project source code and snapshots to/from Supabase Storage.
 * Also runs deterministic grounding before persisting so the same file layout is
 * indexed in project_index for the dashboard and build pipeline to use.
 */

import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";
import type { ProjectFile } from "@/stores/projectStore";
import { indexProject, planProjectGrounding } from "@/lib/tools/projectIndexer";

export interface ProjectSnapshot {
  id: string;
  project_id: string;
  user_id: string;
  file_hash: string;
  file_count: number;
  size_kb: number;
  plugin_state: string[];
  config_state: Record<string, unknown>;
  storage_path: string;
  created_at: string;
}

/** Compute a simple hash of project files for diffing */
export function computeFileHash(files: ProjectFile[]): string {
  const flat = flattenForHash(files);
  const content = flat.map(f => `${f.path}:${f.size || 0}`).join("|");
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const chr = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function flattenForHash(files: ProjectFile[]): ProjectFile[] {
  const result: ProjectFile[] = [];
  const walk = (nodes: ProjectFile[]) => {
    for (const node of nodes) {
      if (node.type === "file") result.push(node);
      if (node.children) walk(node.children);
    }
  };
  walk(files);
  return result;
}

/** Bundle project files into a ZIP blob */
export async function filesToZip(files: ProjectFile[]): Promise<Blob> {
  const zip = new JSZip();
  const addFiles = (nodes: ProjectFile[]) => {
    for (const node of nodes) {
      if (node.type === "file") {
        if (node.isBinary && node.binaryContent) {
          zip.file(node.path, node.binaryContent);
        } else if (node.content) {
          zip.file(node.path, node.content);
        }
      }
      if (node.children) addFiles(node.children);
    }
  };
  addFiles(files);
  return zip.generateAsync({ type: "blob" });
}

/** Save project source to Supabase Storage + create snapshot record + upsert index */
export async function persistProject(
  projectId: string,
  files: ProjectFile[],
  plugins: string[],
  config: Record<string, unknown> = {},
  appName = "App",
): Promise<ProjectSnapshot | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const userId = session.user.id;
  const storagePath = `${userId}/${projectId}/source.zip`;

  // 1. Run deterministic grounding — apply patches (package.json for static HTML,
  // HTML5 boilerplate repair) before we zip so the persisted source is buildable.
  let groundedFiles = files;
  let index: ReturnType<typeof planProjectGrounding>["index"] | null = null;
  try {
    const grounding = planProjectGrounding(files, appName);
    index = grounding.index;
    if (grounding.patches.length > 0) {
      // Overwrite / add patched files at project root.
      const patchMap = new Map(grounding.patches.map((p) => [p.path, p.content]));
      const applyPatches = (nodes: ProjectFile[]): ProjectFile[] =>
        nodes.map((n) => {
          if (n.type === "file" && patchMap.has(n.path)) {
            const content = patchMap.get(n.path)!;
            patchMap.delete(n.path);
            return { ...n, content, size: content.length, isBinary: false };
          }
          if (n.children) return { ...n, children: applyPatches(n.children) };
          return n;
        });
      groundedFiles = applyPatches(files);
      // Append any brand-new files.
      for (const [path, content] of patchMap.entries()) {
        groundedFiles.push({ path, type: "file", content, size: content.length } as ProjectFile);
      }
      index = indexProject(groundedFiles);
    }
    if (index?.isStaticHtml) {
      const prefix = index.projectRoot ? `${index.projectRoot}/` : "";
      const existingPaths = new Set(flattenForHash(groundedFiles).map((f) => f.path));
      const binaryCopies = flattenForHash(groundedFiles)
        .filter((f) => {
          if (!f.isBinary || (prefix && !f.path.startsWith(prefix))) return false;
          const relative = prefix ? f.path.slice(prefix.length) : f.path;
          const top = relative.split("/")[0];
          return relative.length > 0 && !["www", "dist", "build", "android", "ios", "node_modules", ".git"].includes(top) && !top.startsWith(".");
        })
        .map((f) => {
          const relative = prefix ? f.path.slice(prefix.length) : f.path;
          return { ...f, path: `${prefix}www/${relative}` };
        })
        .filter((f) => !existingPaths.has(f.path));
      groundedFiles = [...groundedFiles, ...binaryCopies];
    }
  } catch (err) {
    console.error("[persistProject] grounding failed:", err);
    return null;
  }

  const expectedEntry = index ? `${index.projectRoot ? `${index.projectRoot}/` : ""}${index.outputDir}/index.html` : "";
  const hasExpectedEntry = flattenForHash(groundedFiles).some((f) => f.path === expectedEntry);
  if (!index?.entryHtml || !index.outputDir || (index.isStaticHtml && !hasExpectedEntry)) {
    console.error("[persistProject] source has no valid web entry/output");
    return null;
  }

  const zipBlob = await filesToZip(groundedFiles);
  const flat = flattenForHash(groundedFiles);
  const fileHash = computeFileHash(groundedFiles);
  const sizeKB = Math.round(zipBlob.size / 1024 * 10) / 10;

  const { error: uploadError } = await supabase.storage
    .from("project-files")
    .upload(storagePath, zipBlob, { upsert: true });

  if (uploadError) {
    console.error("Failed to upload project files:", uploadError);
    return null;
  }

  await supabase.from("projects").update({ source_url: storagePath }).eq("id", projectId);

  const { data: snapshot, error: snapshotError } = await supabase
    .from("project_snapshots")
    .insert([{
      project_id: projectId,
      user_id: userId,
      file_hash: fileHash,
      file_count: flat.length,
      size_kb: sizeKB,
      plugin_state: plugins as unknown as import("@/integrations/supabase/types").Json,
      config_state: config as unknown as import("@/integrations/supabase/types").Json,
      storage_path: storagePath,
      project_shape: index?.shape ?? null,
      render_verified: false,
    }])
    .select()
    .single();

  if (snapshotError) {
    console.error("Failed to create snapshot:", snapshotError);
    return null;
  }

  // 2. Upsert project_index so the dashboard scan-on-open finds a fresh row.
  if (index) {
    try {
      await supabase.from("project_index").upsert({
        project_id: projectId,
        user_id: userId,
        shape: index.shape,
        framework: index.framework,
        package_manager: index.packageManager,
        project_root: index.projectRoot,
        entry_html: index.entryHtml,
        has_package_json: index.hasPackageJson,
        has_build_script: index.hasBuildScript,
        build_command: index.buildCommand,
        output_dir: index.outputDir,
        dependencies: index.dependencies as unknown as import("@/integrations/supabase/types").Json,
        dev_dependencies: index.devDependencies as unknown as import("@/integrations/supabase/types").Json,
        remediations: index.remediations as unknown as import("@/integrations/supabase/types").Json,
        warnings: index.warnings as unknown as import("@/integrations/supabase/types").Json,
        indexed_at: new Date().toISOString(),
      }, { onConflict: "project_id" });
      await supabase.from("project_sources").update({
        app_root: index.projectRoot || null,
        build_command: index.buildCommand,
        output_dir: index.outputDir,
        scan_result: index as unknown as import("@/integrations/supabase/types").Json,
      }).eq("project_id", projectId);
    } catch (indexErr) {
      console.warn("[persistProject] project_index upsert failed:", indexErr);
    }
  }

  return snapshot as unknown as ProjectSnapshot;
}

/** Get latest snapshot for a project */
export async function getLatestSnapshot(projectId: string): Promise<ProjectSnapshot | null> {
  const { data } = await supabase
    .from("project_snapshots")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as unknown as ProjectSnapshot | null;
}

/** Download and parse project ZIP from storage */
export async function loadProjectFromStorage(storagePath: string): Promise<Blob | null> {
  // Try project-files bucket first, then build-artifacts as fallback
  let result = await supabase.storage.from("project-files").download(storagePath);
  
  if (result.error) {
    // Fallback: try build-artifacts bucket (legacy)
    result = await supabase.storage.from("build-artifacts").download(storagePath);
  }

  if (result.error || !result.data) {
    console.error("Failed to download project:", result.error);
    return null;
  }

  return result.data;
}

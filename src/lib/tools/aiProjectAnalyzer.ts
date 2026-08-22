/**
 * Unzips a project upload and asks the AI gateway (analyze-with-ai) for
 * structured framework / build / engine / plugin metadata — the same
 * pipeline used by the Build flow, so the wizard's results are equally good.
 */
import JSZip from "jszip";
import { discoverProjectEntries, indexProject, type ProjectEntryCandidate } from "@/lib/tools/projectIndexer";

const ANALYZE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-with-ai`;

export interface AIProjectMetadata {
  appName: string;
  description?: string;
  framework: string;
  packageManager?: string;
  hasFavicon?: boolean;
  faviconPath?: string;
  suggestedEngine: string;
  engineReason?: string;
  suggestedPlugins?: string[];
  issues?: { severity: string; message: string; file?: string }[];
  analysisSteps?: { action: string; finding: string }[];
  assurance: "high" | "medium" | "low";
  assuranceMessage: string;
  buildCommand?: string;
  outputDir?: string;
  entryPoint?: string;
  projectShape?: string;
  needsBoilerplate?: boolean;
  remediationHints?: string[];
  entryCandidates: ProjectEntryCandidate[];
  sourceBlocker?: string;
}

interface AnalyzeInputs {
  fileList: string[];
  indexHtmlContent: string | null;
  packageJsonContent: string | null;
  totalFiles: number;
  totalSize: string;
  entryCandidates: ProjectEntryCandidate[];
  sourceBlocker?: string;
}

async function readZip(file: File): Promise<AnalyzeInputs> {
  const zip = await JSZip.loadAsync(file);
  const fileList: string[] = [];
  let packageJsonContent: string | null = null;
  let indexHtmlContent: string | null = null;
  let totalBytes = 0;
  const reads: Promise<void>[] = [];
  const projectFiles: { path: string; type: "file"; content?: string }[] = [];

  zip.forEach((relativePath, entry) => {
    if (entry.dir) return;
    if (relativePath.includes("node_modules/") || relativePath.includes("__MACOSX")) return;
    if (relativePath.split("/").some((p) => p === ".DS_Store")) return;

    fileList.push(relativePath);
    totalBytes += (entry as any)._data?.uncompressedSize ?? 0;

    const lower = relativePath.toLowerCase();
    if (lower.endsWith("/package.json") || lower === "package.json") {
      reads.push(entry.async("string").then((c) => { if (!packageJsonContent) packageJsonContent = c; projectFiles.push({ path: relativePath, type: "file", content: c }); }));
    }
    const isBuildDescriptor = lower === "pom.xml" || lower.endsWith("/pom.xml")
      || lower === "build.gradle" || lower.endsWith("/build.gradle")
      || lower === "build.gradle.kts" || lower.endsWith("/build.gradle.kts");
    if (isBuildDescriptor) {
      reads.push(entry.async("string").then((c) => { projectFiles.push({ path: relativePath, type: "file", content: c }); }));
    }
    if (lower.endsWith("/index.html") || lower === "index.html") {
      reads.push(entry.async("string").then((c) => { if (!indexHtmlContent) indexHtmlContent = c; projectFiles.push({ path: relativePath, type: "file", content: c }); }));
    }
    if (!lower.endsWith("/package.json") && lower !== "package.json" && !lower.endsWith("/index.html") && lower !== "index.html" && !isBuildDescriptor) {
      projectFiles.push({ path: relativePath, type: "file" });
    }
  });

  await Promise.all(reads);

  const totalSize = totalBytes > 1024 * 1024
    ? `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
    : `${(totalBytes / 1024).toFixed(1)} KB`;

  const entryCandidates = discoverProjectEntries(projectFiles);
  const sourceIndex = indexProject(projectFiles);
  const sourceBlocker = entryCandidates.length === 0 ? sourceIndex.staticBlockers[0] : undefined;
  return { fileList, indexHtmlContent, packageJsonContent, totalFiles: fileList.length, totalSize, entryCandidates, sourceBlocker };
}

export async function analyzeUploadWithAI(file: File): Promise<AIProjectMetadata> {
  const inputs = await readZip(file);
  return callAnalyze(inputs);
}

export async function analyzeGitRepoWithAI(opts: {
  fileList: string[];
  packageJsonContent: string | null;
  indexHtmlContent: string | null;
}): Promise<AIProjectMetadata> {
  return callAnalyze({
    fileList: opts.fileList,
    packageJsonContent: opts.packageJsonContent,
    indexHtmlContent: opts.indexHtmlContent,
    totalFiles: opts.fileList.length,
    totalSize: `${opts.fileList.length} files`,
    entryCandidates: discoverProjectEntries(opts.fileList.map((path) => ({ path, type: "file" as const }))),
  });
}

async function callAnalyze(inputs: AnalyzeInputs): Promise<AIProjectMetadata> {
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const resp = await fetch(ANALYZE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      apikey: key,
    },
    body: JSON.stringify(inputs),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    let detail = t.slice(0, 240);
    try {
      const j = JSON.parse(t);
      if (j?.error) detail = typeof j.error === "string" ? j.error : JSON.stringify(j.error);
    } catch { /* ignore */ }
    throw new Error(`AI analysis failed (${resp.status}): ${detail}`);
  }
  const metadata = await resp.json();
  const selected = inputs.entryCandidates[0];
  return {
    ...metadata,
    entryCandidates: inputs.entryCandidates,
    sourceBlocker: inputs.sourceBlocker,
    framework: selected?.framework || metadata.framework || "unknown",
    buildCommand: selected?.buildCommand || metadata.buildCommand || "npm run build",
    outputDir: selected?.outputDir || metadata.outputDir || "dist",
    entryPoint: selected?.entryHtml || metadata.entryPoint || null,
  };
}

export const frameworkIconFor = (framework: string): string => {
  const f = (framework || "").toLowerCase();
  if (f.includes("next")) return "next";
  if (f.includes("nuxt")) return "nuxt";
  if (f.includes("svelte")) return "svelte";
  if (f.includes("vue")) return "vue";
  if (f.includes("angular")) return "angular";
  if (f.includes("react")) return "react";
  if (f.includes("vite")) return "vite";
  if (f.includes("plain html") || f === "html" || f === "static") return "html";
  return "unknown";
};

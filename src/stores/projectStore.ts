import { create } from "zustand";
import JSZip from "jszip";
import { persistProject, loadProjectFromStorage, getLatestSnapshot, type ProjectSnapshot } from "@/lib/projectPersistence";
import { validateProjectForBuild } from "@/lib/tools/projectValidator";
import { planProjectGrounding } from "@/lib/tools/projectIndexer";
import { sortProjectTree } from "@/lib/files/sortTree";
import { resolvePluginDependencies } from "@/lib/plugins/dependencies";

import { toast } from "sonner";

export interface ProjectFile {
  id: string;
  name: string;
  path: string;
  type: "folder" | "file";
  extension?: string;
  content?: string;
  binaryContent?: ArrayBuffer;
  isBinary?: boolean;
  children?: ProjectFile[];
  size?: number;
}

interface ScanIssue {
  file: string;
  line?: number;
  severity: "error" | "warning" | "info";
  message: string;
}

export interface PendingChange {
  id: string;
  type: "plugin_added" | "plugin_removed" | "config_changed" | "source_edited" | "appearance_changed";
  label: string;
  pluginId?: string;
  timestamp: number;
}

interface ScanResult {
  framework: string;
  packageManager: string;
  buildCommand: string;
  outputDir: string;
  entryPoint: string;
  totalFiles: number;
  totalSize: string;
  issues: ScanIssue[];
  dependencies: string[];
  connectivity: { from: string; to: string }[];
  assurance: "high" | "medium" | "low";
  assuranceMessage: string;
}

interface ProjectStore {
  /** Id of the project currently displayed in the dashboard. All in-memory state below belongs to this project. */
  currentProjectId: string | null;
  files: ProjectFile[];
  openFile: ProjectFile | null;
  scanResult: ScanResult | null;
  isScanning: boolean;
  isBuildMode: boolean;
  selectedEngine: string;
  enabledPlugins: Set<string>;
  buildAppName: string;
  buildPackageName: string;
  pendingChanges: PendingChange[];
  // GitHub repo build fields
  repoUrl: string;
  repoBranch: string;
  repoConnected: boolean;
  githubAccessToken: string;
  githubUser: { login: string; avatar_url: string; name: string | null } | null;

  /** Switch the active project. Resets ALL per-project in-memory state to defaults so the new project starts fresh. Pass null on unmount. */
  setCurrentProject: (projectId: string | null) => void;
  setFiles: (files: ProjectFile[]) => void;
  setOpenFile: (file: ProjectFile | null) => void;
  setScanResult: (result: ScanResult | null) => void;
  setIsScanning: (val: boolean) => void;
  setIsBuildMode: (val: boolean) => void;
  setSelectedEngine: (engine: string) => void;
  setEnabledPlugins: (plugins: Set<string>) => void;
  togglePlugin: (pluginId: string) => void;
  setBuildAppName: (name: string) => void;
  setBuildPackageName: (name: string) => void;
  setRepoUrl: (url: string) => void;
  setRepoBranch: (branch: string) => void;
  setRepoConnected: (val: boolean) => void;
  setGithubAccessToken: (token: string) => void;
  setGithubUser: (user: { login: string; avatar_url: string; name: string | null } | null) => void;
  updateFileContent: (path: string, content: string) => void;
  /** Add a new file to the tree at `path`. Creates intermediate folders. */
  addFile: (path: string, content: string) => void;
  /** Remove a file from the tree by path. */
  removeFile: (path: string) => void;
  /** Merge a flat list of files into the existing tree. Used to inject GitHub-installed assets (android/, package-lock.json) back into the platform's code view. */
  mergeFiles: (incoming: { path: string; content?: string; binaryContent?: ArrayBuffer; isBinary?: boolean }[]) => void;
  /** Map of path → original content captured *before* the AI/build pipeline modified it. Drives red/green diff highlighting in the editor. */
  aiChangedFiles: Record<string, string>;
  /** Mark a file as AI-changed, capturing its previous content if not already tracked. */
  markAiChanged: (path: string, originalContent: string) => void;
  /** Clear all AI-change diff markers (e.g. after the user has reviewed them). */
  clearAiChanges: () => void;
  loadFromZip: (file: File) => Promise<void>;
  addPendingChange: (change: Omit<PendingChange, "id" | "timestamp">) => void;
  clearPendingChanges: () => void;
  /** Persist current project state to Supabase */
  persistToCloud: (projectId: string) => Promise<ProjectSnapshot | null>;
  /** Hydrate project files from Supabase storage */
  hydrateFromCloud: (projectId: string) => Promise<boolean>;
  /** Get latest snapshot metadata */
  getLatestSnapshot: (projectId: string) => Promise<ProjectSnapshot | null>;
}

let fileIdCounter = 0;
const nextId = () => String(++fileIdCounter);

const getExtension = (name: string) => {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : undefined;
};

const buildTree = (entries: { path: string; content: string; size: number; binaryContent?: ArrayBuffer; isBinary?: boolean }[]): ProjectFile[] => {
  const root: ProjectFile[] = [];
  const map = new Map<string, ProjectFile>();

  // Sort entries so folders come first
  entries.sort((a, b) => a.path.localeCompare(b.path));

  for (const entry of entries) {
    const parts = entry.path.split("/").filter(Boolean);
    let currentLevel = root;
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath += (currentPath ? "/" : "") + part;
      const isFile = i === parts.length - 1;

      if (!map.has(currentPath)) {
        const node: ProjectFile = {
          id: nextId(),
          name: part,
          path: currentPath,
          type: isFile ? "file" : "folder",
          extension: isFile ? getExtension(part) : undefined,
          content: isFile ? entry.content : undefined,
          binaryContent: isFile ? entry.binaryContent : undefined,
          isBinary: isFile ? entry.isBinary : undefined,
          size: isFile ? entry.size : undefined,
          children: isFile ? undefined : [],
        };
        map.set(currentPath, node);
        currentLevel.push(node);
      }

      const node = map.get(currentPath)!;
      if (!isFile) {
        currentLevel = node.children!;
      }
    }
  }

  return sortProjectTree(root);
};

const detectFramework = (files: ProjectFile[]): Partial<ScanResult> => {
  const allFiles = flattenFiles(files);
  const packageJsonFile = allFiles.find((f) => f.name === "package.json");

  let framework = "Unknown";
  let packageManager = "npm";
  let buildCommand = "npm run build";
  let outputDir = "dist/";
  let dependencies: string[] = [];

  if (!packageJsonFile?.content) {
    // Plain-HTML project: grounding copies assets into www/ (Capacitor webDir).
    const hasHtml = allFiles.some((f) => f.name === "index.html");
    if (hasHtml) {
      framework = "Static HTML";
      outputDir = "www/";
    }
  }

  if (packageJsonFile?.content) {
    try {
      const pkg = JSON.parse(packageJsonFile.content);
      dependencies = Object.keys(pkg.dependencies || {});
      const devDeps = Object.keys(pkg.devDependencies || {});

      if (dependencies.includes("react") || devDeps.includes("react")) {
        if (devDeps.includes("vite")) framework = "React (Vite)";
        else if (devDeps.includes("next")) { framework = "Next.js"; outputDir = ".next/"; }
        else framework = "React (CRA)";
      } else if (dependencies.includes("vue")) {
        framework = devDeps.includes("vite") ? "Vue (Vite)" : "Vue";
      } else if (dependencies.includes("@angular/core")) {
        framework = "Angular";
        outputDir = "dist/";
      } else if (dependencies.includes("svelte")) {
        framework = "Svelte";
      }

      if (pkg.scripts?.build) buildCommand = `npm run build`;
    } catch {}
  }

  // Detect package manager
  if (allFiles.some((f) => f.name === "yarn.lock")) packageManager = "yarn";
  else if (allFiles.some((f) => f.name === "pnpm-lock.yaml")) packageManager = "pnpm";
  else if (allFiles.some((f) => f.name === "bun.lockb")) packageManager = "bun";

  const entryPoint = allFiles.find((f) => f.name === "index.html")?.path || "index.html";

  return { framework, packageManager, buildCommand, outputDir, entryPoint, dependencies };
};

const analyzeConnectivity = (files: ProjectFile[]): { from: string; to: string }[] => {
  const allFiles = flattenFiles(files);
  const connections: { from: string; to: string }[] = [];
  const importRegex = /(?:import|from|require)\s*[\('"]\s*['".]?([^'")\s]+)['")\s]/g;

  for (const file of allFiles) {
    if (!file.content || !["ts", "tsx", "js", "jsx", "vue", "svelte"].includes(file.extension || "")) continue;

    let match;
    while ((match = importRegex.exec(file.content)) !== null) {
      const importPath = match[1];
      if (!importPath) continue;
      if (importPath.startsWith(".")) {
        // Resolve relative import
        const target = allFiles.find(
          (f) =>
            f.path.includes(importPath.replace("./", "").replace("../", "")) ||
            f.path.includes(importPath.replace("./", "").replace("../", "") + ".tsx") ||
            f.path.includes(importPath.replace("./", "").replace("../", "") + ".ts")
        );
        if (target) {
          connections.push({ from: file.path, to: target.path });
        }
      }
    }
  }

  return connections;
};

const analyzeIssues = (files: ProjectFile[]): ScanIssue[] => {
  const allFiles = flattenFiles(files);
  const issues: ScanIssue[] = [];

  for (const file of allFiles) {
    if (!file.content) continue;
    const lines = file.content.split("\n");

    lines.forEach((line, idx) => {
      // Check for console.log in production code
      if (line.includes("console.log") && !file.path.includes("test")) {
        issues.push({ file: file.path, line: idx + 1, severity: "info", message: "console.log found — remove for production" });
      }
      // Check for TODO comments
      if (line.includes("TODO") || line.includes("FIXME")) {
        issues.push({ file: file.path, line: idx + 1, severity: "warning", message: `Unresolved ${line.includes("TODO") ? "TODO" : "FIXME"} comment` });
      }
      // Check for hardcoded localhost
      if (line.includes("localhost") || line.includes("127.0.0.1")) {
        issues.push({ file: file.path, line: idx + 1, severity: "error", message: "Hardcoded localhost — will fail in mobile app" });
      }
      // Check for missing alt attributes
      if (line.includes("<img") && !line.includes("alt=")) {
        issues.push({ file: file.path, line: idx + 1, severity: "warning", message: "Image missing alt attribute" });
      }
    });

    // Check file size
    if (file.content.length > 50000) {
      issues.push({ file: file.path, severity: "warning", message: `Large file (${(file.content.length / 1024).toFixed(0)} KB) — may impact build time` });
    }
  }

  return issues;
};

const flattenFiles = (files: ProjectFile[]): ProjectFile[] => {
  const result: ProjectFile[] = [];
  const walk = (nodes: ProjectFile[]) => {
    for (const node of nodes) {
      result.push(node);
      if (node.children) walk(node.children);
    }
  };
  walk(files);
  return result;
};

const computeAssurance = (issues: ScanIssue[], framework: string): { assurance: "high" | "medium" | "low"; assuranceMessage: string } => {
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;

  if (errors > 3) return { assurance: "low", assuranceMessage: `${errors} critical issues found. Build may fail or produce a broken app.` };
  if (errors > 0 || warnings > 5) return { assurance: "medium", assuranceMessage: `${errors} errors and ${warnings} warnings found. Review before building.` };
  if (framework === "Unknown") return { assurance: "medium", assuranceMessage: "Framework not detected. Ensure project has a valid build setup." };
  return { assurance: "high", assuranceMessage: `${framework} project detected. Code looks healthy and ready to build.` };
};

const DEFAULT_PACKAGE_NAME = "com.nativebridge.app";

const inferPackageNameFromFiles = (files: ProjectFile[]): string | null => {
  const allFiles = flattenFiles(files);
  for (const file of allFiles) {
    if (!file.content || file.isBinary) continue;
    if (file.name === "capacitor.config.ts" || file.name === "capacitor.config.json") {
      const match = file.content.match(/appId\s*[:=]\s*["']([^"']+)["']/);
      if (match?.[1]) return match[1];
    }
    if (file.path.endsWith("AndroidManifest.xml")) {
      const match = file.content.match(/package=["']([^"']+)["']/);
      if (match?.[1]) return match[1];
    }
    if (file.path.endsWith("build.gradle") || file.path.endsWith("build.gradle.kts")) {
      const match = file.content.match(/applicationId\s+["']([^"']+)["']/);
      if (match?.[1]) return match[1];
    }
  }
  return null;
};

export const useProjectStore = create<ProjectStore>((set, get) => ({
  currentProjectId: null,
  files: [],
  openFile: null,
  scanResult: null,
  isScanning: false,
  isBuildMode: false,
  selectedEngine: "webview",
  enabledPlugins: new Set<string>(),
  buildAppName: "MyApp",
  buildPackageName: DEFAULT_PACKAGE_NAME,
  pendingChanges: [],
  repoUrl: "",
  repoBranch: "main",
  repoConnected: false,
  githubAccessToken: localStorage.getItem("github_access_token") || "",
  githubUser: JSON.parse(localStorage.getItem("github_user") || "null"),
  aiChangedFiles: {},

  markAiChanged: (path, originalContent) =>
    set((state) =>
      state.aiChangedFiles[path] !== undefined
        ? state
        : { aiChangedFiles: { ...state.aiChangedFiles, [path]: originalContent } }
    ),
  clearAiChanges: () => set({ aiChangedFiles: {} }),

  setCurrentProject: (projectId) => {
    if (get().currentProjectId === projectId) return;
    set({
      currentProjectId: projectId,
      files: [],
      openFile: null,
      scanResult: null,
      isScanning: false,
      isBuildMode: false,
      selectedEngine: "webview",
      enabledPlugins: new Set<string>(),
      buildAppName: "MyApp",
      buildPackageName: DEFAULT_PACKAGE_NAME,
      pendingChanges: [],
      aiChangedFiles: {},
      repoUrl: "",
      repoBranch: "main",
      repoConnected: false,
    });
  },

  setFiles: (files) => set({ files }),
  setOpenFile: (file) => set({ openFile: file }),
  setScanResult: (result) => set({ scanResult: result }),
  setIsScanning: (val) => set({ isScanning: val }),
  setIsBuildMode: (val) => set({ isBuildMode: val }),
  setSelectedEngine: (engine) => set({ selectedEngine: engine }),
  setEnabledPlugins: (plugins) => set({ enabledPlugins: plugins }),
  togglePlugin: (pluginId) => {
    const current = new Set(get().enabledPlugins);
    if (current.has(pluginId)) {
      current.delete(pluginId);
    } else {
      current.add(pluginId);
      // Plugins that lean on others (edge-to-edge → status-bar, OAuth → browser)
      // are switched on automatically so the first build never fails on a
      // missing dependency.
      for (const dep of resolvePluginDependencies([pluginId]).ids) current.add(dep);
    }
    set({ enabledPlugins: current });
  },

  setBuildAppName: (name) => set({ buildAppName: name }),
  setBuildPackageName: (name) => set({ buildPackageName: name }),
  setRepoUrl: (url) => set({ repoUrl: url }),
  setRepoBranch: (branch) => set({ repoBranch: branch }),
  setRepoConnected: (val) => set({ repoConnected: val }),
  setGithubAccessToken: (token) => { localStorage.setItem("github_access_token", token); set({ githubAccessToken: token }); },
  setGithubUser: (user) => { localStorage.setItem("github_user", JSON.stringify(user)); set({ githubUser: user }); },
  addPendingChange: (change) => {
    const pc: PendingChange = { ...change, id: crypto.randomUUID(), timestamp: Date.now() };
    set({ pendingChanges: [...get().pendingChanges, pc] });
  },
  clearPendingChanges: () => set({ pendingChanges: [] }),

  persistToCloud: async (projectId: string) => {
    const { files, enabledPlugins, selectedEngine, buildAppName, buildPackageName } = get();
    if (files.length === 0) return null;
    const plugins = Array.from(enabledPlugins);
    const config = { engine: selectedEngine, appName: buildAppName, packageName: buildPackageName };
    return persistProject(projectId, files, plugins, config);
  },

  hydrateFromCloud: async (projectId: string) => {
    // Guard: don't load this project's data if the user already navigated away to a different project.
    if (get().currentProjectId !== projectId) return false;
    const snapshot = await getLatestSnapshot(projectId);
    if (get().currentProjectId !== projectId) return false;
    if (!snapshot?.storage_path) return false;

    const blob = await loadProjectFromStorage(snapshot.storage_path);
    if (get().currentProjectId !== projectId) return false;
    if (!blob) return false;

    const zipFile = new globalThis.File([blob], "source.zip", { type: "application/zip" });
    await get().loadFromZip(zipFile);
    if (get().currentProjectId !== projectId) return false;

    // Restore plugin/config state from snapshot
    if (Array.isArray(snapshot.plugin_state)) {
      set({ enabledPlugins: new Set(snapshot.plugin_state as unknown as string[]) });
    }
    const configState = snapshot.config_state as Record<string, unknown> | null;
    if (configState) {
      if (configState.engine) set({ selectedEngine: configState.engine as string });
      if (configState.appName) set({ buildAppName: configState.appName as string });
      if (configState.packageName) set({ buildPackageName: configState.packageName as string });
    }
    return true;
  },

  getLatestSnapshot: async (projectId: string) => {
    return getLatestSnapshot(projectId);
  },

  updateFileContent: (path, content) => {
    let found = false;
    const updateInTree = (nodes: ProjectFile[]): ProjectFile[] =>
      nodes.map((node) => {
        if (node.path === path) { found = true; return { ...node, content }; }
        if (node.children) return { ...node, children: updateInTree(node.children) };
        return node;
      });

    const files = updateInTree(get().files);
    if (found) {
      set({ files });
      const openFile = get().openFile;
      if (openFile?.path === path) {
        set({ openFile: { ...openFile, content } });
      }
    } else {
      // Upsert: file did not exist — create it (needed for AI-generated .env, new XML configs, etc.)
      get().addFile(path, content);
    }
  },

  addFile: (path, content) => {
    // Flatten current tree, add or replace, rebuild
    const flat = flattenFiles(get().files).filter((f) => f.type === "file");
    const entries: { path: string; content: string; size: number; binaryContent?: ArrayBuffer; isBinary?: boolean }[] = flat.map((f) => ({
      path: f.path,
      content: f.content || "",
      size: f.size || 0,
      binaryContent: f.binaryContent,
      isBinary: f.isBinary,
    }));
    const existingIdx = entries.findIndex((e) => e.path === path);
    const newEntry = { path, content, size: content.length };
    if (existingIdx >= 0) entries[existingIdx] = newEntry;
    else entries.push(newEntry);
    set({ files: buildTree(entries) });
  },

  removeFile: (path) => {
    const flat = flattenFiles(get().files).filter((f) => f.type === "file" && f.path !== path);
    const entries: { path: string; content: string; size: number; binaryContent?: ArrayBuffer; isBinary?: boolean }[] = flat.map((f) => ({
      path: f.path,
      content: f.content || "",
      size: f.size || 0,
      binaryContent: f.binaryContent,
      isBinary: f.isBinary,
    }));
    set({ files: buildTree(entries) });
    const openFile = get().openFile;
    if (openFile?.path === path) set({ openFile: null });
  },

  mergeFiles: (incoming) => {
    // Flatten current tree into entries, then upsert incoming files, rebuild tree.
    const flat = flattenFiles(get().files).filter((f) => f.type === "file");
    const entryMap = new Map<string, { path: string; content: string; size: number; binaryContent?: ArrayBuffer; isBinary?: boolean }>();
    for (const f of flat) {
      entryMap.set(f.path, {
        path: f.path,
        content: f.content || "",
        size: f.size || 0,
        binaryContent: f.binaryContent,
        isBinary: f.isBinary,
      });
    }
    for (const inc of incoming) {
      entryMap.set(inc.path, {
        path: inc.path,
        content: inc.content ?? `[Binary: ${(inc.binaryContent?.byteLength ?? 0)} bytes]`,
        size: inc.binaryContent?.byteLength ?? inc.content?.length ?? 0,
        binaryContent: inc.binaryContent,
        isBinary: inc.isBinary,
      });
    }
    const tree = buildTree(Array.from(entryMap.values()));
    set({ files: tree });
    const inferredPackageName = inferPackageNameFromFiles(tree);
    if (inferredPackageName) set({ buildPackageName: inferredPackageName });
  },

  loadFromZip: async (file: File) => {
    set({ isScanning: true, scanResult: null });

    const zip = await JSZip.loadAsync(file);
    const entries: { path: string; content: string; size: number; binaryContent?: ArrayBuffer; isBinary?: boolean }[] = [];

    const promises: Promise<void>[] = [];
    // First pass: collect all paths to detect common root
    const allPaths: string[] = [];
    zip.forEach((relativePath, zipEntry) => {
      if (zipEntry.dir) return;
      if (relativePath.includes("node_modules/") || relativePath.includes("__MACOSX")) return;
      // Skip macOS resource forks but allow dotfiles like .env, .gitignore
      if (relativePath.split("/").some(part => part === ".DS_Store")) return;
      allPaths.push(relativePath);
    });

    // Detect common root folder (e.g., "my-project/") across ALL entries
    const detectCommonRoot = (paths: string[]): string => {
      if (paths.length === 0) return "";
      const split = paths.map(p => p.split("/"));
      // Check if all paths share a common first directory
      const firstSegment = split[0][0];
      if (!firstSegment) return "";
      // All paths must have more than 1 segment and share the same first segment
      const allShareRoot = split.every(
        parts => parts.length > 1 && parts[0] === firstSegment
      );
      return allShareRoot ? firstSegment + "/" : "";
    };

    const commonRoot = detectCommonRoot(allPaths);

    zip.forEach((relativePath, zipEntry) => {
      if (zipEntry.dir) return;
      if (relativePath.includes("node_modules/") || relativePath.includes("__MACOSX")) return;
      if (relativePath.split("/").some(part => part === ".DS_Store")) return;

      // Strip the common root uniformly from ALL files
      const cleanPath = commonRoot && relativePath.startsWith(commonRoot)
        ? relativePath.slice(commonRoot.length)
        : relativePath;

      const ext = getExtension(relativePath);
      const isText = [
        "ts", "tsx", "js", "jsx", "json", "html", "css", "scss", "md",
        "txt", "yaml", "yml", "toml", "xml", "svg", "env", "gitignore",
        "vue", "svelte", "lock", "gradle", "java", "kt", "swift",
      ].includes(ext || "");

      if (isText) {
        promises.push(
          zipEntry.async("string").then((content) => {
            entries.push({ path: cleanPath || relativePath, content, size: content.length });
          })
        );
      } else {
        // Read binary files as ArrayBuffer instead of skipping them
        promises.push(
          zipEntry.async("arraybuffer").then((buffer) => {
            entries.push({
              path: cleanPath || relativePath,
              content: `[Binary: ${ext || "unknown"}, ${(buffer.byteLength / 1024).toFixed(1)} KB]`,
              size: buffer.byteLength,
              binaryContent: buffer,
              isBinary: true,
            });
          })
        );
      }
    });

    await Promise.all(promises);

    // Ground incomplete/static projects before scan/build so plain HTML does
    // not fail validation or ship blank fallback output.
    const grounding = planProjectGrounding(
      entries.map((e) => ({ path: e.path, type: "file" as const, content: e.content, isBinary: e.isBinary })),
      get().buildAppName || "App",
    );
    for (const patch of grounding.patches) {
      const existing = entries.find((e) => e.path === patch.path);
      if (existing) {
        existing.content = patch.content;
        existing.size = patch.content.length;
        existing.isBinary = false;
        existing.binaryContent = undefined;
      } else {
        entries.push({ path: patch.path, content: patch.content, size: patch.content.length });
      }
    }

    const tree = buildTree(entries);
    set({ files: tree });

    // Analyze
    const detected = detectFramework(tree);
    const connectivity = analyzeConnectivity(tree);
    const issues = analyzeIssues(tree);
    for (const line of grounding.logs) {
      issues.push({ file: "project", severity: "info", message: line });
    }

    // Pre-build security & structure validation
    const flatForValidation = flattenFiles(tree)
      .filter((f) => f.type === "file")
      .map((f) => ({
        path: f.path,
        type: "file" as const,
        content: f.content,
        size: f.size,
        isBinary: f.isBinary,
        binaryContent: f.binaryContent,
      }));
    const validation = validateProjectForBuild(flatForValidation, {
      framework: detected.framework || "Unknown",
      hasPackageJson: flatForValidation.some((f) => f.path.endsWith("package.json")),
      hasBuildScript: !!detected.buildCommand,
      hasSSR: false,
    } as any);
    for (const e of validation.errors) issues.push({ file: "project", severity: "error", message: e });
    for (const w of validation.warnings) issues.push({ file: "project", severity: "warning", message: w });
    if (!validation.canBuild) {
      toast.error("Project failed pre-build checks", {
        description: validation.errors[0] || "See scan results for details.",
      });
    } else if (validation.warnings.length > 0) {
      toast.warning(`${validation.warnings.length} warning(s) in uploaded project`);
    } else {
      toast.success("Project passed all pre-build checks");
    }

    const { assurance, assuranceMessage } = computeAssurance(issues, detected.framework || "Unknown");
    const totalSize = entries.reduce((sum, e) => sum + e.size, 0);

    set({
      scanResult: {
        framework: detected.framework || "Unknown",
        packageManager: detected.packageManager || "npm",
        buildCommand: detected.buildCommand || "npm run build",
        outputDir: detected.outputDir || "dist/",
        entryPoint: detected.entryPoint || "index.html",
        totalFiles: entries.length,
        totalSize: totalSize < 1024 * 1024 ? `${(totalSize / 1024).toFixed(1)} KB` : `${(totalSize / (1024 * 1024)).toFixed(1)} MB`,
        issues,
        dependencies: detected.dependencies || [],
        connectivity,
        assurance,
        assuranceMessage,
      },
      isScanning: false,
    });
  },
}));

export const flattenProjectFiles = flattenFiles;

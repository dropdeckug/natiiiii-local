import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useProjectStore, flattenProjectFiles, ProjectFile } from "@/stores/projectStore";
import {
  ChevronRight, ChevronDown, File, Folder, FolderOpen, FileCode, FileText, Image as ImageIcon,
  Upload, Pencil, Eye, Search, GitBranch, History, Diff
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import SyntaxHighlighter from "@/components/ui/syntax-highlighter";
import FileTab from "@/components/dashboard/FileTab";
import DiffViewer from "@/components/dashboard/DiffViewer";
import CodeLinesSkeleton from "@/components/dashboard/CodeLinesSkeleton";
import ReactMarkdown from "react-markdown";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "svg", "webp", "avif", "ico", "bmp"];
const MARKDOWN_EXTS = ["md", "mdx", "markdown"];

const getFileIcon = (ext?: string) => {
  if (!ext) return File;
  if (["ts", "tsx", "js", "jsx", "vue", "svelte", "py", "java", "kt"].includes(ext)) return FileCode;
  if (["md", "mdx", "txt", "json", "yaml", "yml", "toml", "xml"].includes(ext)) return FileText;
  if (IMAGE_EXTS.includes(ext)) return ImageIcon;
  return File;
};

const TreeSkeleton = () => (
  <div className="p-3 space-y-2">
    {Array.from({ length: 10 }).map((_, i) => (
      <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${(i % 3) * 12}px` }}>
        <Skeleton className="h-3 w-3 rounded-sm" />
        <Skeleton className={`h-3 ${i % 4 === 0 ? "w-28" : i % 3 === 0 ? "w-36" : "w-24"}`} />
      </div>
    ))}
  </div>
);

const EditorSkeleton = () => <CodeLinesSkeleton rows={24} />;

const TreeNode = ({
  node, depth, selectedPath, onSelect, searchQuery,
}: {
  node: ProjectFile; depth: number; selectedPath: string | null;
  onSelect: (f: ProjectFile) => void; searchQuery: string;
}) => {
  const [expanded, setExpanded] = useState(depth < 1);
  const isFolder = node.type === "folder";
  const isSelected = selectedPath === node.path;
  const Icon = isFolder ? (expanded ? FolderOpen : Folder) : getFileIcon(node.extension);

  if (searchQuery) {
    const matchesSelf = node.name.toLowerCase().includes(searchQuery.toLowerCase());
    const hasMatchingChild = isFolder && node.children?.some(c => matchesSearch(c, searchQuery));
    if (!matchesSelf && !hasMatchingChild) return null;
  }

  return (
    <div>
      <button
        onClick={() => { if (isFolder) setExpanded(!expanded); else onSelect(node); }}
        className={`flex items-center gap-1.5 w-full px-2 py-1 text-[12px] rounded-[3px] transition-colors ${
          isSelected ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        {isFolder && (expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />)}
        <Icon size={13} className="shrink-0" />
        <span className="truncate">{node.name}</span>
        {!isFolder && node.size && (
          <span className="ml-auto text-[10px] text-muted-foreground/40">
            {node.size < 1024 ? `${node.size}B` : `${(node.size / 1024).toFixed(0)}K`}
          </span>
        )}
      </button>
      {isFolder && expanded && node.children?.map((child) => (
        <TreeNode key={child.id} node={child} depth={depth + 1} selectedPath={selectedPath} onSelect={onSelect} searchQuery={searchQuery} />
      ))}
    </div>
  );
};

function matchesSearch(node: ProjectFile, query: string): boolean {
  if (node.name.toLowerCase().includes(query.toLowerCase())) return true;
  if (node.children) return node.children.some(c => matchesSearch(c, query));
  return false;
}

interface Snapshot {
  id: string;
  created_at: string;
  file_count: number;
  total_size: number;
}

// ─── File preview: image, markdown, code, diff ─────────────────────────────
const checkerStyle: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%), linear-gradient(-45deg, hsl(var(--muted)) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, hsl(var(--muted)) 75%), linear-gradient(-45deg, transparent 75%, hsl(var(--muted)) 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
};

interface FilePreviewProps {
  file: ProjectFile;
  diffMode: boolean;
  previousContent?: string;
  editMode: boolean;
  mdSource: boolean;
  onEdit: (newContent: string) => void;
}

const mimeForExt = (ext: string): string => {
  switch (ext) {
    case "svg": return "image/svg+xml";
    case "ico": return "image/x-icon";
    case "jpg":
    case "jpeg": return "image/jpeg";
    default: return `image/${ext}`;
  }
};

const FilePreview = ({ file, diffMode, previousContent, editMode, mdSource, onEdit }: FilePreviewProps) => {
  const ext = file.extension || "";
  const isImage = IMAGE_EXTS.includes(ext);
  const isMarkdown = MARKDOWN_EXTS.includes(ext);

  const imageUrl = useMemo(() => {
    if (!isImage) return null;
    if (ext === "svg" && file.content && !file.binaryContent) {
      const blob = new Blob([file.content], { type: "image/svg+xml" });
      return URL.createObjectURL(blob);
    }
    if (file.binaryContent) {
      const blob = new Blob([file.binaryContent], { type: mimeForExt(ext) });
      return URL.createObjectURL(blob);
    }
    return null;
  }, [file.path, file.binaryContent, file.content, ext, isImage]);

  useEffect(() => {
    return () => { if (imageUrl) URL.revokeObjectURL(imageUrl); };
  }, [imageUrl]);

  if (diffMode && previousContent !== undefined) {
    return (
      <DiffViewer
        oldCode={previousContent}
        newCode={file.content || ""}
        fileName={file.path}
      />
    );
  }

  if (isImage) {
    if (!imageUrl) {
      return (
        <div className="p-6 text-center text-sm text-muted-foreground">
          Image data unavailable. Re-upload the project ZIP to view.
        </div>
      );
    }
    return (
      <div className="p-4 flex flex-col items-center gap-3">
        <div className="rounded border border-border p-3" style={checkerStyle}>
          <img
            src={imageUrl}
            alt={file.name}
            className="max-w-full max-h-[60vh] object-contain"
          />
        </div>
        <div className="text-[11px] text-muted-foreground font-mono">
          {file.name} · {file.size ? `${(file.size / 1024).toFixed(1)} KB` : "—"}
        </div>
      </div>
    );
  }

  if (isMarkdown && !mdSource) {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none p-6 prose-pre:bg-muted prose-pre:text-foreground">
        <ReactMarkdown>{file.content || "*(empty)*"}</ReactMarkdown>
      </div>
    );
  }

  if (file.isBinary) {
    return <div className="p-6 text-center text-sm text-muted-foreground">Binary file — {file.content}</div>;
  }

  return (
    <SyntaxHighlighter
      code={file.content || "Empty file"}
      extension={ext}
      showLineNumbers
      maxHeight="calc(100vh - 200px)"
      editable={editMode}
      onEdit={onEdit}
      showCopy
    />
  );
};

const CodeSourcePanel = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const { files, updateFileContent, loadFromZip, hydrateFromCloud, persistToCloud, isScanning, aiChangedFiles, clearAiChanges } = useProjectStore();
  const [openTabs, setOpenTabs] = useState<ProjectFile[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [diffMode, setDiffMode] = useState(false);
  const [mdSource, setMdSource] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingSource, setLoadingSource] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<Snapshot[]>([]);
  const [previousContent, setPreviousContent] = useState<Record<string, string>>({});
  const [unsavedFiles, setUnsavedFiles] = useState<Set<string>>(new Set());
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeFile = openTabs.find(t => t.path === activeTab) || null;

  useEffect(() => {
    if (files.length > 0 || !projectId || loadingSource) return;
    let cancelled = false;
    const hydrate = async () => {
      setLoadingSource(true);
      try {
        const loaded = await hydrateFromCloud(projectId);
        if (!cancelled && loaded) toast.success("Source code restored from cloud");
      } catch (err) {
        console.error("Failed to hydrate project:", err);
      } finally {
        if (!cancelled) setLoadingSource(false);
      }
    };
    hydrate();
    return () => { cancelled = true; };
  }, [projectId, files.length, hydrateFromCloud, loadingSource]);

  // Seed `previousContent` from AI-changed files so the existing red/green DiffViewer lights up automatically.
  // Open ALL changed files as tabs (not just the first) so the user can step through every AI edit.
  useEffect(() => {
    const aiPaths = Object.keys(aiChangedFiles);
    if (aiPaths.length === 0) return;
    setPreviousContent((prev) => {
      const next = { ...prev };
      for (const p of aiPaths) {
        if (next[p] === undefined) next[p] = aiChangedFiles[p];
      }
      return next;
    });
    const flat = (function walk(nodes: ProjectFile[]): ProjectFile[] {
      const out: ProjectFile[] = [];
      for (const n of nodes) { if (n.type === "file") out.push(n); if (n.children) out.push(...walk(n.children)); }
      return out;
    })(files);
    const changedFiles = flat.filter((f) => aiPaths.includes(f.path));
    if (changedFiles.length > 0) {
      setOpenTabs((tabs) => {
        const existing = new Set(tabs.map(t => t.path));
        const additions = changedFiles.filter(f => !existing.has(f.path));
        return additions.length > 0 ? [...tabs, ...additions] : tabs;
      });
      setActiveTab(changedFiles[0].path);
      setDiffMode(true);
    }
  }, [aiChangedFiles, files]);

  useEffect(() => {
    if (!projectId || !showVersions) return;
    (async () => {
      const { data } = await supabase
        .from("project_snapshots")
        .select("id, created_at, file_count")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) setVersions(data.map(d => ({ ...d, total_size: 0 })) as Snapshot[]);
    })();
  }, [projectId, showVersions]);

  const openFile = (file: ProjectFile) => {
    if (!openTabs.find(t => t.path === file.path)) {
      setOpenTabs(prev => [...prev, file]);
    }
    setActiveTab(file.path);
  };

  const closeTab = (path: string) => {
    setOpenTabs(prev => prev.filter(t => t.path !== path));
    if (activeTab === path) {
      const remaining = openTabs.filter(t => t.path !== path);
      setActiveTab(remaining.length > 0 ? remaining[remaining.length - 1].path : null);
    }
  };

  const persistNow = useCallback(async () => {
    if (!projectId) return false;
    const snapshot = await persistToCloud(projectId);
    if (snapshot) {
      setUnsavedFiles(new Set());
      return true;
    }
    return false;
  }, [projectId, persistToCloud]);

  // Warn before refresh / close if unsaved edits exist
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (unsavedFiles.size > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [unsavedFiles]);

  const handleEditSave = async (newContent: string) => {
    if (!activeFile) return;
    if (!previousContent[activeFile.path]) {
      setPreviousContent(prev => ({ ...prev, [activeFile.path]: activeFile.content || "" }));
    }
    updateFileContent(activeFile.path, newContent);
    setOpenTabs(prev => prev.map(t => t.path === activeFile.path ? { ...t, content: newContent } : t));
    setUnsavedFiles(prev => new Set(prev).add(activeFile.path));
    // Persist immediately so a refresh keeps the change.
    const ok = await persistNow();
    if (ok) toast.success("Saved to cloud");
    else toast.error("Could not save — sign in or check connection");
  };

  const handleUploadZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await loadFromZip(file);
      if (projectId) {
        const snapshot = await persistToCloud(projectId);
        toast.success(snapshot ? "Source code uploaded and saved" : "Source code loaded (sign in to persist)");
      } else {
        toast.success("Source code loaded");
      }
    } catch (err: any) {
      toast.error("Failed to load: " + (err.message || "Unknown error"));
    } finally {
      setUploading(false);
    }
  };

  const isHydrating = loadingSource || isScanning || uploading;

  // Empty (and not hydrating): show upload CTA — full panel, no skeleton.
  if (!isHydrating && files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <Folder size={32} className="text-muted-foreground/30 mb-3" />
        <h2 className="text-sm font-medium text-foreground mb-1">No Source Code</h2>
        <p className="text-xs text-muted-foreground max-w-sm mb-4">
          Upload a project ZIP to view and edit source files here.
        </p>
        <label className="cursor-pointer">
          <input type="file" accept=".zip" onChange={handleUploadZip} className="hidden" />
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <span><Upload size={14} /> Upload ZIP</span>
          </Button>
        </label>
      </div>
    );
  }

  const allFiles = flattenProjectFiles(files).filter(f => f.type === "file");

  return (
    <div className="flex h-full flex-col md:flex-row">
      <div className="w-full md:w-[240px] border-b md:border-b-0 md:border-r border-border flex flex-col max-h-[200px] md:max-h-none bg-card/50">
        <div className="px-2 py-1.5 border-b border-border flex items-center gap-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex-1">
            {isHydrating ? "Loading…" : `Files (${allFiles.length})`}
          </span>
          <button onClick={() => setShowSearch(!showSearch)} className="p-1 rounded hover:bg-muted transition-colors" title="Search files">
            <Search size={12} className="text-muted-foreground" />
          </button>
          <button onClick={() => setShowVersions(!showVersions)} className="p-1 rounded hover:bg-muted transition-colors" title="Version history">
            <History size={12} className="text-muted-foreground" />
          </button>
          <label className="cursor-pointer p-1 rounded hover:bg-muted transition-colors" title="Upload ZIP">
            <input type="file" accept=".zip" onChange={handleUploadZip} className="hidden" />
            <Upload size={12} className="text-muted-foreground" />
          </label>
        </div>

        {showSearch && (
          <div className="px-2 py-1.5 border-b border-border">
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-7 text-xs bg-transparent"
            />
          </div>
        )}

        {showVersions && (
          <div className="border-b border-border max-h-[150px] overflow-y-auto">
            <div className="px-2 py-1.5">
              <span className="text-[10px] font-medium text-muted-foreground uppercase">Versions</span>
            </div>
            {versions.length === 0 ? (
              <p className="px-2 pb-2 text-[11px] text-muted-foreground/60">No snapshots yet</p>
            ) : (
              versions.map(v => (
                <div key={v.id} className="px-2 py-1.5 flex items-center gap-2 text-[11px] hover:bg-muted/40 cursor-pointer transition-colors">
                  <GitBranch size={10} className="text-muted-foreground/50 shrink-0" />
                  <span className="text-muted-foreground truncate">
                    {new Date(v.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-muted-foreground/40 ml-auto">{v.file_count} files</span>
                </div>
              ))
            )}
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="py-1">
            {isHydrating && files.length === 0 ? (
              <TreeSkeleton />
            ) : (
              files.map(node => (
                <TreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedPath={activeTab}
                  onSelect={openFile}
                  searchQuery={searchQuery}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {openTabs.length > 0 && (
          <div className="flex items-center border-b border-border overflow-x-auto scrollbar-hide bg-muted/20">
            {openTabs.map(tab => (
              <FileTab
                key={tab.path}
                file={tab}
                isActive={activeTab === tab.path}
                hasUnsavedChanges={unsavedFiles.has(tab.path)}
                onSelect={() => setActiveTab(tab.path)}
                onClose={() => closeTab(tab.path)}
              />
            ))}
          </div>
        )}

        {activeFile ? (
          <>
            <div className="px-3 py-1.5 border-b border-border flex items-center gap-2 flex-wrap bg-card/30">
              <FileCode size={12} className="text-muted-foreground" />
              <span className="text-[11px] font-medium text-foreground truncate font-mono">{activeFile.path}</span>
              {activeFile.extension && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">{activeFile.extension}</span>
              )}
              <div className="ml-auto flex items-center gap-0.5">
                {MARKDOWN_EXTS.includes(activeFile.extension || "") && (
                  <button
                    onClick={() => setMdSource(!mdSource)}
                    className={`px-2 py-0.5 rounded text-[10px] transition-colors ${mdSource ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    title="Toggle markdown source"
                  >
                    {mdSource ? "Preview" : "Source"}
                  </button>
                )}
                {previousContent[activeFile.path] && (
                  <button
                    onClick={() => setDiffMode(!diffMode)}
                    className={`p-1 rounded transition-colors ${diffMode ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    title="Toggle diff view"
                  >
                    <Diff size={13} />
                  </button>
                )}
                {!IMAGE_EXTS.includes(activeFile.extension || "") && (
                  <button
                    onClick={() => setEditMode(!editMode)}
                    className={`p-1 rounded transition-colors ${editMode ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    title={editMode ? "View mode" : "Edit mode"}
                  >
                    {editMode ? <Eye size={13} /> : <Pencil size={13} />}
                  </button>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1">
              <FilePreview
                file={activeFile}
                diffMode={diffMode && !!previousContent[activeFile.path]}
                previousContent={previousContent[activeFile.path]}
                editMode={editMode}
                mdSource={mdSource}
                onEdit={handleEditSave}
              />
            </ScrollArea>
          </>
        ) : isHydrating ? (
          <EditorSkeleton />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Select a file to view its contents
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeSourcePanel;

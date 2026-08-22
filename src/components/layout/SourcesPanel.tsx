import { useState } from "react";
import {
  Plus,
  Search,
  FileText,
  Globe,
  Upload,
  GitBranch,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  FileCode2,
  FileJson,
  FileType,
  Image,
  File,
  X,
} from "lucide-react";
import { useProjectStore, type ProjectFile } from "@/stores/projectStore";

const getFileIcon = (extension?: string) => {
  switch (extension) {
    case "tsx": case "ts": case "jsx": case "js":
      return <FileCode2 size={14} className="text-primary" />;
    case "json":
      return <FileJson size={14} className="text-warning" />;
    case "html": case "css": case "scss":
      return <FileType size={14} className="text-info" />;
    case "png": case "jpg": case "svg": case "ico": case "webp":
      return <Image size={14} className="text-success" />;
    default:
      return <File size={14} className="text-muted-foreground" />;
  }
};

const FileTreeItem = ({ item, level, selectedPath, onSelect }: {
  item: ProjectFile; level: number; selectedPath: string | null;
  onSelect: (file: ProjectFile) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(level < 1);
  const isFolder = item.type === "folder";
  const isSelected = selectedPath === item.path;

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer text-[13px] transition-colors
          ${isSelected ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
        style={{ paddingLeft: `${8 + level * 12}px` }}
        onClick={() => isFolder ? setIsExpanded(!isExpanded) : onSelect(item)}
      >
        {isFolder ? (isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : <span className="w-3" />}
        {isFolder ? <FolderOpen size={14} className="text-muted-foreground" /> : getFileIcon(item.extension)}
        <span className="truncate">{item.name}</span>
      </div>
      {isFolder && isExpanded && item.children?.map((child) => (
        <FileTreeItem key={child.id} item={child} level={level + 1} selectedPath={selectedPath} onSelect={onSelect} />
      ))}
    </div>
  );
};

interface SourcesPanelProps {
  onClose?: () => void;
}

const SourcesPanel = ({ onClose }: SourcesPanelProps) => {
  const { files, openFile, setOpenFile, loadFromZip } = useProjectStore();
  const hasFiles = files.length > 0;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await loadFromZip(file);
  };

  return (
    <div className="w-full sm:w-[280px] sm:min-w-[240px] bg-card rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium">Sources</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="icon-button w-7 h-7">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Add source button */}
      <div className="px-3 pb-2">
        <label className="flex items-center justify-center gap-2 w-full py-2 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors cursor-pointer">
          <Plus size={14} />
          Add source
          <input type="file" accept=".zip,.tar.gz" onChange={handleUpload} className="hidden" />
        </label>
      </div>

      {/* Source type shortcuts */}
      <div className="px-3 pb-3 flex gap-1.5">
        <label className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-[10px]">
          <Upload size={14} />
          Upload
          <input type="file" accept=".zip,.tar.gz" onChange={handleUpload} className="hidden" />
        </label>
        <button className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors text-[10px]">
          <Globe size={14} />
          URL
        </button>
        <button className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors text-[10px]">
          <GitBranch size={14} />
          Repo
        </button>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {hasFiles ? (
          files.map((file) => (
            <FileTreeItem key={file.id} item={file} level={0} selectedPath={openFile?.path || null} onSelect={setOpenFile} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <p className="text-xs text-muted-foreground mb-1">Saved sources will appear here</p>
            <p className="text-[10px] text-muted-foreground/60">Upload a project, paste a URL, or connect a repo</p>
          </div>
        )}
      </div>

      {/* Footer */}
      {hasFiles && (
        <div className="px-4 py-2 border-t border-border/50">
          <span className="text-[11px] text-muted-foreground">{countFiles(files)} source files</span>
        </div>
      )}
    </div>
  );
};

function countFiles(files: ProjectFile[]): number {
  let count = 0;
  for (const f of files) {
    if (f.type === "file") count++;
    if (f.children) count += countFiles(f.children);
  }
  return count;
}

export default SourcesPanel;

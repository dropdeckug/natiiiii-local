import { useState } from "react";
import {
  X,
  FolderOpen,
  Upload,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  FileCode2,
  FileJson,
  FileType,
  Image,
  File,
} from "lucide-react";
import { useProjectStore, type ProjectFile } from "@/stores/projectStore";

const getFileIcon = (extension?: string) => {
  switch (extension) {
    case "tsx":
    case "ts":
    case "jsx":
    case "js":
      return <FileCode2 size={15} className="text-primary" />;
    case "json":
      return <FileJson size={15} className="text-[hsl(var(--warning))]" />;
    case "html":
    case "css":
    case "scss":
      return <FileType size={15} className="text-[hsl(var(--info))]" />;
    case "png":
    case "jpg":
    case "svg":
    case "ico":
    case "webp":
      return <Image size={15} className="text-[hsl(var(--success))]" />;
    default:
      return <File size={15} className="text-muted-foreground" />;
  }
};

interface FileTreeItemProps {
  item: ProjectFile;
  level: number;
  selectedPath: string | null;
  onSelect: (file: ProjectFile) => void;
}

const FileTreeItem = ({ item, level, selectedPath, onSelect }: FileTreeItemProps) => {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const isFolder = item.type === "folder";
  const isSelected = selectedPath === item.path;

  return (
    <div>
      <div
        className={`file-item ${isSelected ? "file-item-selected" : ""}`}
        style={{ paddingLeft: `${8 + level * 14}px` }}
        onClick={() => {
          if (isFolder) setIsExpanded(!isExpanded);
          else onSelect(item);
        }}
      >
        {isFolder ? (
          isExpanded ? <ChevronDown size={13} className="text-muted-foreground" /> : <ChevronRight size={13} className="text-muted-foreground" />
        ) : (
          <span className="w-3" />
        )}
        {isFolder ? <FolderOpen size={15} className="text-muted-foreground" /> : getFileIcon(item.extension)}
        <span className="text-[13px] truncate">{item.name}</span>
      </div>
      {isFolder && isExpanded && item.children && (
        <div>
          {item.children.map((child) => (
            <FileTreeItem key={child.id} item={child} level={level + 1} selectedPath={selectedPath} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
};

interface FilesPanelProps {
  onClose: () => void;
}

const FilesPanel = ({ onClose }: FilesPanelProps) => {
  const { files, openFile, setOpenFile, loadFromZip } = useProjectStore();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await loadFromZip(file);
    }
  };

  const hasFiles = files.length > 0;

  return (
    <div className="w-64 bg-sidebar-files rounded-lg flex flex-col h-full overflow-hidden">
      <div className="panel-header">
        <span className="text-sm font-medium">Files</span>
        <div className="flex items-center gap-1">
          <label className="icon-button w-7 h-7 cursor-pointer" title="Upload project ZIP">
            <Upload size={15} />
            <input type="file" accept=".zip,.tar.gz" onChange={handleUpload} className="hidden" />
          </label>
          <button className="icon-button w-7 h-7" title="Close panel" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {hasFiles ? (
          files.map((file) => (
            <FileTreeItem
              key={file.id}
              item={file}
              level={0}
              selectedPath={openFile?.path || null}
              onSelect={setOpenFile}
            />
          ))
        ) : (
          <div className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-2">No project loaded</p>
            <label className="text-xs text-primary cursor-pointer hover:underline">
              Upload a ZIP to get started
              <input type="file" accept=".zip,.tar.gz" onChange={handleUpload} className="hidden" />
            </label>
          </div>
        )}
      </div>

      {hasFiles && (
        <div className="px-3 py-2 border-t border-border">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{countFiles(files)} files</span>
          </div>
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

export default FilesPanel;

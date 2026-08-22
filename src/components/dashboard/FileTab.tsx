import { X, FileCode, FileText, File, Image } from "lucide-react";
import type { ProjectFile } from "@/stores/projectStore";

interface FileTabProps {
  file: ProjectFile;
  isActive: boolean;
  hasUnsavedChanges?: boolean;
  onSelect: () => void;
  onClose: () => void;
}

const getIcon = (ext?: string) => {
  if (!ext) return File;
  if (["ts", "tsx", "js", "jsx", "vue", "svelte", "py", "java", "kt"].includes(ext)) return FileCode;
  if (["md", "txt", "json", "yaml", "yml", "toml", "xml"].includes(ext)) return FileText;
  if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) return Image;
  return File;
};

const FileTab = ({ file, isActive, hasUnsavedChanges, onSelect, onClose }: FileTabProps) => {
  const Icon = getIcon(file.extension);

  return (
    <button
      onClick={onSelect}
      className={`group flex items-center gap-1.5 px-3 py-1.5 text-[12px] border-r border-border transition-colors shrink-0 ${
        isActive
          ? "bg-card text-foreground border-b-2 border-b-primary"
          : "bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground border-b-2 border-b-transparent"
      }`}
    >
      <Icon size={12} className="shrink-0" />
      <span className="truncate max-w-[120px]">{file.name}</span>
      {hasUnsavedChanges && (
        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
      )}
      <span
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="ml-0.5 p-0.5 rounded hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
      >
        <X size={10} />
      </span>
    </button>
  );
};

export default FileTab;

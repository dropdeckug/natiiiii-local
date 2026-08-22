import { useState, useCallback } from "react";
import { Upload, FileArchive, X, CheckCircle2 } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";

const ProjectUpload = () => {
  const [isDragging, setIsDragging] = useState(false);
  const { files, isScanning, loadFromZip } = useProjectStore();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped && (dropped.name.endsWith(".zip") || dropped.name.endsWith(".tar.gz"))) {
        setUploadedFile(dropped);
        await loadFromZip(dropped);
      }
    },
    [loadFromZip]
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setUploadedFile(selected);
      await loadFromZip(selected);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const hasFiles = files.length > 0;

  return (
    <div className="space-y-4">
      {!hasFiles ? (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-3 p-10 rounded-lg border-2 border-dashed cursor-pointer transition-all duration-200 ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
          }`}
        >
          <input type="file" accept=".zip,.tar.gz" onChange={handleFileSelect} className="hidden" />
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
            <Upload size={24} className="text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Drop your project ZIP here</p>
            <p className="text-xs text-muted-foreground mt-1">or click to browse · ZIP or TAR.GZ up to 100MB</p>
          </div>
        </label>
      ) : (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileArchive size={18} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{uploadedFile?.name || "Project"}</p>
            <p className="text-xs text-muted-foreground">{uploadedFile ? formatSize(uploadedFile.size) : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            {!isScanning && <CheckCircle2 size={16} className="text-[hsl(var(--success))]" />}
            <button
              onClick={() => {
                setUploadedFile(null);
                useProjectStore.getState().setFiles([]);
                useProjectStore.getState().setScanResult(null);
              }}
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Supports React, Vue, Angular, Next.js, Svelte, and plain HTML/CSS/JS projects. Include{" "}
        <code className="text-primary/80">package.json</code> for automatic framework detection.
      </p>
    </div>
  );
};

export default ProjectUpload;

import { useRef, useState, useCallback } from "react";
import { FileCode2, CheckCircle2, Github, Plus, ExternalLink } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";

interface PlatformSelectProps {
  onSelect: (platform: string) => void;
}

const PlatformSelect = ({ onSelect }: PlatformSelectProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const { files, loadFromZip } = useProjectStore();

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".zip") || file.name.endsWith(".tar.gz"))) {
      setUploadedFile(file);
      await loadFromZip(file);
      onSelect("android");
    }
  }, [loadFromZip, onSelect]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      await loadFromZip(file);
      onSelect("android");
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      {/* Circular drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`drop-zone-circle cursor-pointer transition-all duration-300 mb-10 ${
          isDragging ? "dragging scale-105" : "hover:scale-[1.02]"
        }`}
      >
        <div
          className={`outer-ring transition-all duration-500 ${
            isDragging
              ? "animate-[spin_6s_linear_infinite] border-primary/40"
              : "animate-[spin_25s_linear_infinite]"
          }`}
        />
        {uploadedFile ? (
          <div className="flex flex-col items-center animate-scale-in">
            <CheckCircle2 size={40} className="text-primary mb-3" />
            <span className="text-sm font-semibold text-foreground">{uploadedFile.name}</span>
            <span className="text-xs text-muted-foreground mt-1">{files.length} files detected</span>
          </div>
        ) : (
          <div className={`flex flex-col items-center transition-transform duration-300 ${isDragging ? "scale-110" : ""}`}>
            <FileCode2 size={40} className={`mb-3 transition-colors duration-300 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
            <span className="text-sm font-semibold text-foreground">Drop your project</span>
            <span className="text-xs text-primary mt-1">or browse files</span>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,.tar.gz"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* GitHub accounts section */}
      <div className="w-full max-w-md mb-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted-foreground">GitHub Account</span>
          <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Plus size={14} />
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-primary/40 bg-primary/5 text-primary text-sm font-medium transition-colors hover:bg-primary/10">
            <Github size={16} />
            Connect GitHub
            <ExternalLink size={12} />
          </button>
        </div>
      </div>

      {/* Headline */}
      <div className="text-center max-w-lg">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight mb-3">
          Drag & drop.{" "}
          <span className="gradient-text">Build native.</span>
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Drop a folder or ZIP with your project files. We'll build a native
          Android app — <span className="text-primary">even while you sleep</span>.
        </p>
      </div>
    </div>
  );
};

export default PlatformSelect;

import { useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Globe, CheckCircle2, FileCode2 } from "lucide-react";
import type { EngineType } from "@/components/converter/EngineSelector";

interface SourceStepProps {
  engine: EngineType;
  url: string;
  onUrlChange: (url: string) => void;
  uploadedFileName: string | null;
  onFileUpload: (file: File) => void;
  fileCount: number;
}

const SourceStep = ({
  engine,
  url,
  onUrlChange,
  uploadedFileName,
  onFileUpload,
  fileCount,
}: SourceStepProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isUrlEngine = engine === "webview" || engine === "twa";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileUpload(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".zip") || file.name.endsWith(".tar.gz"))) {
      onFileUpload(file);
    }
  }, [onFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-1">
          {isUrlEngine ? "Enter your URL" : "Drop your project"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isUrlEngine
            ? "Enter the live URL of your web app"
            : "Drop a folder or ZIP with your project files"}
        </p>
      </div>

      {isUrlEngine ? (
        <div className="space-y-3">
          <Label htmlFor="appUrl" className="flex items-center gap-2">
            <Globe size={14} />
            Website URL
          </Label>
          <Input
            id="appUrl"
            type="url"
            placeholder="https://myapp.com"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            className="bg-secondary border-border font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Must be a live, publicly accessible URL
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          {/* Circular drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`drop-zone-circle cursor-pointer transition-all duration-300 ${isDragging ? "dragging scale-105" : "hover:scale-[1.02]"}`}
          >
            <div className={`outer-ring transition-all duration-500 ${isDragging ? "animate-[spin_8s_linear_infinite] border-primary/40" : "animate-[spin_20s_linear_infinite]"}`} />
            {uploadedFileName ? (
              <div className="flex flex-col items-center animate-scale-in">
                <CheckCircle2 size={36} className="text-primary mb-3 animate-[bounce_0.5s_ease-out]" />
                <span className="text-sm font-semibold text-foreground">{uploadedFileName}</span>
                <span className="text-xs text-muted-foreground mt-1">{fileCount} files detected</span>
              </div>
            ) : (
              <div className={`flex flex-col items-center transition-transform duration-300 ${isDragging ? "scale-110" : ""}`}>
                <FileCode2 size={36} className={`mb-3 transition-colors duration-300 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-semibold text-foreground">Drop your project</span>
                <span className="text-xs text-primary mt-1 hover:underline">or browse files</span>
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
        </div>
      )}

      {/* Also allow URL for non-URL engines */}
      {!isUrlEngine && (
        <div className="space-y-3 pt-4 border-t border-border">
          <Label htmlFor="fallbackUrl" className="flex items-center gap-2 text-muted-foreground">
            <Globe size={14} />
            Or enter a URL (optional)
          </Label>
          <Input
            id="fallbackUrl"
            type="url"
            placeholder="https://myapp.com"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            className="bg-secondary border-border font-mono text-sm"
          />
        </div>
      )}
    </div>
  );
};

export default SourceStep;

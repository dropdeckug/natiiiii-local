import { useProjectStore } from "@/stores/projectStore";
import { CheckCircle2, AlertTriangle, XCircle, Info, ArrowRight } from "lucide-react";

const ScanResults = () => {
  const { scanResult } = useProjectStore();

  if (!scanResult) return null;

  const assuranceColors = {
    high: "text-[hsl(var(--success))]",
    medium: "text-[hsl(var(--warning))]",
    low: "text-destructive",
  };

  const assuranceBg = {
    high: "bg-[hsl(var(--success))]/10 border-[hsl(var(--success))]/30",
    medium: "bg-[hsl(var(--warning))]/10 border-[hsl(var(--warning))]/30",
    low: "bg-destructive/10 border-destructive/30",
  };

  const assuranceIcons = {
    high: <CheckCircle2 size={18} className="text-[hsl(var(--success))]" />,
    medium: <AlertTriangle size={18} className="text-[hsl(var(--warning))]" />,
    low: <XCircle size={18} className="text-destructive" />,
  };

  const errors = scanResult.issues.filter((i) => i.severity === "error");
  const warnings = scanResult.issues.filter((i) => i.severity === "warning");
  const infos = scanResult.issues.filter((i) => i.severity === "info");

  return (
    <div className="space-y-4">
      {/* Assurance Banner */}
      <div className={`p-4 rounded-lg border ${assuranceBg[scanResult.assurance]}`}>
        <div className="flex items-center gap-2 mb-1">
          {assuranceIcons[scanResult.assurance]}
          <span className={`font-medium text-sm ${assuranceColors[scanResult.assurance]}`}>
            {scanResult.assurance === "high" ? "Ready to Build" : scanResult.assurance === "medium" ? "Review Recommended" : "Issues Found"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{scanResult.assuranceMessage}</p>
      </div>

      {/* Detected Info Grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Framework", value: scanResult.framework },
          { label: "Package Manager", value: scanResult.packageManager },
          { label: "Files", value: String(scanResult.totalFiles) },
          { label: "Size", value: scanResult.totalSize },
          { label: "Build", value: scanResult.buildCommand },
          { label: "Output", value: scanResult.outputDir },
        ].map((item) => (
          <div key={item.label} className="px-3 py-2 rounded-lg bg-muted/30 border border-border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
            <p className="text-xs font-medium text-foreground mt-0.5 font-mono">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Issues */}
      {scanResult.issues.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {errors.length > 0 && <span className="flex items-center gap-1 text-destructive"><XCircle size={12} /> {errors.length} errors</span>}
            {warnings.length > 0 && <span className="flex items-center gap-1 text-[hsl(var(--warning))]"><AlertTriangle size={12} /> {warnings.length} warnings</span>}
            {infos.length > 0 && <span className="flex items-center gap-1 text-[hsl(var(--info))]"><Info size={12} /> {infos.length} info</span>}
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-border">
            {scanResult.issues.slice(0, 20).map((issue, i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-1.5 text-xs border-b border-border last:border-0">
                {issue.severity === "error" ? (
                  <XCircle size={12} className="text-destructive shrink-0 mt-0.5" />
                ) : issue.severity === "warning" ? (
                  <AlertTriangle size={12} className="text-[hsl(var(--warning))] shrink-0 mt-0.5" />
                ) : (
                  <Info size={12} className="text-[hsl(var(--info))] shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <span className="text-muted-foreground font-mono">{issue.file}{issue.line ? `:${issue.line}` : ""}</span>
                  <span className="mx-1.5 text-muted-foreground/40">—</span>
                  <span className="text-foreground/80">{issue.message}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File Connectivity */}
      {scanResult.connectivity.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">File Connectivity ({scanResult.connectivity.length} connections)</p>
          <div className="max-h-32 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
            {scanResult.connectivity.slice(0, 15).map((conn, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                <span className="truncate max-w-[40%]">{conn.from.split("/").pop()}</span>
                <ArrowRight size={10} className="text-primary shrink-0" />
                <span className="truncate max-w-[40%]">{conn.to.split("/").pop()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanResults;

/**
 * Build Error Panel
 * Shows classified build errors with AI-suggested fixes and retry capability.
 */

import { AlertTriangle, Lightbulb, RefreshCw, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { BuildErrorInfo } from "@/stores/buildStore";
import { parseBuildError, type ParsedBuildError } from "@/lib/tools/buildErrorParser";

interface BuildErrorPanelProps {
  error?: string;
  errorInfo?: BuildErrorInfo;
  logs: string[];
  repoUrl?: string;
  onRetry?: () => void;
  onFixAndRetry?: (fix: string) => void;
}

interface ClassifiedError {
  category: string;
  detail: string;
  suggestion: string;
  failedStep?: string;
  severity: "critical" | "warning" | "info";
}

function classifyError(error?: string, errorInfo?: BuildErrorInfo, logs: string[] = []): ClassifiedError {
  if (errorInfo?.errorType) {
    return {
      category: errorInfo.errorType,
      detail: errorInfo.errorDetail || "Build failed",
      suggestion: errorInfo.suggestedFix || "Check the build logs for details.",
      failedStep: errorInfo.failedStep,
      severity: "critical",
    };
  }

  const allText = [error || "", ...logs].join("\n");

  // Parse using the build error parser tool
  const parsed = parseBuildError(logs, error);
  if (parsed && parsed.category !== "unknown") {
    return {
      category: parsed.category,
      detail: parsed.detail,
      suggestion: parsed.suggestedFix,
      severity: parsed.severity === "blocker" || parsed.severity === "error" ? "critical" : "warning",
    };
  }

  // Fallback classification
  if (allText.includes("npm ERR!") || allText.includes("ERESOLVE")) {
    return { category: "Dependency Error", detail: "npm dependency installation failed", suggestion: "Check package.json for invalid or private dependencies. Try removing package-lock.json.", severity: "critical" };
  }
  if (allText.includes("BUILD FAILED") || allText.includes("Gradle")) {
    return { category: "Gradle Build Error", detail: "Android native build failed", suggestion: "Check SDK versions and Gradle configuration. Ensure compileSdkVersion matches.", severity: "critical" };
  }
  if (allText.includes("cap init") || allText.includes("cap add") || allText.includes("cap sync")) {
    return { category: "Capacitor Error", detail: "Capacitor initialization failed", suggestion: "Ensure your project has a valid package.json and a build output directory (dist/build/www).", severity: "critical" };
  }

  return {
    category: "Build Error",
    detail: error || "Unknown build failure",
    suggestion: "Check the build logs for more details.",
    severity: "critical",
  };
}

const BuildErrorPanel = ({ error, errorInfo, logs, repoUrl, onRetry, onFixAndRetry }: BuildErrorPanelProps) => {
  const [showErrorLines, setShowErrorLines] = useState(false);
  const classified = classifyError(error, errorInfo, logs);

  const errorLines = logs.filter(l =>
    l.includes("✗") || l.includes("ERR") || l.includes("FAIL") ||
    l.includes("Error") || l.includes("Exception") || l.includes("error:") ||
    l.includes("not found") || l.includes("missing") || l.includes("Cannot")
  );

  return (
    <div className="rounded-xl bg-destructive/5 border border-destructive/20 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-destructive/10 flex items-center gap-2">
        <AlertTriangle size={16} className="text-destructive shrink-0" />
        <span className="text-sm font-semibold text-destructive">Build Failure Report</span>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-destructive/20 text-destructive font-medium">
          {classified.category}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* What went wrong */}
        <div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">What Went Wrong</span>
          <p className="text-sm text-foreground/80 mt-0.5">{classified.detail}</p>
        </div>

        {classified.failedStep && (
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Failed Step</span>
            <p className="text-sm font-medium text-foreground mt-0.5">{classified.failedStep}</p>
          </div>
        )}

        {/* AI Suggestion */}
        <div className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Lightbulb size={13} className="text-primary" />
            <span className="text-[10px] uppercase tracking-wider text-primary font-medium">Suggested Fix</span>
          </div>
          <p className="text-sm text-foreground/80">{classified.suggestion}</p>
        </div>

        {/* Error lines */}
        {errorLines.length > 0 && (
          <div>
            <button
              onClick={() => setShowErrorLines(!showErrorLines)}
              className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {showErrorLines ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              Error Lines ({errorLines.length})
            </button>
            {showErrorLines && (
              <div className="mt-1.5 rounded-lg bg-background/80 border border-border p-2 max-h-40 overflow-y-auto">
                {errorLines.slice(0, 30).map((line, i) => (
                  <div key={i} className="text-xs text-destructive/80 font-mono py-0.5 break-all">{line}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          {onFixAndRetry && classified.suggestion && (
            <Button size="sm" className="gap-1.5" onClick={() => onFixAndRetry(classified.suggestion)}>
              <Lightbulb size={13} /> Fix & Retry
            </Button>
          )}
          {onRetry && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onRetry}>
              <RefreshCw size={13} /> Retry Build
            </Button>
          )}
          {repoUrl && (
            <a
              href={`${repoUrl}/actions`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink size={12} /> View on GitHub
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default BuildErrorPanel;

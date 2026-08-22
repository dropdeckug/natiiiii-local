import { useMemo } from "react";

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

interface DiffViewerProps {
  oldCode: string;
  newCode: string;
  fileName?: string;
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: DiffLine[] = [];

  // Simple LCS-based diff
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack
  const changes: DiffLine[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      changes.unshift({ type: "unchanged", content: oldLines[i - 1], oldLineNum: i, newLineNum: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      changes.unshift({ type: "added", content: newLines[j - 1], newLineNum: j });
      j--;
    } else {
      changes.unshift({ type: "removed", content: oldLines[i - 1], oldLineNum: i });
      i--;
    }
  }

  return changes;
}

const DiffViewer = ({ oldCode, newCode, fileName }: DiffViewerProps) => {
  const diff = useMemo(() => computeDiff(oldCode, newCode), [oldCode, newCode]);

  const added = diff.filter(d => d.type === "added").length;
  const removed = diff.filter(d => d.type === "removed").length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/20">
        {fileName && <span className="text-xs font-medium text-foreground font-mono">{fileName}</span>}
        <div className="flex items-center gap-2 ml-auto">
          {added > 0 && <span className="text-[11px] font-mono text-green-500">+{added}</span>}
          {removed > 0 && <span className="text-[11px] font-mono text-red-500">-{removed}</span>}
        </div>
      </div>

      {/* Diff lines */}
      <div className="flex-1 overflow-auto font-mono text-[12px] leading-[20px]">
        {diff.map((line, idx) => (
          <div
            key={idx}
            className={`flex min-h-[20px] ${
              line.type === "added"
                ? "bg-green-500/10"
                : line.type === "removed"
                ? "bg-red-500/10"
                : ""
            }`}
          >
            {/* Old line number */}
            <span className="w-10 shrink-0 text-right pr-2 select-none text-muted-foreground/40">
              {line.type !== "added" ? line.oldLineNum : ""}
            </span>
            {/* New line number */}
            <span className="w-10 shrink-0 text-right pr-2 select-none text-muted-foreground/40">
              {line.type !== "removed" ? line.newLineNum : ""}
            </span>
            {/* +/- indicator */}
            <span
              className={`w-5 shrink-0 text-center select-none ${
                line.type === "added"
                  ? "text-green-500"
                  : line.type === "removed"
                  ? "text-red-500"
                  : "text-transparent"
              }`}
            >
              {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
            </span>
            {/* Content */}
            <span
              className={`flex-1 pr-4 whitespace-pre ${
                line.type === "added"
                  ? "text-green-400"
                  : line.type === "removed"
                  ? "text-red-400"
                  : "text-foreground/80"
              }`}
            >
              {line.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export { computeDiff, type DiffLine };
export default DiffViewer;

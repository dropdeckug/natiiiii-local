import { Skeleton } from "@/components/ui/skeleton";

/**
 * Code-shaped skeleton: line-number gutter + monospace-height shimmer bars
 * matching SyntaxHighlighter's layout. Used while file contents load.
 */
const widths = [72, 54, 88, 36, 64, 80, 42, 70, 58, 84, 30, 66, 76, 48, 90, 52, 68, 40, 82, 60, 74, 44, 86, 56];

const CodeLinesSkeleton = ({ rows = 24 }: { rows?: number }) => {
  return (
    <div className="flex font-mono text-[12px] leading-[1.6] select-none">
      {/* Line number gutter */}
      <div className="bg-muted/30 border-r border-border px-3 py-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="text-muted-foreground/30 text-right tabular-nums"
            style={{ height: "1.6em" }}
          >
            {i + 1}
          </div>
        ))}
      </div>
      {/* Shimmer bars sized like code lines */}
      <div className="flex-1 px-3 py-3 space-y-0">
        {Array.from({ length: rows }).map((_, i) => {
          const w = widths[i % widths.length];
          const indent = (i % 4) * 16;
          return (
            <div key={i} className="flex items-center" style={{ height: "1.6em" }}>
              <div style={{ width: indent }} />
              <Skeleton className="h-[10px] rounded-sm" style={{ width: `${w}%` }} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CodeLinesSkeleton;

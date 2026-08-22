import { useMemo } from "react";
import type { BuildJob } from "@/stores/buildStore";

interface Props {
  jobs: BuildJob[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const BuildHeatMap = ({ jobs }: Props) => {
  const { grid, max } = useMemo(() => {
    const g: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    jobs.forEach((j) => {
      const d = new Date(j.startedAt);
      g[d.getDay()][d.getHours()]++;
    });
    const m = Math.max(1, ...g.flat());
    return { grid: g, max: m };
  }, [jobs]);

  const getColor = (val: number) => {
    if (val === 0) return "hsl(var(--muted) / 0.3)";
    const intensity = val / max;
    if (intensity < 0.25) return "hsl(var(--chart-green) / 0.2)";
    if (intensity < 0.5) return "hsl(var(--chart-green) / 0.4)";
    if (intensity < 0.75) return "hsl(var(--chart-green) / 0.65)";
    return "hsl(var(--chart-green) / 0.9)";
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-1">Build Activity Heatmap</h3>
      <p className="text-xs text-muted-foreground mb-4">When builds happen (day × hour)</p>

      <div className="overflow-x-auto">
        <div className="min-w-[500px]">
          {/* Hour labels */}
          <div className="flex ml-10 mb-1">
            {HOURS.filter((_, i) => i % 3 === 0).map((h) => (
              <div key={h} className="text-[9px] text-muted-foreground" style={{ width: `${(3 / 24) * 100}%` }}>
                {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
              </div>
            ))}
          </div>

          {/* Grid */}
          {DAYS.map((day, di) => (
            <div key={day} className="flex items-center gap-1 mb-[3px]">
              <span className="text-[10px] text-muted-foreground w-8 text-right shrink-0">{day}</span>
              <div className="flex-1 flex gap-[2px]">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="flex-1 aspect-square rounded-[3px] transition-colors hover:ring-1 hover:ring-primary/50"
                    style={{ backgroundColor: getColor(grid[di][h]) }}
                    title={`${day} ${h}:00 — ${grid[di][h]} builds`}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center justify-end gap-1 mt-3">
            <span className="text-[9px] text-muted-foreground mr-1">Less</span>
            {[0, 0.2, 0.4, 0.65, 0.9].map((op, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-[2px]"
                style={{ backgroundColor: i === 0 ? "hsl(var(--muted) / 0.3)" : `hsl(var(--chart-green) / ${op})` }}
              />
            ))}
            <span className="text-[9px] text-muted-foreground ml-1">More</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuildHeatMap;

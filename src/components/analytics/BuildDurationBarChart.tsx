import { useMemo } from "react";
import type { BuildJob } from "@/stores/buildStore";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";

interface Props {
  jobs: BuildJob[];
}

const ENGINE_COLORS: Record<string, string> = {
  capacitor: "hsl(var(--chart-green))",
  ionic: "hsl(var(--chart-blue))",
  twa: "hsl(var(--chart-yellow))",
  electron: "hsl(var(--chart-purple))",
  webview: "hsl(var(--chart-orange))",
};

const BuildDurationBarChart = ({ jobs }: Props) => {
  const data = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    jobs.forEach((j) => {
      if (!j.completedAt) return;
      const dur = (j.completedAt - j.startedAt) / 1000;
      const entry = map.get(j.engine) || { total: 0, count: 0 };
      entry.total += dur;
      entry.count++;
      map.set(j.engine, entry);
    });

    return [...map.entries()]
      .map(([engine, v]) => ({
        engine: engine.charAt(0).toUpperCase() + engine.slice(1),
        engineKey: engine,
        avgDuration: Math.round(v.total / v.count),
        builds: v.count,
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration);
  }, [jobs]);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-1">Avg Build Duration by Engine</h3>
      <p className="text-xs text-muted-foreground mb-4">Seconds per build</p>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="engine" tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} axisLine={false} tickLine={false} width={80} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: number) => [`${value}s`, "Avg Duration"]}
            />
            <Bar dataKey="avgDuration" radius={[0, 6, 6, 0]} barSize={20}>
              {data.map((entry) => (
                <Cell key={entry.engine} fill={ENGINE_COLORS[entry.engineKey] || "hsl(var(--muted))"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default BuildDurationBarChart;

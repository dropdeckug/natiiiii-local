import { useMemo } from "react";
import type { BuildJob } from "@/stores/buildStore";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface Props {
  jobs: BuildJob[];
}

const BuildsOverTimeChart = ({ jobs }: Props) => {
  const data = useMemo(() => {
    const map = new Map<string, { success: number; failure: number; total: number }>();

    // Group by date
    jobs.forEach((j) => {
      const d = new Date(j.startedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const entry = map.get(key) || { success: 0, failure: 0, total: 0 };
      entry.total++;
      if (j.status === "success") entry.success++;
      if (j.status === "failure") entry.failure++;
      map.set(key, entry);
    });

    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({
        date: new Date(date).toLocaleDateString("en", { month: "short", day: "numeric" }),
        ...vals,
      }));
  }, [jobs]);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-1">Build Activity</h3>
      <p className="text-xs text-muted-foreground mb-4">Builds over time</p>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradSuccess" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-green))" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(var(--chart-green))" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-yellow))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--chart-yellow))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Area type="monotone" dataKey="total" stroke="hsl(var(--chart-yellow))" strokeWidth={2.5} fill="url(#gradTotal)" name="Total" />
            <Area type="monotone" dataKey="success" stroke="hsl(var(--chart-green))" strokeWidth={2} fill="url(#gradSuccess)" name="Success" />
            <Area type="monotone" dataKey="failure" stroke="hsl(var(--chart-red))" strokeWidth={1.5} fill="none" strokeDasharray="4 2" name="Failed" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default BuildsOverTimeChart;

import { useMemo } from "react";
import type { BuildJob } from "@/stores/buildStore";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

interface Props {
  jobs: BuildJob[];
}

const STATUS_COLORS: Record<string, string> = {
  success: "hsl(var(--chart-green))",
  failure: "hsl(var(--chart-red))",
  building: "hsl(var(--chart-yellow))",
  queued: "hsl(var(--chart-blue))",
  uploading: "hsl(var(--chart-orange))",
  timeout: "hsl(var(--chart-purple))",
};

const StatusDonutChart = ({ jobs }: Props) => {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    jobs.forEach((j) => map.set(j.status, (map.get(j.status) || 0) + 1));
    return [...map.entries()].map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  }, [jobs]);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-1">Build Status</h3>
      <div className="flex items-center gap-3">
        <div className="w-[120px] h-[120px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value" strokeWidth={0}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name.toLowerCase()] || "hsl(var(--muted))"} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "11px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-lg font-bold text-foreground">{total}</span>
          </div>
        </div>
        <div className="flex-1 space-y-1.5">
          {data.map((d) => (
            <div key={d.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[d.name.toLowerCase()] || "hsl(var(--muted))" }} />
                <span className="text-muted-foreground">{d.name}</span>
              </div>
              <span className="font-medium text-foreground">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StatusDonutChart;

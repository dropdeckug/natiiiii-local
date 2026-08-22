import { useMemo } from "react";
import type { BuildJob } from "@/stores/buildStore";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

interface Props {
  jobs: BuildJob[];
}

const COLORS = [
  "hsl(var(--chart-yellow))",
  "hsl(var(--chart-green))",
  "hsl(var(--chart-blue))",
  "hsl(var(--chart-orange))",
  "hsl(var(--chart-purple))",
  "hsl(var(--chart-teal))",
];

const EngineDonutChart = ({ jobs }: Props) => {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    jobs.forEach((j) => map.set(j.engine, (map.get(j.engine) || 0) + 1));
    return [...map.entries()].map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  }, [jobs]);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-1">Engine Distribution</h3>
      <div className="flex items-center gap-3">
        <div className="w-[120px] h-[120px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={55}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
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
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
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

export default EngineDonutChart;

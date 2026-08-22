import type { BuildJob } from "@/stores/buildStore";
import { TrendingUp, TrendingDown, Package, CheckCircle2, Clock, Zap } from "lucide-react";

interface KpiCardsProps {
  jobs: BuildJob[];
}

const KpiCards = ({ jobs }: KpiCardsProps) => {
  const total = jobs.length;
  const successful = jobs.filter((j) => j.status === "success").length;
  const failed = jobs.filter((j) => j.status === "failure").length;
  const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;

  const completedJobs = jobs.filter((j) => j.completedAt && j.startedAt);
  const avgDuration = completedJobs.length > 0
    ? Math.round(completedJobs.reduce((sum, j) => sum + ((j.completedAt! - j.startedAt) / 1000), 0) / completedJobs.length)
    : 0;

  const engines = new Set(jobs.map((j) => j.engine));

  const cards = [
    {
      label: "TOTAL BUILDS",
      value: total.toLocaleString(),
      icon: Package,
      trend: "+12%",
      up: true,
      color: "hsl(var(--chart-yellow))",
      bgColor: "hsl(var(--chart-yellow) / 0.12)",
    },
    {
      label: "SUCCESS RATE",
      value: `${successRate}%`,
      icon: CheckCircle2,
      trend: successRate > 70 ? "+5%" : "-3%",
      up: successRate > 70,
      color: "hsl(var(--chart-green))",
      bgColor: "hsl(var(--chart-green) / 0.12)",
    },
    {
      label: "FAILED BUILDS",
      value: failed.toLocaleString(),
      icon: Zap,
      trend: failed > 5 ? "+8%" : "-15%",
      up: failed <= 5,
      color: "hsl(var(--chart-red))",
      bgColor: "hsl(var(--chart-red) / 0.12)",
    },
    {
      label: "AVG DURATION",
      value: avgDuration > 60 ? `${Math.round(avgDuration / 60)}m` : `${avgDuration}s`,
      icon: Clock,
      trend: "-8%",
      up: true,
      color: "hsl(var(--chart-blue))",
      bgColor: "hsl(var(--chart-blue) / 0.12)",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className="relative overflow-hidden rounded-xl border border-border bg-card p-4 group hover:shadow-lg transition-shadow"
          >
            {/* Accent top bar */}
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl" style={{ backgroundColor: c.color }} />

            <div className="flex items-start justify-between mb-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: c.bgColor }}
              >
                <Icon size={20} style={{ color: c.color }} />
              </div>
              <div className={`flex items-center gap-0.5 text-xs font-medium ${c.up ? "text-success" : "text-destructive"}`}>
                {c.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {c.trend}
              </div>
            </div>

            <p className="text-2xl font-bold text-foreground tracking-tight">{c.value}</p>
            <p className="text-[10px] font-semibold text-muted-foreground tracking-widest mt-1">{c.label}</p>
          </div>
        );
      })}
    </div>
  );
};

export default KpiCards;

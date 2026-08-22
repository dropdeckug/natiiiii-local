import { useState, useMemo } from "react";
import { useBuildStore, type BuildJob } from "@/stores/buildStore";
import KpiCards from "./KpiCards";
import BuildsOverTimeChart from "./BuildsOverTimeChart";
import EngineDonutChart from "./EngineDonutChart";
import StatusDonutChart from "./StatusDonutChart";
import BuildDurationBarChart from "./BuildDurationBarChart";
import BuildHeatMap from "./BuildHeatMap";
import BuildsTable from "./BuildsTable";
import FilterPanel from "./FilterPanel";

export type FilterState = {
  engine: string;
  status: string;
  timeRange: "7d" | "30d" | "90d" | "all";
};

const AnalyticsDashboard = () => {
  const { jobs } = useBuildStore();
  const [filters, setFilters] = useState<FilterState>({
    engine: "all",
    status: "all",
    timeRange: "all",
  });

  const filteredJobs = useMemo(() => {
    let result = [...jobs];
    if (filters.engine !== "all") {
      result = result.filter((j) => j.engine === filters.engine);
    }
    if (filters.status !== "all") {
      result = result.filter((j) => j.status === filters.status);
    }
    if (filters.timeRange !== "all") {
      const days = filters.timeRange === "7d" ? 7 : filters.timeRange === "30d" ? 30 : 90;
      const cutoff = Date.now() - days * 86400000;
      result = result.filter((j) => j.startedAt >= cutoff);
    }
    return result;
  }, [jobs, filters]);

  // Generate demo data if no real builds exist
  const displayJobs = useMemo(() => {
    if (jobs.length > 0) return filteredJobs;
    return generateDemoData();
  }, [jobs, filteredJobs]);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Analytics</h1>
            <p className="text-sm text-muted-foreground">
              {jobs.length > 0 ? "Live build data" : "Demo data — build an APK to see real analytics"}
            </p>
          </div>
        </div>

        {/* Filters */}
        <FilterPanel filters={filters} onChange={setFilters} jobs={jobs.length > 0 ? jobs : displayJobs} />

        {/* KPI Cards */}
        <KpiCards jobs={displayJobs} />

        {/* Row 1: Line chart + Donut charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <BuildsOverTimeChart jobs={displayJobs} />
          </div>
          <div className="space-y-4">
            <EngineDonutChart jobs={displayJobs} />
            <StatusDonutChart jobs={displayJobs} />
          </div>
        </div>

        {/* Row 2: Bar chart + Heat map */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BuildDurationBarChart jobs={displayJobs} />
          <BuildHeatMap jobs={displayJobs} />
        </div>

        {/* Table */}
        <BuildsTable jobs={displayJobs} />
      </div>
    </div>
  );
};

function generateDemoData(): BuildJob[] {
  const engines = ["capacitor", "ionic", "twa", "electron", "webview"];
  const statuses: BuildJob["status"][] = ["success", "failure", "building", "queued"];
  const names = ["EarlyMarket", "SK Sure Wins", "Portfolio", "GameHub", "TaskFlow", "ShopNow", "FitTrack", "NewsApp"];
  const demo: BuildJob[] = [];

  for (let i = 0; i < 48; i++) {
    const engine = engines[i % engines.length];
    const status = statuses[Math.floor(Math.random() * 4)];
    const daysAgo = Math.floor(Math.random() * 60);
    const hour = Math.floor(Math.random() * 24);
    const startedAt = Date.now() - daysAgo * 86400000 - hour * 3600000;
    const duration = 30000 + Math.random() * 270000; // 30s - 5min

    demo.push({
      id: `demo-${i}`,
      appName: names[i % names.length],
      packageName: `com.demo.${names[i % names.length].toLowerCase()}`,
      engine,
      status,
      stage: status === "success" ? "complete" : status === "failure" ? "gradle-build" : "preparing",
      logs: [],
      startedAt,
      completedAt: status === "success" || status === "failure" ? startedAt + duration : undefined,
    });
  }

  return demo;
}

export default AnalyticsDashboard;

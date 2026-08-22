import type { FilterState } from "./AnalyticsDashboard";
import type { BuildJob } from "@/stores/buildStore";
import { Filter } from "lucide-react";

interface FilterPanelProps {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  jobs: BuildJob[];
}

const FilterPanel = ({ filters, onChange, jobs }: FilterPanelProps) => {
  const engines = [...new Set(jobs.map((j) => j.engine))];

  const pill = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
      active
        ? "bg-primary text-primary-foreground shadow-sm"
        : "bg-muted text-muted-foreground hover:bg-muted/80"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-card border border-border">
      <Filter size={14} className="text-muted-foreground" />

      {/* Time range */}
      <div className="flex gap-1">
        {(["7d", "30d", "90d", "all"] as const).map((t) => (
          <button key={t} className={pill(filters.timeRange === t)} onClick={() => onChange({ ...filters, timeRange: t })}>
            {t === "all" ? "All" : t === "7d" ? "7 Days" : t === "30d" ? "30 Days" : "90 Days"}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Engine */}
      <div className="flex gap-1">
        <button className={pill(filters.engine === "all")} onClick={() => onChange({ ...filters, engine: "all" })}>All Engines</button>
        {engines.map((e) => (
          <button key={e} className={pill(filters.engine === e)} onClick={() => onChange({ ...filters, engine: e })}>
            {e.charAt(0).toUpperCase() + e.slice(1)}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Status */}
      <div className="flex gap-1">
        <button className={pill(filters.status === "all")} onClick={() => onChange({ ...filters, status: "all" })}>All Status</button>
        {["success", "failure", "building"].map((s) => (
          <button key={s} className={pill(filters.status === s)} onClick={() => onChange({ ...filters, status: s })}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default FilterPanel;

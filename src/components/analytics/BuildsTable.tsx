import { useMemo, useState } from "react";
import type { BuildJob } from "@/stores/buildStore";

interface Props {
  jobs: BuildJob[];
}

const statusColor: Record<string, string> = {
  success: "bg-chart-green/15 text-chart-green",
  failure: "bg-chart-red/15 text-chart-red",
  building: "bg-chart-yellow/15 text-chart-yellow",
  queued: "bg-chart-blue/15 text-chart-blue",
  uploading: "bg-chart-orange/15 text-chart-orange",
  timeout: "bg-chart-purple/15 text-chart-purple",
};

const PAGE_SIZE = 10;

const BuildsTable = ({ jobs }: Props) => {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<"startedAt" | "appName" | "engine">("startedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    return [...jobs].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "startedAt") cmp = a.startedAt - b.startedAt;
      else if (sortKey === "appName") cmp = a.appName.localeCompare(b.appName);
      else cmp = a.engine.localeCompare(b.engine);
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [jobs, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const formatDuration = (j: BuildJob) => {
    if (!j.completedAt) return "—";
    const s = Math.round((j.completedAt - j.startedAt) / 1000);
    return s > 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
  };

  const arrow = (key: typeof sortKey) => sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Build Log</h3>
        <p className="text-xs text-muted-foreground">{sorted.length} total builds</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/30">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => handleSort("appName")}>
                App{arrow("appName")}
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => handleSort("engine")}>
                Engine{arrow("engine")}
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Duration</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => handleSort("startedAt")}>
                Date{arrow("startedAt")}
              </th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((j) => (
              <tr key={j.id} className="border-t border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-2.5 font-medium text-foreground">{j.appName}</td>
                <td className="px-4 py-2.5 text-muted-foreground capitalize">{j.engine}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor[j.status] || "bg-muted text-muted-foreground"}`}>
                    {j.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground font-mono">{formatDuration(j)}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {new Date(j.startedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="px-2.5 py-1 rounded-md text-xs bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-2.5 py-1 rounded-md text-xs bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuildsTable;

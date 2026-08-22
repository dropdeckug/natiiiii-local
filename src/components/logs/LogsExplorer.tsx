import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Code2,
  Download,
  Filter,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  ServerCog,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  LEVELS,
  LOG_TYPES,
  METHODS,
  PHASES,
  PLATFORMS,
  TIME_RANGES,
  bucketLogs,
  emptyFilters,
  rowMethod,
  rowPathname,
  useBuildLogs,
  type BuildLogRow,
  type LogFilters,
} from "@/hooks/useBuildLogs";
import { cn } from "@/lib/utils";
import JsonHighlight from "@/components/logs/JsonHighlight";

interface LogsExplorerProps {
  projectId?: string;
  repoName?: string;
  runId?: number;
  platform?: string;
}

type FilterKey = "types" | "levels" | "platforms" | "phases" | "methods";

const toggleItem = (filters: LogFilters, key: FilterKey, value: string): LogFilters => {
  const values = filters[key];
  return { ...filters, [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] };
};

const statusTone = (row: BuildLogRow) => {
  if (row.level === "error") return "text-destructive";
  if (row.level === "warning") return "text-warning";
  if (row.level === "success") return "text-success";
  return "text-muted-foreground";
};

const FilterSection = ({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) => (
  <section className="border-b border-border py-3">
    <Button variant="ghost" onClick={onToggle} className="h-7 w-full justify-between px-0 text-xs font-medium hover:bg-transparent">
      {label}
      {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
    </Button>
    {open && <div className="pt-2">{children}</div>}
  </section>
);

const LogCheckbox = ({ checked, label, suffix, tone, onChange }: {
  checked: boolean;
  label: string;
  suffix?: React.ReactNode;
  tone?: string;
  onChange: () => void;
}) => (
  <label className="flex h-8 cursor-pointer items-center gap-2 rounded-[3px] px-2 text-[11px] hover:bg-muted/50">
    <Checkbox checked={checked} onCheckedChange={onChange} className="h-3.5 w-3.5 border-border data-[state=checked]:border-primary" />
    {tone && <span className={cn("h-2 w-2 rounded-[2px]", tone)} />}
    <span className="min-w-0 flex-1 truncate text-foreground">{label}</span>
    {suffix && <span className="font-mono text-[10px] text-muted-foreground">{suffix}</span>}
  </label>
);

const overviewFields = (row: BuildLogRow, repoName?: string) => [
  { label: "Timestamp", value: new Date(row.ts).toLocaleString() },
  { label: "Level", value: row.level, tone: statusTone(row) },
  { label: "Log type", value: row.log_type },
  { label: "Status", value: String(row.status_code ?? "—") },
  { label: "Method", value: rowMethod(row) ?? "—" },
  { label: "Pathname", value: rowPathname(row) ?? "—" },
  { label: "Phase", value: row.phase ?? "—" },
  { label: "Platform", value: row.platform ?? "—" },
  { label: "Job", value: row.job_name ?? "—" },
  { label: "Step", value: row.step_name ?? "—" },
  { label: "Conclusion", value: row.conclusion ?? "—" },
  { label: "Run", value: row.run_id ? `#${row.run_id}` : "—" },
  { label: "Repository", value: repoName ?? (row.meta?.repoName as string) ?? "—" },
  { label: "Log id", value: row.id },
];


export default function LogsExplorer({ projectId, repoName, runId, platform }: LogsExplorerProps = {}) {
  const [filters, setFilters] = useState<LogFilters>(() => ({
    ...emptyFilters,
    platforms: platform ? [platform] : [],
  }));
  const [live, setLive] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selected, setSelected] = useState<BuildLogRow | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "code">("overview");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ time: true, type: true, level: true });
  const { rows, loading, error, hasMore, reload, loadMore } = useBuildLogs(projectId, filters, live);

  useEffect(() => {
    if (selected && !rows.some((row) => row.id === selected.id)) setSelected(null);
  }, [rows, selected]);

  const histogram = useMemo(() => bucketLogs(rows, 36), [rows]);
  const maxBucket = Math.max(1, ...histogram.map((bucket) => bucket.count));
  const counts = useMemo(() => ({
    types: Object.fromEntries(LOG_TYPES.map((item) => [item.id, rows.filter((row) => row.log_type === item.id).length])),
    levels: Object.fromEntries(LEVELS.map((item) => [item.id, rows.filter((row) => row.level === item.id).length])),
  }), [rows]);
  const activeFilterCount = filters.types.length + filters.levels.length + filters.platforms.length + filters.phases.length + filters.methods.length + (filters.pathname ? 1 : 0);

  const reset = () => {
    setFilters({ ...emptyFilters, platforms: platform ? [platform] : [] });
    setSelected(null);
  };

  const downloadLogs = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nativebridge-logs-${projectId ?? "project"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const iconButton = (label: string, icon: React.ReactNode, onClick: () => void) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={onClick} className="h-7 w-7 border border-border">{icon}</Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h1 className="text-sm font-semibold">Logs</h1>
          <span className="rounded-[3px] border border-border px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">BETA</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {repoName && <span className="hidden max-w-40 truncate font-mono text-[10px] text-muted-foreground lg:inline">{repoName}</span>}
          {runId && <span className="hidden font-mono text-[10px] text-muted-foreground lg:inline">#{runId}</span>}
          {iconButton("Refresh logs", <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />, () => void reload())}
          {iconButton("Download JSON", <Download className="h-3.5 w-3.5" />, downloadLogs)}
          <Button
            variant={live ? "secondary" : "outline"}
            onClick={() => setLive((value) => !value)}
            className="h-7 gap-1.5 px-2.5 text-[11px]"
          >
            {live ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {live ? "Live" : "Paused"}
          </Button>
        </div>
      </header>

      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        {iconButton(sidebarOpen ? "Collapse filters" : "Open filters", sidebarOpen ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />, () => setSidebarOpen((value) => !value))}
        <div className="relative min-w-32 max-w-64 flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search logs..." className="h-7 rounded-[3px] pl-7 text-[11px]" />
        </div>
        <div className="hidden h-7 items-center gap-1 rounded-[3px] border border-border px-2 text-[10px] text-muted-foreground md:flex">
          <Filter className="h-3 w-3" />
          Log type
          <span className="text-foreground">=</span>
          <span className="text-foreground">{filters.types.length ? filters.types.join(", ") : "all"}</span>
        </div>
        <Button variant="ghost" onClick={reset} className="h-7 gap-1.5 px-2 text-[11px]">
          <RotateCcw className="h-3 w-3" /> Reset {activeFilterCount > 0 && `(${activeFilterCount})`}
        </Button>
      </div>

      <div className="min-h-0 flex-1">
        <ResizablePanelGroup direction="horizontal">
          {sidebarOpen && (
            <>
              <ResizablePanel defaultSize={23} minSize={18} maxSize={34}>
                <aside className="h-full overflow-y-auto border-r border-border px-3">
                  <FilterSection label="Time Range" open={openSections.time} onToggle={() => setOpenSections((value) => ({ ...value, time: !value.time }))}>
                    <Select value={filters.range} onValueChange={(range: LogFilters["range"]) => setFilters((current) => ({ ...current, range }))}>
                      <SelectTrigger className="h-8 rounded-[3px] text-[11px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{TIME_RANGES.map((range) => <SelectItem key={range.key} value={range.key} className="text-xs">{range.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </FilterSection>

                  <FilterSection label="Log Type" open={openSections.type} onToggle={() => setOpenSections((value) => ({ ...value, type: !value.type }))}>
                    <div className="relative mb-2">
                      <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                      <Input placeholder="Search types" className="h-8 rounded-[3px] pl-7 text-[11px]" />
                    </div>
                    <div className="max-h-72 overflow-y-auto rounded-[3px] border border-border py-1">
                      {LOG_TYPES.map((item) => <LogCheckbox key={item.id} checked={filters.types.includes(item.id)} label={item.label} suffix={counts.types[item.id] ?? 0} onChange={() => setFilters((current) => toggleItem(current, "types", item.id))} />)}
                    </div>
                  </FilterSection>

                  <FilterSection label="Level" open={openSections.level} onToggle={() => setOpenSections((value) => ({ ...value, level: !value.level }))}>
                    <div className="rounded-[3px] border border-border py-1">
                      {LEVELS.map((item) => <LogCheckbox key={item.id} checked={filters.levels.includes(item.id)} label={item.label} tone={item.tone} suffix={<>{item.badge} &nbsp; {counts.levels[item.id] ?? 0}</>} onChange={() => setFilters((current) => toggleItem(current, "levels", item.id))} />)}
                    </div>
                  </FilterSection>

                  <FilterSection label="Platform / Engine" open={Boolean(openSections.platform)} onToggle={() => setOpenSections((value) => ({ ...value, platform: !value.platform }))}>
                    {PLATFORMS.map((item) => <LogCheckbox key={item.id} checked={filters.platforms.includes(item.id)} label={item.label} onChange={() => setFilters((current) => toggleItem(current, "platforms", item.id))} />)}
                  </FilterSection>
                  <FilterSection label="Phase" open={Boolean(openSections.phase)} onToggle={() => setOpenSections((value) => ({ ...value, phase: !value.phase }))}>
                    {PHASES.map((item) => <LogCheckbox key={item.id} checked={filters.phases.includes(item.id)} label={item.label} onChange={() => setFilters((current) => toggleItem(current, "phases", item.id))} />)}
                  </FilterSection>
                  <FilterSection label="Method" open={Boolean(openSections.method)} onToggle={() => setOpenSections((value) => ({ ...value, method: !value.method }))}>
                    {METHODS.map((method) => <LogCheckbox key={method} checked={filters.methods.includes(method)} label={method} onChange={() => setFilters((current) => toggleItem(current, "methods", method))} />)}
                  </FilterSection>
                  <FilterSection label="Pathname" open={Boolean(openSections.pathname)} onToggle={() => setOpenSections((value) => ({ ...value, pathname: !value.pathname }))}>
                    <Input value={filters.pathname} onChange={(event) => setFilters((current) => ({ ...current, pathname: event.target.value }))} placeholder="/functions/v1/..." className="h-8 rounded-[3px] font-mono text-[10px]" />
                  </FilterSection>

                  <div className="my-3 border border-border p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-medium"><ServerCog className="h-4 w-4" /> Capture your logs</div>
                    <p className="text-[10px] leading-4 text-muted-foreground">Build, CI, API, plugin, signing and AI repair events are scoped to this project.</p>
                  </div>
                </aside>
              </ResizablePanel>
              <ResizableHandle />
            </>
          )}

          <ResizablePanel defaultSize={sidebarOpen ? 77 : 100} minSize={45}>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={selected ? 64 : 100} minSize={32}>
                <main className="flex h-full min-w-0 flex-col overflow-hidden">
                  <div className="h-[76px] shrink-0 border-b border-border px-4 pt-3">
                    <div className="flex h-10 items-end gap-1 border-b border-border/70">
                      {histogram.length === 0 ? <div className="pb-3 text-[10px] text-muted-foreground">No activity in this time range</div> : histogram.map((bucket, index) => (
                        <div key={`${bucket.t}-${index}`} className="group relative flex h-full min-w-1 flex-1 items-end">
                          <div className={cn("w-full bg-muted-foreground/50 group-hover:bg-primary", bucket.errors > 0 && "bg-destructive")} style={{ height: `${Math.max(4, Math.round((bucket.count / maxBucket) * 36))}px` }} />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between pt-1 font-mono text-[9px] text-muted-foreground">
                      <span>{rows.length ? new Date(rows[rows.length - 1].ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                      <span>{rows.length} events</span>
                      <span>{rows.length ? new Date(rows[0].ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                    </div>
                  </div>

                  <div className="grid h-8 shrink-0 grid-cols-[22px_8px_136px_58px_72px_minmax(180px,1fr)_88px] items-center gap-2 border-b border-border px-3 font-mono text-[9px] uppercase text-muted-foreground">
                    <span /><span /><span>Date</span><span>Status</span><span>Method</span><span>Pathname / event</span><span>Type</span>
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto">
                    {error && <div className="m-3 flex items-center gap-2 border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"><CircleAlert className="h-4 w-4" />{error}</div>}
                    {!loading && !error && rows.length === 0 && (
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                        <Code2 className="h-7 w-7 text-muted-foreground" />
                        <p className="text-xs font-medium">No project logs in this range</p>
                        <p className="max-w-sm text-[10px] text-muted-foreground">Start a build or enable Live mode to stream pipeline and API activity here.</p>
                      </div>
                    )}
                    <div className="min-w-[760px]">
                      {rows.map((row) => {
                        const method = rowMethod(row) ?? (row.step_name ? "STEP" : "—");
                        const path = rowPathname(row) ?? row.event_message;
                        const isSelected = selected?.id === row.id;
                        return (
                          <Button
                            key={row.id}
                            variant="ghost"
                            onClick={() => setSelected(isSelected ? null : row)}
                            className={cn("grid h-9 w-full grid-cols-[22px_8px_136px_58px_72px_minmax(180px,1fr)_88px] items-center gap-2 rounded-none border-b border-border/70 px-3 text-left font-mono text-[10px] font-normal hover:bg-muted/50", isSelected && "bg-muted")}
                          >
                            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-[2px] border border-border">{isSelected && <Check className="h-2.5 w-2.5" />}</span>
                            <span className={cn("h-1.5 w-1.5 rounded-full bg-muted-foreground", row.level === "error" && "bg-destructive", row.level === "warning" && "bg-warning", row.level === "success" && "bg-success")} />
                            <span className="truncate text-foreground">{new Date(row.ts).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                            <span className={cn("font-semibold", statusTone(row))}>{row.status_code || (row.level === "success" ? 200 : "—")}</span>
                            <span className="text-muted-foreground">{method}</span>
                            <span className={cn("truncate font-semibold text-foreground", row.level === "error" && "text-destructive")}>{path}</span>
                            <span className="truncate text-muted-foreground">{row.log_type}</span>
                          </Button>
                        );
                      })}
                    </div>
                    {hasMore && <Button variant="ghost" onClick={() => void loadMore()} className="h-9 w-full rounded-none text-xs">Load older events</Button>}
                  </div>
                </main>
              </ResizablePanel>

              {selected && (
                <>
                  <ResizableHandle />
                  <ResizablePanel defaultSize={36} minSize={20}>
                    <section className="flex h-full min-h-0 flex-col bg-card">
                      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border px-3">
                        {(["overview", "code"] as const).map((tab) => (
                          <Button
                            key={tab}
                            variant="ghost"
                            onClick={() => setDetailTab(tab)}
                            className={cn(
                              "h-9 rounded-none border-b-2 border-transparent px-2.5 text-[10px] font-semibold uppercase text-muted-foreground hover:bg-transparent",
                              detailTab === tab && "border-primary text-primary",
                            )}
                          >
                            {tab === "overview" ? "Overview" : "Code"}
                          </Button>
                        ))}
                        <span className="ml-3 truncate font-mono text-[9px] text-muted-foreground">{selected.step_name ?? selected.event_message}</span>
                        <Button variant="ghost" size="icon" onClick={() => setSelected(null)} className="ml-auto h-6 w-6"><X className="h-3.5 w-3.5" /></Button>
                      </div>
                      <div className="min-h-0 flex-1 overflow-auto p-4">
                        {detailTab === "overview" ? (
                          <div className="space-y-3">
                            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                              {overviewFields(selected, repoName).map((field) => (
                                <div key={field.label} className="min-w-0">
                                  <div className="font-mono text-[9px] uppercase text-muted-foreground">{field.label}</div>
                                  <div className={cn("truncate font-mono text-[11px] text-foreground", field.tone)}>{field.value}</div>
                                </div>
                              ))}
                            </div>
                            <div>
                              <div className="font-mono text-[9px] uppercase text-muted-foreground">Message</div>
                              <p className={cn("whitespace-pre-wrap break-words font-mono text-[11px] leading-5", statusTone(selected))}>{selected.event_message}</p>
                            </div>
                            {selected.raw_excerpt && (
                              <div>
                                <div className="font-mono text-[9px] uppercase text-muted-foreground">Raw excerpt</div>
                                <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-[3px] border border-border bg-muted/40 p-2 font-mono text-[10px] leading-5 text-muted-foreground">{selected.raw_excerpt}</pre>
                              </div>
                            )}
                          </div>
                        ) : (
                          <JsonHighlight
                            value={{
                              ...selected,
                              method: rowMethod(selected),
                              pathname: rowPathname(selected),
                              repository: repoName ?? selected.meta?.repoName ?? null,
                            }}
                          />
                        )}
                      </div>
                    </section>
                  </ResizablePanel>
                </>
              )}

            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
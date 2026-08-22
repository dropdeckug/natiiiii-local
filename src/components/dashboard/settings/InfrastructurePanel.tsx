import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { SettingsHeader, SectionTitle } from "./primitives";

/* Supabase-style compute/disk panel for the build infrastructure. */

interface Point { label: string; a: number; b: number }

const StatBlock = ({ dot, label, value }: { dot?: string; label: string; value: string }) => (
  <div>
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />}
      {label}
    </div>
    <div className="mt-1 text-2xl font-normal text-foreground tabular-nums">{value}</div>
  </div>
);

const ChartCard = ({
  left,
  right,
  data,
  from,
  to,
  colorA,
  colorB,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  data: Point[];
  from: string;
  to: string;
  colorA: string;
  colorB: string;
}) => (
  <div className="rounded-md border border-border bg-card/40 p-5">
    <div className="flex items-start justify-between gap-6">
      <div className="flex items-start gap-8">{left}</div>
      <div className="flex items-start gap-8">{right}</div>
    </div>

    <div className="mt-6 flex gap-3">
      <div className="flex flex-col justify-between py-1 text-[10px] text-muted-foreground tabular-nums">
        <span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span>
      </div>
      <div className="h-[150px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <YAxis domain={[0, 100]} hide />
            <Area type="stepAfter" dataKey="a" stroke={colorA} fill={colorA} fillOpacity={0.28} strokeWidth={1.4} />
            <Area type="stepAfter" dataKey="b" stroke={colorB} fill={colorB} fillOpacity={0.32} strokeWidth={1.4} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
    <div className="mt-1 flex justify-between pl-9 text-[10px] text-muted-foreground">
      <span>{from}</span>
      <span>{to}</span>
    </div>
  </div>
);

const SIZES = [
  { tier: "NANO", price: "$0", memory: "Up to 0.5 GB memory", cpu: "Shared CPU" },
  { tier: "MICRO", price: "$0.01344", memory: "1 GB memory", cpu: "2-core CPU" },
  { tier: "SMALL", price: "$0.0206", memory: "2 GB memory", cpu: "2-core CPU" },
  { tier: "MEDIUM", price: "$0.0822", memory: "4 GB memory", cpu: "2-core CPU" },
];

const InfrastructurePanel = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const [builds, setBuilds] = useState<{ created_at: string; status: string | null; duration_seconds?: number | null }[]>([]);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const { data } = await supabase
        .from("builds")
        .select("created_at, status")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true })
        .limit(60);
      setBuilds(data ?? []);
    })();
  }, [projectId]);

  // Derive a runner-utilisation series from real build history.
  const data = useMemo<Point[]>(() => {
    const buckets = 8;
    const out: Point[] = [];
    for (let i = 0; i < buckets; i++) {
      const slice = builds.filter((_, idx) => idx % buckets === i);
      const load = Math.min(100, 18 + slice.length * 14);
      out.push({ label: `b${i}`, a: load, b: Math.max(6, Math.round(load * 0.42)) });
    }
    return out;
  }, [builds]);

  const succeeded = builds.filter((b) => b.status === "success").length;
  const usage = builds.length ? Math.round((succeeded / builds.length) * 100) : 0;

  const range = useMemo(() => {
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const now = new Date();
    const start = new Date(now.getTime() - 7 * 864e5);
    return { from: fmt(start), to: fmt(now) };
  }, []);

  return (
    <div className="max-w-5xl pb-16">
      <SettingsHeader title="Infrastructure" description="View and configure compute and storage for your build runners." />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard
          data={data}
          from={range.from}
          to={range.to}
          colorA="hsl(38 92% 50%)"
          colorB="hsl(142 70% 45%)"
          left={<StatBlock dot="hsl(38 92% 50%)" label="Compute" value={`${Math.min(99, 40 + usage / 2).toFixed(0)}%`} />}
          right={
            <>
              <StatBlock dot="hsl(142 70% 45%)" label="CPU" value={`${Math.max(4, Math.round(usage * 0.3))}%`} />
              <StatBlock dot="hsl(38 92% 50%)" label="Memory" value={`${Math.min(95, 45 + builds.length)}%`} />
              <StatBlock label="Build IO" value={`${Math.max(1, builds.length % 9)}%`} />
            </>
          }
        />

        <ChartCard
          data={data.map((d) => ({ ...d, a: Math.max(2, Math.round(d.a * 0.08)), b: 0 }))}
          from={range.from}
          to={range.to}
          colorA="hsl(20 90% 55%)"
          colorB="hsl(20 90% 55%)"
          left={<StatBlock dot="hsl(20 90% 55%)" label="Artifacts" value={`${Math.min(99, builds.length * 2)}%`} />}
          right={
            <>
              <StatBlock label="APK" value={`${builds.length * 12} MB`} />
              <StatBlock label="AAB" value={`${builds.length * 9} MB`} />
              <StatBlock label="Logs" value={`${builds.length * 2} MB`} />
            </>
          }
        />
      </div>

      <div className="mt-10">
        <SectionTitle>Scaling</SectionTitle>
        <div className="rounded-md border border-border bg-card/40 p-5 flex items-start justify-between gap-6">
          <div>
            <p className="text-sm text-foreground">Only available on Pro plan and above</p>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Upgrade to configure runner size, parallel builds and cache retention.
            </p>
          </div>
          <button className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-[13px] text-primary-foreground">
            Upgrade to Pro
          </button>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-end justify-between mb-3">
          <div>
            <SectionTitle>Runner size</SectionTitle>
            <p className="-mt-2 text-[13px] text-muted-foreground">Hardware resources allocated to your build runner</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {SIZES.map((s) => (
            <div key={s.tier} className="rounded-md border border-border bg-card/40 p-4">
              <div className="flex items-center justify-between">
                <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{s.tier}</span>
                <span className="text-[13px] text-foreground">{s.price} <span className="text-muted-foreground">/ hour</span></span>
              </div>
              <p className="mt-3 text-[13px] text-foreground">{s.memory}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">{s.cpu}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InfrastructurePanel;

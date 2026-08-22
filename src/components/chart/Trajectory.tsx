import { useMemo } from "react";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { extent } from "d3-array";

const WIDTH = 400;
const HEIGHT = 90;
const PAD = { top: 8, right: 8, bottom: 8, left: 26 };

/** Larger sibling of the sparkline: two y labels and a dashed reference line. */
export function Trajectory({ values, alarm }: { values: number[]; alarm?: boolean }) {
  const { d, lastX, lastY, y, lo, hi } = useMemo(() => {
    const [a = 0, b = 100] = extent(values) as [number, number];
    const lo = Math.min(a, 38);
    const hi = Math.max(b, 42);
    const span = hi - lo || 1;
    const xs = scaleLinear()
      .domain([0, Math.max(1, values.length - 1)])
      .range([PAD.left, WIDTH - PAD.right]);
    const ys = scaleLinear()
      .domain([lo - span * 0.1, hi + span * 0.1])
      .range([HEIGHT - PAD.bottom, PAD.top]);
    return {
      d: line<number>().x((_, i) => xs(i)).y((v) => ys(v))(values) ?? "",
      lastX: xs(Math.max(0, values.length - 1)),
      lastY: ys(values[values.length - 1] ?? 0),
      y: ys,
      lo,
      hi,
    };
  }, [values]);

  const stroke = alarm ? "var(--alarm)" : "var(--ink-muted)";

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT} role="img" aria-label="Activity trajectory">
      <line
        x1={PAD.left}
        x2={WIDTH - PAD.right}
        y1={y(40)}
        y2={y(40)}
        stroke="var(--ink-faint)"
        strokeWidth={0.6}
        strokeDasharray="3 4"
        opacity={0.5}
      />
      <text x={0} y={y(hi) + 3} className="font-mono text-[9px] fill-[var(--ink-faint)]">
        {Math.round(hi)}
      </text>
      <text x={0} y={y(lo) + 3} className="font-mono text-[9px] fill-[var(--ink-faint)]">
        {Math.round(lo)}
      </text>
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={2.4} fill={stroke} />
    </svg>
  );
}
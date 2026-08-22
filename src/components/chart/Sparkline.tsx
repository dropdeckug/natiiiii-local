import { useMemo } from "react";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { extent } from "d3-array";

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  alarm?: boolean;
}

/** Inline trajectory line. Thin neutral ink; alarm colours only the last marker. */
export function Sparkline({ values, width = 90, height = 22, alarm }: SparklineProps) {
  const pad = 3;
  const { d, lastX, lastY } = useMemo(() => {
    const [lo = 0, hi = 1] = extent(values) as [number, number];
    const span = hi - lo || 1;
    const x = scaleLinear()
      .domain([0, Math.max(1, values.length - 1)])
      .range([pad, width - 1]);
    const y = scaleLinear()
      .domain([lo - span * 0.08, hi + span * 0.08])
      .range([height - pad, pad]);
    const path = line<number>()
      .x((_, i) => x(i))
      .y((v) => y(v))(values);
    return {
      d: path ?? "",
      lastX: x(Math.max(0, values.length - 1)),
      lastY: y(values[values.length - 1] ?? 0),
    };
  }, [values, width, height]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }} aria-hidden>
      <path
        d={d}
        fill="none"
        stroke="var(--ink-muted)"
        strokeWidth={1}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.85}
      />
      <circle cx={lastX} cy={lastY} r={1.9} fill={alarm ? "var(--alarm)" : "var(--ink-muted)"} />
    </svg>
  );
}
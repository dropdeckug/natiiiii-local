import type { ReactNode } from "react";

interface TooltipProps {
  /** CSS length or percentage, relative to the chart container. */
  x: string;
  y: string;
  children: ReactNode;
}

export function Tooltip({ x, y, children }: TooltipProps) {
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-[4px] border border-rule bg-surface px-3 py-2 shadow-lg"
      style={{ left: x, top: `calc(${y} - 14px)` }}
    >
      {children}
    </div>
  );
}
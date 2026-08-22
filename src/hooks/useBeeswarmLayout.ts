import { useEffect, useRef, useState } from "react";
import {
  forceCollide,
  forceSimulation,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from "d3-force";

export interface BeeswarmInput {
  id: string;
  x: number;
  y: number;
  r: number;
  /** Optional band the node must stay inside, in svg units. */
  yMin?: number;
  yMax?: number;
}

export interface BeeswarmNode extends SimulationNodeDatum {
  id: string;
  targetX: number;
  targetY: number;
  r: number;
  x: number;
  y: number;
  yMin: number;
  yMax: number;
}

/**
 * d3-force computes positions only. React renders. No DOM is touched here.
 * Nodes persist across input changes so filtered updates animate instead of jumping.
 */
export function useBeeswarmLayout(input: BeeswarmInput[], width: number) {
  const [nodes, setNodes] = useState<BeeswarmNode[]>([]);
  const cache = useRef(new Map<string, BeeswarmNode>());

  useEffect(() => {
    if (!width || input.length === 0) {
      setNodes([]);
      return;
    }

    const next: BeeswarmNode[] = input.map((d) => {
      const prev = cache.current.get(d.id);
      return {
        id: d.id,
        targetX: d.x,
        targetY: d.y,
        r: d.r,
        yMin: d.yMin ?? -Infinity,
        yMax: d.yMax ?? Infinity,
        // first appearance starts scattered so the settle is visible
        x: prev?.x ?? Math.random() * width,
        y: prev?.y ?? d.y + (Math.random() - 0.5) * 120,
      };
    });
    next.forEach((n) => cache.current.set(n.id, n));

    const sim = forceSimulation(next)
      .force("x", forceX<BeeswarmNode>((d) => d.targetX).strength(0.9))
      .force("y", forceY<BeeswarmNode>((d) => d.targetY).strength(0.3))
      .force(
        "collide",
        forceCollide<BeeswarmNode>((d) => d.r + 1.2).iterations(2),
      )
      .alpha(1)
      .alphaMin(0.004)
      .alphaDecay(0.055)
      .velocityDecay(0.34)
      .stop();

    let frame = 0;
    const step = () => {
      sim.tick();
      for (const n of next) {
        const lo = n.yMin + n.r;
        const hi = n.yMax - n.r;
        if (n.y < lo) {
          n.y = lo;
          n.vy = 0;
        } else if (n.y > hi) {
          n.y = hi;
          n.vy = 0;
        }
      }
      setNodes(next.map((n) => ({ ...n })));
      if (sim.alpha() > sim.alphaMin()) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      sim.stop();
    };
  }, [input, width]);

  return nodes;
}
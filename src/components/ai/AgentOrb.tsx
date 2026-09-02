/**
 * AgentOrb — the animated "thinking orb" used everywhere the agent is working.
 *
 * Wraps `thinking-orbs` (nine hand-tuned dotted canvas states) and adds the
 * NativeForge mapping from *what the agent is doing* to the orb state, so the
 * timeline visual always matches the current action.
 *
 * Sizes are presets from the library — 20 (inline / timeline rows) and
 * 64 (avatar scale). They are separate designs, not a scale factor.
 */

import { ThinkingOrb } from "thinking-orbs";

export type AgentOrbState =
  | "working"
  | "searching"
  | "solving"
  | "listening"
  | "connecting"
  | "weaving"
  | "composing"
  | "breathing"
  | "shaping";

/** Coarse action kinds the timeline already classifies steps into. */
export type AgentActionKind =
  | "narration"
  | "thinking"
  | "read"
  | "search"
  | "edit"
  | "create"
  | "delete"
  | "command"
  | "install"
  | "verify"
  | "plan"
  | "listening"
  | "generic";

const KIND_STATE: Record<AgentActionKind, AgentOrbState> = {
  narration: "breathing",
  thinking: "breathing",
  read: "searching",
  search: "searching",
  edit: "composing",
  create: "shaping",
  delete: "shaping",
  command: "working",
  install: "connecting",
  verify: "solving",
  plan: "weaving",
  listening: "listening",
  generic: "working",
};

/**
 * Infer the orb state from free-text like a tool name, step title or the
 * live caption ("Installing @capacitor/core", "Re-running the build check").
 */
export const inferOrbState = (text?: string | null, fallback: AgentOrbState = "breathing"): AgentOrbState => {
  const t = (text || "").toLowerCase();
  if (!t) return fallback;
  if (/(listen|record|transcrib|dictat|voice)/.test(t)) return "listening";
  if (/(install|dependen|package|npm|bun |yarn|peer|resolve|specifier|registry|plugin)/.test(t)) return "connecting";
  if (/(verify|verif|test|typecheck|type-check|lint|build check|re-?run|validat|check)/.test(t)) return "solving";
  if (/(fix|repair|conflict|error|debug|diagnos|classif)/.test(t)) return "solving";
  if (/(search|grep|regex|find|look|scan|index|ground)/.test(t)) return "searching";
  if (/(read|open|inspect|outline|review|map|list)/.test(t)) return "searching";
  if (/(creat|generat|scaffold|new file|add file|folder|mkdir|move|rename|delete|remove)/.test(t)) return "shaping";
  if (/(edit|patch|writ|apply|replac|refactor|updat|normaliz)/.test(t)) return "composing";
  if (/(run|command|shell|gradle|compil|bundl|vite|install step|exec)/.test(t)) return "working";
  if (/(plan|strateg|outline the|propos|decid|reason|analy)/.test(t)) return "weaving";
  if (/(think|prepar|start|warm)/.test(t)) return "breathing";
  return fallback;
};

export const orbStateForKind = (kind: AgentActionKind): AgentOrbState => KIND_STATE[kind] ?? "working";

interface AgentOrbProps {
  /** Explicit orb state — wins over `kind` / `hint`. */
  state?: AgentOrbState;
  /** Coarse classified action kind. */
  kind?: AgentActionKind;
  /** Free text (tool name, title, caption) used to infer the state. */
  hint?: string | null;
  size?: 20 | 64;
  speed?: number;
  paused?: boolean;
  className?: string;
  label?: string;
}

const AgentOrb = ({
  state,
  kind,
  hint,
  size = 20,
  speed,
  paused,
  className,
  label,
}: AgentOrbProps) => {
  const resolved: AgentOrbState =
    state ?? (hint ? inferOrbState(hint, kind ? orbStateForKind(kind) : "breathing") : kind ? orbStateForKind(kind) : "breathing");

  return (
    <ThinkingOrb
      state={resolved}
      size={size}
      speed={speed}
      paused={paused}
      theme="auto"
      className={className}
      aria-label={label || `Agent ${resolved}`}
    />
  );
};

export default AgentOrb;

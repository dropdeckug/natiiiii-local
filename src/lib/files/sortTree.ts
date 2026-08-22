/**
 * Vite/VS Code-style file tree ordering:
 *   1. folders before files
 *   2. within each group: pinned config files first (package.json, vite.config.ts, etc.)
 *   3. then natural, case-insensitive sort (numeric-aware)
 */
import type { ProjectFile } from "@/stores/projectStore";

const PIN_PREFIX = [
  "package.json",
  "package-lock.json",
  "bun.lockb",
  "yarn.lock",
  "pnpm-lock.yaml",
  "vite.config.ts",
  "vite.config.js",
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.node.json",
  "tailwind.config.ts",
  "tailwind.config.js",
  "postcss.config.js",
  "index.html",
  ".env",
  ".env.local",
  ".env.example",
  ".gitignore",
  "README.md",
  "readme.md",
];

const pinIndex = (name: string): number => {
  const i = PIN_PREFIX.indexOf(name);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
};

const naturalCmp = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare;

const compareNodes = (a: ProjectFile, b: ProjectFile): number => {
  // 1. folders first
  if (a.type !== b.type) return a.type === "folder" ? -1 : 1;

  // 2. pinned configs first (only meaningful for files, but cheap for folders too)
  const pa = pinIndex(a.name);
  const pb = pinIndex(b.name);
  if (pa !== pb) return pa - pb;

  // 3. natural sort
  return naturalCmp(a.name, b.name);
};

/** Recursively sort a project file tree in place-safe (returns a new ordered array). */
export function sortProjectTree(nodes: ProjectFile[]): ProjectFile[] {
  const sorted = [...nodes].sort(compareNodes);
  return sorted.map((n) =>
    n.children ? { ...n, children: sortProjectTree(n.children) } : n
  );
}

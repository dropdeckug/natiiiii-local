import type { BuildToolId, CprCompatibility, CprVersion, FrameworkId } from "../types/index.ts";
export { PLATFORM_RELEASE } from "../../supabase/functions/_shared/platformRelease.ts";
import { PLATFORM_RELEASE } from "../../supabase/functions/_shared/platformRelease.ts";

/**
 * CPR version matrix.
 *
 * A project is processed by the LOWEST version that declares support for its
 * (framework, buildTool) pair. Versions above CURRENT_CPR_VERSION are shown to
 * the user as "coming soon" with a date; anything not listed at all is
 * "not supported" with an explanation.
 */
export const CURRENT_CPR_VERSION: CprVersion = 1;

export const PLATFORM_NODE_VERSION = PLATFORM_RELEASE.nodeVersion;
export const PLATFORM_CAPACITOR_MAJOR = PLATFORM_RELEASE.capacitorMajor;

interface VersionSpec {
  version: CprVersion;
  title: string;
  availability: string | null; // ISO month, null when already shipped
  /** `${framework}:${buildTool}` pairs; `*` wildcards allowed on either side. */
  supports: string[];
  description: string;
}

export const CPR_VERSIONS: VersionSpec[] = [
  {
    version: 1,
    title: "Static & Vite projects",
    availability: null,
    supports: [
      "react:vite",
      "vue:vite",
      "svelte:vite",
      "solid:vite",
      "preact:vite",
      "unknown:vite",
      "plain-html:static-html",
      "react:cra",
    ],
    description: "React/Vue/Svelte/Solid/vanilla on Vite, plain HTML, and Create React App.",
  },
  {
    version: 2,
    title: "Extended framework support",
    availability: "2026-10",
    supports: [
      "angular:angular-cli",
      "sveltekit:sveltekit",
      "nuxt:nuxt",
      "astro:astro",
      "*:webpack",
      "*:rollup",
      "*:parcel",
    ],
    description:
      "Angular, SvelteKit static mode, Nuxt static mode, Astro static mode and workspace monorepos.",
  },
  {
    version: 3,
    title: "AI-generated project cleanup",
    availability: "2026-12",
    supports: [],
    description: "Lovable, Bolt, v0 and Cursor fingerprint cleanup for mixed AI-tool projects.",
  },
  {
    version: 4,
    title: "Full source transformation",
    availability: "2027-03",
    supports: ["next:next", "remix:*", "*:unknown", "unknown:unknown"],
    description:
      "HTML to React conversion, vanilla JS to hooks, and paradigm transformation of any input into the canonical React + Vite output.",
  },
];

function matches(pattern: string, framework: FrameworkId, buildTool: BuildToolId): boolean {
  const [f, b] = pattern.split(":");
  return (f === "*" || f === framework) && (b === "*" || b === buildTool);
}

export interface VersionVerdict {
  cprVersion: CprVersion;
  compatibility: CprCompatibility;
  message: string;
  estimatedAvailability: string | null;
}

export function resolveCprVersion(framework: FrameworkId, buildTool: BuildToolId): VersionVerdict {
  for (const spec of CPR_VERSIONS) {
    if (!spec.supports.some((p) => matches(p, framework, buildTool))) continue;

    if (spec.version <= CURRENT_CPR_VERSION) {
      return {
        cprVersion: spec.version,
        compatibility: "supported",
        message: `Processed by CPR v${spec.version} — ${spec.title}.`,
        estimatedAvailability: null,
      };
    }
    if (spec.version === 4) {
      return {
        cprVersion: spec.version,
        compatibility: "unsupported",
        message: `${spec.title} is required for this project type. ${spec.description}`,
        estimatedAvailability: spec.availability,
      };
    }
    return {
      cprVersion: spec.version,
      compatibility: "coming-soon",
      message: `${spec.title} lands in CPR v${spec.version}. ${spec.description}`,
      estimatedAvailability: spec.availability,
    };
  }

  return {
    cprVersion: 4,
    compatibility: "unsupported",
    message:
      "This project shape is not on the CPR roadmap yet. Export a static build (Vite, CRA or plain HTML) and upload that instead.",
    estimatedAvailability: null,
  };
}

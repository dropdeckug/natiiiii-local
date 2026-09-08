import { describe, expect, it } from "vitest";
import {
  isAliasSpecifier,
  isBuiltinOrProtocolSpecifier,
  packageFromSpecifier,
  packageNameOf,
  bareSpecifier,
} from "../../supabase/functions/_shared/specifierPolicy";
import { packageFromSpecifier as cprPackageFromSpecifier } from "../../cpr/specifier-policy";
import { packageNameOf as phase2PackageNameOf } from "../../cpr/phase-2-validate";
import { packageFromSpecifier as buildRetryPackageFromSpecifier } from "../../cpr/phase-4-verify/build-retry";
import { classifyError } from "../lib/resilience/errorClassifier";

describe("Specifier Policy Parity & Contract", () => {
  const TEST_TABLE: {
    input: string | null | undefined;
    isAlias: boolean;
    expectedPkg: string | null;
  }[] = [
    // Aliases
    { input: "@/components/Button", isAlias: true, expectedPkg: null },
    { input: "@/App", isAlias: true, expectedPkg: null },
    { input: "@/lib/utils", isAlias: true, expectedPkg: null },
    { input: "~/components/Card", isAlias: true, expectedPkg: null },
    { input: "~/utils/helpers", isAlias: true, expectedPkg: null },
    { input: "#components/Navbar", isAlias: true, expectedPkg: null },
    { input: "#app/routes", isAlias: true, expectedPkg: null },
    { input: "$/lib/config", isAlias: true, expectedPkg: null },
    { input: "~root/styles", isAlias: true, expectedPkg: null },

    // Relative & Absolute paths
    { input: "./components/Button", isAlias: false, expectedPkg: null },
    { input: "../utils/math", isAlias: false, expectedPkg: null },
    { input: "./App.tsx", isAlias: false, expectedPkg: null },
    { input: "/src/main.tsx", isAlias: false, expectedPkg: null },
    { input: "/index.html", isAlias: false, expectedPkg: null },

    // Protocols & Built-ins
    { input: "node:fs", isAlias: false, expectedPkg: null },
    { input: "node:path", isAlias: false, expectedPkg: null },
    { input: "fs", isAlias: false, expectedPkg: null },
    { input: "path", isAlias: false, expectedPkg: null },
    { input: "crypto", isAlias: false, expectedPkg: null },
    { input: "http", isAlias: false, expectedPkg: null },
    { input: "https", isAlias: false, expectedPkg: null },
    { input: "child_process", isAlias: false, expectedPkg: null },
    { input: "virtual:pwa-register", isAlias: false, expectedPkg: null },
    { input: "data:text/javascript;console.log(1)", isAlias: false, expectedPkg: null },
    { input: "https://esm.sh/react", isAlias: false, expectedPkg: null },
    { input: "http://localhost:3000/api", isAlias: false, expectedPkg: null },

    // Valid npm packages (unscoped)
    { input: "react", isAlias: false, expectedPkg: "react" },
    { input: "react/jsx-runtime", isAlias: false, expectedPkg: "react" },
    { input: "react-dom/client", isAlias: false, expectedPkg: "react-dom" },
    { input: "lodash/get", isAlias: false, expectedPkg: "lodash" },
    { input: "date-fns/format", isAlias: false, expectedPkg: "date-fns" },
    { input: "lucide-react", isAlias: false, expectedPkg: "lucide-react" },
    { input: "clsx", isAlias: false, expectedPkg: "clsx" },

    // Valid npm packages (scoped)
    { input: "@tanstack/react-query", isAlias: false, expectedPkg: "@tanstack/react-query" },
    { input: "@tanstack/react-query/devtools", isAlias: false, expectedPkg: "@tanstack/react-query" },
    { input: "@capacitor/core", isAlias: false, expectedPkg: "@capacitor/core" },
    { input: "@capacitor/android", isAlias: false, expectedPkg: "@capacitor/android" },
    { input: "@radix-ui/react-dialog", isAlias: false, expectedPkg: "@radix-ui/react-dialog" },
    { input: "@vitejs/plugin-react", isAlias: false, expectedPkg: "@vitejs/plugin-react" },

    // Protocol npm: prefixes (with optional versions)
    { input: "npm:lodash@^4.17.21", isAlias: false, expectedPkg: "lodash" },
    { input: "npm:@scope/package@1.0.0", isAlias: false, expectedPkg: "@scope/package" },

    // Malformed / Non-package strings
    { input: "", isAlias: false, expectedPkg: null },
    { input: "   ", isAlias: false, expectedPkg: null },
    { input: null, isAlias: false, expectedPkg: null },
    { input: undefined, isAlias: false, expectedPkg: null },
    { input: "@", isAlias: false, expectedPkg: null },
    { input: "@/", isAlias: true, expectedPkg: null },
    { input: "@scope", isAlias: false, expectedPkg: null },
    { input: "@scope/", isAlias: false, expectedPkg: null },
    { input: "Has UpperCase", isAlias: false, expectedPkg: null },
    { input: "has space/sub", isAlias: false, expectedPkg: null },
    { input: ".hidden/foo", isAlias: false, expectedPkg: null },
    { input: "_underscore/foo", isAlias: false, expectedPkg: null },
  ];

  it("consistently classifies aliases across all test cases", () => {
    for (const { input, isAlias } of TEST_TABLE) {
      expect(isAliasSpecifier(input)).toBe(isAlias);
    }
  });

  it("extracts expected package name identically across all exported functions", () => {
    for (const { input, expectedPkg } of TEST_TABLE) {
      const canonical = packageFromSpecifier(input);
      expect(canonical).toBe(expectedPkg);

      // Parity across all call-site entry points
      expect(packageNameOf(input as string)).toBe(expectedPkg);
      expect(cprPackageFromSpecifier(input as string)).toBe(expectedPkg);
      expect(phase2PackageNameOf(input as string)).toBe(expectedPkg);
      expect(buildRetryPackageFromSpecifier(input as string)).toBe(expectedPkg);

      // bareSpecifier returns undefined instead of null
      const expectedBare = expectedPkg ?? undefined;
      expect(bareSpecifier(input)).toBe(expectedBare);
    }
  });

  it("prevents errorClassifier from mistaking alias imports for missing npm packages", () => {
    const errorOutput = `
Rollup failed to resolve import "@/components/Button" from "src/App.tsx".
This is most likely not an error in Vite itself, but rather an issue with the project's config.
`;
    const classification = classifyError(errorOutput, "Vite production build");
    // Must NOT be classified as dependency_missing with package "@/components/Button"
    expect(classification.packageName).toBeUndefined();
    expect(classification.packageName).not.toBe("@/components/Button");
    expect(classification.packageName).not.toBe("@/components");
  });

  it("properly classifies genuine missing packages", () => {
    const errorOutput = `
Failed to resolve import "canvas-confetti" from "src/components/Celebration.tsx". Does the file exist?
`;
    const classification = classifyError(errorOutput, "Vite production build");
    expect(classification.errorType).toBe("dependency_missing");
    expect(classification.packageName).toBe("canvas-confetti");
  });

  it("properly classifies genuine missing scoped packages", () => {
    const errorOutput = `
Cannot find module '@tanstack/react-query' or its corresponding type declarations.
`;
    const classification = classifyError(errorOutput, "TypeScript typecheck");
    expect(classification.errorType).toBe("dependency_missing");
    expect(classification.packageName).toBe("@tanstack/react-query");
  });

  it("identifies builtin or protocol specifiers", () => {
    expect(isBuiltinOrProtocolSpecifier("node:fs")).toBe(true);
    expect(isBuiltinOrProtocolSpecifier("fs")).toBe(true);
    expect(isBuiltinOrProtocolSpecifier("path")).toBe(true);
    expect(isBuiltinOrProtocolSpecifier("virtual:pwa-register")).toBe(true);
    expect(isBuiltinOrProtocolSpecifier("https://cdn.skypack.dev/pin/react")).toBe(true);
    expect(isBuiltinOrProtocolSpecifier("react")).toBe(false);
  });
});

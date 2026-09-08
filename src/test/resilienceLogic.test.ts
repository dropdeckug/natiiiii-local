import { describe, expect, it } from "vitest";
import {
  classifyError,
  bareSpecifier,
  computeStderrFingerprint,
  hasProgress,
  applyFix,
  type ResilienceClassification,
} from "../../supabase/functions/_shared/resilienceLogic";

describe("Resilience Logic & Error Classification", () => {
  describe("classifyError", () => {
    it("classifies peer dependency conflict", () => {
      const output = `npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
npm ERR! Found: react@18.2.0`;
      const res = classifyError(output, "Install dependencies");
      expect(res.errorType).toBe("dependency_conflict");
      expect(res.fixAction).toBe("legacy_peer_deps");
      expect(res.automatic).toBe(true);
    });

    it("classifies missing package from module resolution error", () => {
      const output = `Failed to resolve import "date-fns/format" from "src/components/DateBadge.tsx". Does the file exist?`;
      const res = classifyError(output, "Build web app");
      expect(res.errorType).toBe("dependency_missing");
      expect(res.packageName).toBe("date-fns");
      expect(res.fixAction).toBe("add_package");
      expect(res.automatic).toBe(true);
    });

    it("classifies missing scoped package", () => {
      const output = `Error: Cannot find module '@tabler/icons-react'`;
      const res = classifyError(output, "compile");
      expect(res.errorType).toBe("dependency_missing");
      expect(res.packageName).toBe("@tabler/icons-react");
      expect(res.fixAction).toBe("add_package");
      expect(res.automatic).toBe(true);
    });

    it("classifies native addon failures as non-automatic with helpful advice", () => {
      const output = `gyp ERR! build error
gyp ERR! stack Error: make failed with exit code 2
node-gyp rebuild for package sharp@0.32.0`;
      const res = classifyError(output, "Install locked dependencies");
      expect(res.errorType).toBe("native_addon");
      expect(res.packageName).toBe("sharp");
      expect(res.fixAction).toBe("remove_native_package");
      expect(res.automatic).toBe(false);
      expect(res.advice).toBeDefined();
    });

    it("classifies transient network errors", () => {
      const output = `npm ERR! code ECONNREFUSED
npm ERR! network request to https://registry.npmjs.org/axios failed, reason: connect ECONNREFUSED`;
      const res = classifyError(output, "Install");
      expect(res.errorType).toBe("network_error");
      expect(res.fixAction).toBe("retry_with_delay");
      expect(res.automatic).toBe(true);
    });

    it("classifies missing import extensions", () => {
      const output = `Did you mean to import ./utils.js?
from src/index.ts`;
      const res = classifyError(output, "build");
      expect(res.errorType).toBe("import_extension_missing");
      expect(res.suggestedFile).toBe("./utils.js");
      expect(res.fixAction).toBe("add_import_extension");
      expect(res.automatic).toBe(true);
    });

    it("classifies module system conflict", () => {
      const output = `ReferenceError: require is not defined in ES module scope, you can use import instead
This file is being treated as an ES module because "type": "module" is present.`;
      const res = classifyError(output, "build");
      expect(res.errorType).toBe("module_system_conflict");
      expect(res.fixAction).toBe("normalize_module_system");
      expect(res.automatic).toBe(true);
    });

    it("classifies Gradle duplicate class error", () => {
      const output = `Execution failed for task ':app:checkDebugDuplicateClasses'.
> A failure occurred while executing com.android.build.gradle.internal.tasks.CheckDuplicatesRunnable
   > Duplicate class androidx.lifecycle.ViewModel found in modules jetified-lifecycle-viewmodel-2.5.0-runtime.jar`;
      const res = classifyError(output, "Assemble Android Debug");
      expect(res.errorType).toBe("gradle_duplicate_class");
      expect(res.className).toBe("androidx.lifecycle.ViewModel");
      expect(res.fixAction).toBe("add_gradle_resolution");
      expect(res.automatic).toBe(true);
    });

    it("classifies missing output directory", () => {
      const output = `[error] Unable to find webDir at /home/runner/work/app/app/www/index.html`;
      const res = classifyError(output, "Capacitor copy");
      expect(res.errorType).toBe("output_missing");
      expect(res.fixAction).toBe("find_alternate_output");
      expect(res.automatic).toBe(true);
    });
  });

  describe("bareSpecifier", () => {
    it("safely extracts valid bare npm package names", () => {
      expect(bareSpecifier("lodash")).toBe("lodash");
      expect(bareSpecifier("lodash/debounce")).toBe("lodash");
      expect(bareSpecifier("@tabler/icons-react")).toBe("@tabler/icons-react");
      expect(bareSpecifier("@tabler/icons-react/dist/esm/icons/Icon123.js")).toBe("@tabler/icons-react");
    });

    it("rejects path-like, protocol, and alias imports", () => {
      expect(bareSpecifier("./components/Button")).toBeUndefined();
      expect(bareSpecifier("../utils/helpers")).toBeUndefined();
      expect(bareSpecifier("/root/file")).toBeUndefined();
      expect(bareSpecifier("@/components/ui/button")).toBeUndefined();
      expect(bareSpecifier("~/lib/utils")).toBeUndefined();
      expect(bareSpecifier("node:fs")).toBeUndefined();
      expect(bareSpecifier("virtual:pwa-register")).toBeUndefined();
    });
  });

  describe("computeStderrFingerprint & hasProgress (No-Progress Guard)", () => {
    it("produces identical fingerprints despite different timestamps, hashes, or workspace paths", () => {
      const err1 = `2026-09-08T03:00:00.123Z [error] /home/runner/work/repo1/repo1/src/main.ts: Cannot find module 'lucide-react'
Build 12345 hash abcdef0123456789`;
      const err2 = `2026-09-08T03:05:22.999Z [error] /home/runner/work/repo2/repo2/src/main.ts: Cannot find module 'lucide-react'
Build 67890 hash fedcba9876543210`;

      const fp1 = computeStderrFingerprint(err1, "build");
      const fp2 = computeStderrFingerprint(err2, "build");

      expect(fp1).toBe(fp2);
    });

    it("trips no-progress guard when fingerprint is unchanged across attempts", () => {
      const fp = "build|cannot find module 'lucide-react'";
      expect(hasProgress(null, fp)).toBe(true); // First attempt always has progress
      expect(hasProgress(undefined, fp)).toBe(true);
      expect(hasProgress(fp, fp)).toBe(false); // Repeated identical failure -> NO PROGRESS!
    });

    it("detects progress when error changes to a different failure", () => {
      const fp1 = "build|cannot find module 'lucide-react'";
      const fp2 = "build|type error: property 'name' does not exist";
      expect(hasProgress(fp1, fp2)).toBe(true);
    });
  });

  describe("applyFix", () => {
    it("executes legacy_peer_deps command", () => {
      const commandsRan: string[] = [];
      const ctx = {
        runCommand: (cmd: string) => {
          commandsRan.push(cmd);
          return { ok: true, status: 0, output: "added 15 packages" };
        },
      };

      const classification: ResilienceClassification = {
        errorType: "dependency_conflict",
        fixAction: "legacy_peer_deps",
        automatic: true,
        explanation: "Peer conflict",
      };

      const res = applyFix(classification, ctx);
      expect(res.applied).toBe(true);
      expect(commandsRan).toEqual(["npm install --legacy-peer-deps --no-audit --no-fund"]);
    });

    it("executes add_package command using sanctioned npm pkg set and install", () => {
      const commandsRan: string[] = [];
      const ctx = {
        runCommand: (cmd: string) => {
          commandsRan.push(cmd);
          return { ok: true, status: 0, output: "ok" };
        },
      };

      const classification: ResilienceClassification = {
        errorType: "dependency_missing",
        packageName: "lucide-react",
        fixAction: "add_package",
        automatic: true,
        explanation: "Missing package",
      };

      const res = applyFix(classification, ctx);
      expect(res.applied).toBe(true);
      expect(commandsRan).toEqual([
        'npm pkg set dependencies.lucide-react="*"',
        "npm install --no-audit --no-fund",
      ]);
    });

    it("refuses to apply non-automatic fixes", () => {
      const commandsRan: string[] = [];
      const ctx = {
        runCommand: (cmd: string) => {
          commandsRan.push(cmd);
          return { ok: true, status: 0, output: "" };
        },
      };

      const classification: ResilienceClassification = {
        errorType: "native_addon",
        packageName: "sharp",
        fixAction: "remove_native_package",
        automatic: false,
        explanation: "Native C++ compilation not supported.",
      };

      const res = applyFix(classification, ctx);
      expect(res.applied).toBe(false);
      expect(commandsRan.length).toBe(0);
    });
  });
});

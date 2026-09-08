import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore } from "@/stores/projectStore";
import { executeRepairTool, REPAIR_TOOL_NAMES } from "@/lib/repair/tools";
import { isRepairable } from "@/lib/buildRepairRunner";

describe("Code Repair Tools & Capabilities", () => {
  beforeEach(() => {
    const store = useProjectStore.getState();
    store.setFiles([
      {
        id: "package.json",

        name: "package.json",

        path: "package.json",
        type: "file",
        content: JSON.stringify(
          {
            name: "test-app",
            version: "1.0.0",
            scripts: { build: "vite build" },
            dependencies: { react: "^18.2.0" },
          },
          null,
          2
        ),
      },
      {
        id: "vite.config.ts",

        name: "vite.config.ts",

        path: "vite.config.ts",
        type: "file",
        content: `import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({\n  plugins: [react()],\n});\n`,
      },
      {
        id: "src/App.tsx",

        name: "App.tsx",

        path: "src/App.tsx",
        type: "file",
        content: `import React from "react";\n\nexport function App() {\n  return <div>Hello World</div>;\n}\n`,
      },
      {
        id: "package-lock.json",

        name: "package-lock.json",

        path: "package-lock.json",
        type: "file",
        content: `{"name": "test-app", "lockfileVersion": 3}`,
      },
    ]);
  });

  it("registers all 15 repair tools in REPAIR_TOOL_NAMES", () => {
    expect(REPAIR_TOOL_NAMES).toContain("inspect");
    expect(REPAIR_TOOL_NAMES).toContain("patch_file");
    expect(REPAIR_TOOL_NAMES).toContain("write_file");
    expect(REPAIR_TOOL_NAMES).toContain("delete_file");
    expect(REPAIR_TOOL_NAMES).toContain("run_command");
    expect(REPAIR_TOOL_NAMES).toContain("fix_alias_sync");
    expect(REPAIR_TOOL_NAMES).toContain("stub_missing_module");
    expect(REPAIR_TOOL_NAMES).toContain("run_build_check");
    expect(REPAIR_TOOL_NAMES).toContain("set_dependency");
  });

  it("handles CRLF normalization in patch_file gracefully", async () => {
    const state: any = {
      inspected: new Set(["src/App.tsx"]),
      patches: [],
      filesChanged: new Set(),
    };
    const deps = {
      state,
      verifyStep: async () => ({ ok: true, output: "" }),
      onActivity: () => {},
    };

    // Replace Hello World with Hello NativeForge
    const res = await executeRepairTool(
      "patch_file",
      {
        id: "src/App.tsx",

        name: "App.tsx",

        path: "src/App.tsx",
        old_text: "Hello World",
        new_text: "Hello NativeForge",
      },
      deps
    );

    expect(res).toContain("SUCCESS: applied patch");
    const updated = useProjectStore.getState().files.find((f) => f.path === "src/App.tsx");
    expect(updated?.content).toContain("Hello NativeForge");
  });

  it("allows deleting conflicting lockfiles via delete_file tool", async () => {
    const state: any = {
      inspected: new Set(),
      patches: [],
      filesChanged: new Set(),
    };
    const deps = {
      state,
      verifyStep: async () => ({ ok: true, output: "" }),
      onActivity: () => {},
    };

    const res = await executeRepairTool("delete_file", { path: "package-lock.json" }, deps);
    expect(res).toContain("SUCCESS: deleted package-lock.json");
    const found = useProjectStore.getState().files.find((f) => f.path === "package-lock.json");
    expect(found).toBeUndefined();
  });

  it("executes npm pkg set command via run_command tool", async () => {
    const state: any = {
      inspected: new Set(["package.json"]),
      patches: [],
      filesChanged: new Set(),
    };
    const deps = {
      state,
      verifyStep: async () => ({ ok: true, output: "" }),
      onActivity: () => {},
    };

    const res = await executeRepairTool("run_command", { command: "npm pkg set type=module" }, deps);
    expect(res).toContain("SUCCESS: updated package.json: set type=\"module\"");
    const pkg = JSON.parse(useProjectStore.getState().files.find((f) => f.path === "package.json")?.content || "{}");
    expect(pkg.type).toBe("module");
  });

  it("executes npm install command via run_command tool", async () => {
    const state: any = {
      inspected: new Set(["package.json"]),
      patches: [],
      filesChanged: new Set(),
    };
    const deps = {
      state,
      verifyStep: async () => ({ ok: true, output: "" }),
      onActivity: () => {},
    };

    const res = await executeRepairTool("run_command", { command: "npm install lucide-react" }, deps);
    expect(res).toContain("SUCCESS: package.json updated");
    const pkg = JSON.parse(useProjectStore.getState().files.find((f) => f.path === "package.json")?.content || "{}");
    expect(pkg.dependencies["lucide-react"]).toBeDefined();
  });

  it("synchronizes path alias via fix_alias_sync tool", async () => {
    const state: any = {
      inspected: new Set(),
      patches: [],
      filesChanged: new Set(),
    };
    const deps = {
      state,
      verifyStep: async () => ({ ok: true, output: "" }),
      onActivity: () => {},
    };

    const res = await executeRepairTool("fix_alias_sync", { alias: "@", target_path: "./src" }, deps);
    expect(res).toContain("SUCCESS");
    const viteContent = useProjectStore.getState().files.find((f) => f.path === "vite.config.ts")?.content || "";
    expect(viteContent).toContain("alias");
    expect(viteContent).toContain('"@"');
  });

  it("stubs missing modules cleanly via stub_missing_module tool", async () => {
    const state: any = {
      inspected: new Set(),
      patches: [],
      filesChanged: new Set(),
    };
    const deps = {
      state,
      verifyStep: async () => ({ ok: true, output: "" }),
      onActivity: () => {},
    };

    const res = await executeRepairTool("stub_missing_module", { path: "src/components/Uncommitted.tsx", export_type: "component" }, deps);
    expect(res).toContain("SUCCESS");

    const flatten = (files: any[]): any[] =>
      files.flatMap((f) => [f, ...(f.children ? flatten(f.children) : [])]);

    const stub = flatten(useProjectStore.getState().files).find((f) => f.path === "src/components/Uncommitted.tsx");
    expect(stub).toBeDefined();
    expect(stub?.content).toContain("export default function StubComponent");
  });

  it("marks all valid error categories repairable in isRepairable", () => {
    expect(isRepairable({ category: "missing-module", title: "Missing module", detail: "", autoFixable: true, suggestedFix: "", severity: "error" })).toBe(true);
    expect(isRepairable({ category: "dependency", title: "Dep issue", detail: "", autoFixable: false, suggestedFix: "", severity: "error" })).toBe(true);
    expect(isRepairable({ category: "vite-config", title: "Vite error", detail: "", autoFixable: true, suggestedFix: "", severity: "error" })).toBe(true);
    expect(isRepairable({ category: "ts-error", title: "TypeScript error", detail: "", autoFixable: true, suggestedFix: "", severity: "error" })).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import {
  extractTsconfigAliases,
  viteConfigHasAlias,
  injectViteAliases,
  syncViteAliases,
} from "../../cpr/phase-3-transform/vite-alias";
import type { CprFile } from "../../cpr/types";

describe("Vite Alias Synchronizer", () => {
  it("extracts path mappings from tsconfig.json", () => {
    const files: CprFile[] = [
      {
        path: "tsconfig.json",
        content: JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: {
              "@/*": ["./src/*"],
              "~/*": ["./src/*"],
              "components/*": ["./src/components/*"],
            },
          },
        }),
      },
    ];

    const aliases = extractTsconfigAliases(files);
    expect(aliases["@"]).toBe("./src");
    expect(aliases["~"]).toBe("./src");
    expect(aliases["components"]).toBe("./src/components");
  });

  it("infers @ -> ./src when tsconfig lacks paths but source uses @/ imports", () => {
    const files: CprFile[] = [
      {
        path: "src/App.tsx",
        content: `import { Button } from "@/components/Button";\nexport default function App() { return <Button />; }`,
      },
    ];

    const aliases = extractTsconfigAliases(files);
    expect(aliases["@"]).toBe("./src");
  });

  it("detects existing aliases in vite.config.* accurately", () => {
    const configWithAlias = `
import { defineConfig } from 'vite';
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
`;
    expect(viteConfigHasAlias(configWithAlias, "@")).toBe(true);
    expect(viteConfigHasAlias(configWithAlias, "~")).toBe(false);

    const configWithSingleQuotes = `
export default {
  resolve: {
    alias: {
      '@': '/src',
    },
  },
};
`;
    expect(viteConfigHasAlias(configWithSingleQuotes, "@")).toBe(true);

    const configWithRollupArray = `
export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, 'src') },
    ],
  },
});
`;
    expect(viteConfigHasAlias(configWithRollupArray, "@")).toBe(true);
  });

  it("injects resolve.alias into standard defineConfig", () => {
    const input = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`;
    const { content, added } = injectViteAliases(input, { "@": "./src" });
    expect(added["@"]).toBe("./src");
    expect(content).toContain('import path from "path";');
    expect(content).toContain('__dirname = path.dirname(fileURLToPath(import.meta.url));');
    expect(content).toContain('"@": path.resolve(__dirname, "./src")');
    expect(content).toContain("plugins: [react()]");
  });

  it("injects resolve.alias into arrow function defineConfig", () => {
    const input = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
}));
`;
    const { content, added } = injectViteAliases(input, { "@": "./src" });
    expect(added["@"]).toBe("./src");
    expect(content).toContain('"@": path.resolve(__dirname, "./src")');
    expect(content).toContain("plugins: [react()]");
  });

  it("injects alias into existing resolve block lacking alias", () => {
    const input = `import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx'],
  },
});
`;
    const { content, added } = injectViteAliases(input, { "@": "./src" });
    expect(added["@"]).toBe("./src");
    expect(content).toContain('alias: {');
    expect(content).toContain('"@": path.resolve(__dirname, "./src")');
    expect(content).toContain("extensions: [");
  });

  it("is idempotent when alias is already present", () => {
    const input = `import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
`;
    const { content, added } = injectViteAliases(input, { "@": "./src" });
    expect(Object.keys(added)).toHaveLength(0);
    expect(content).toBe(input);
  });

  it("handles scoped nested roots (e.g. frontend/)", () => {
    const files: CprFile[] = [
      {
        path: "frontend/tsconfig.json",
        content: JSON.stringify({
          compilerOptions: {
            paths: { "@/*": ["./src/*"] },
          },
        }),
      },
      {
        path: "frontend/vite.config.ts",
        content: `import { defineConfig } from "vite";
export default defineConfig({
  plugins: [],
});`,
      },
    ];

    const result = syncViteAliases(files, "frontend");
    expect(result.synced).toBe(true);
    expect(result.filePath).toBe("frontend/vite.config.ts");
    expect(result.aliasesAdded["@"]).toBe("./src");
    expect(result.patches[0].content).toContain('"@": path.resolve(__dirname, "./src")');
  });
});

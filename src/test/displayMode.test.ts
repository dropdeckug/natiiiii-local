import { describe, it, expect } from "vitest";
import { wireDisplayMode } from "@/lib/plugins/displayMode";
import { DEFAULT_DISPLAY_MODE_CONFIG } from "@/lib/plugins/displayMode/registry";

const files: any = [
  { path: "package.json", type: "file", content: JSON.stringify({ dependencies: { react: "18" } }) },
  { path: "index.html", type: "file", content: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head><body></body></html>` },
  { path: "capacitor.config.json", type: "file", content: "{}" },
  { path: "src/main.tsx", type: "file", content: `import React from "react";\nimport App from "./App";\n\ncreateRoot(document.getElementById("root")!).render(<App />);` },
  { path: "src/hooks/use-mobile.tsx", type: "file", content: "export const x = 1;" },
  { path: "src/pages/Profile.tsx", type: "file", content: `export default function Profile() {\n  return (<div className="cover-photo h-screen" />);\n}` },
];

describe("display mode wiring", () => {
  it("wires all four resource folders and the hook", () => {
    const w = wireDisplayMode(files, { ...DEFAULT_DISPLAY_MODE_CONFIG, mode: "GLASSMORPHISM" });
    const paths = w.patches.map((p) => p.path);
    for (const f of ["values", "values-night", "values-v31", "values-night-v31"]) {
      expect(paths).toContain(`android/app/src/main/res/${f}/styles.xml`);
    }
    expect(paths).toContain("src/capacitor/display-mode.ts");
    expect(paths).toContain("src/capacitor/display-mode-glass.ts");
    expect(w.metadata.display_mode_hook_path).toBe("src/hooks/useDisplayMode.ts");
    const html = w.patches.find((p) => p.path === "index.html")!.content;
    expect(html).toContain("viewport-fit=cover");
    const entry = w.patches.find((p) => p.path === "src/main.tsx")!.content;
    expect(entry).toContain("./capacitor/display-mode");
  });

  it("injects per-page hooks in mode 5", () => {
    const w = wireDisplayMode(files, { ...DEFAULT_DISPLAY_MODE_CONFIG, mode: "PER_PAGE", baseMode: "THEMED" });
    expect(w.metadata.display_mode_full_screen_pages).toContain("src/pages/Profile.tsx");
    const page = w.patches.find((p) => p.path === "src/pages/Profile.tsx")!.content;
    expect(page).toContain("enterFullScreen");
    expect(page).toContain("useEffect");
  });
});

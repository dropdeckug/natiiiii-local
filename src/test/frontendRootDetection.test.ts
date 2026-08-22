import { describe, expect, it } from "vitest";
import { detectMonorepo, isIgnorablePackagePath } from "../../cpr/phase-1-detect/index.ts";
import type { CprFile } from "../../cpr/types/index.ts";

const file = (path: string, content = ""): CprFile => ({ path, content } as CprFile);

describe("frontend root detection", () => {
  it("ignores package.json files in build output and native shells", () => {
    expect(isIgnorablePackagePath("dist/package.json")).toBe(true);
    expect(isIgnorablePackagePath("android/app/package.json")).toBe(true);
    expect(isIgnorablePackagePath("examples/demo/package.json")).toBe(true);
    expect(isIgnorablePackagePath("client/package.json")).toBe(false);
    expect(isIgnorablePackagePath("package.json")).toBe(false);
  });

  it("picks the frontend package over a backend at the repo root", () => {
    const files = [
      file("package.json", JSON.stringify({ dependencies: { express: "^4.18.0" }, scripts: { start: "node server.js" } })),
      file("server.js"),
      file("client/package.json", JSON.stringify({ dependencies: { react: "^18.3.1" }, scripts: { build: "vite build" } })),
      file("client/index.html", "<!doctype html>"),
      file("client/vite.config.ts"),
      file("client/src/main.tsx"),
    ];
    const info = detectMonorepo(files);
    expect(info.appRoot).toBe("client");
  });

  it("does not select a stale build output copy of the app", () => {
    const files = [
      file("package.json", JSON.stringify({ dependencies: { react: "^18.3.1" }, scripts: { build: "vite build" } })),
      file("index.html", "<!doctype html>"),
      file("vite.config.ts"),
      file("dist/package.json", JSON.stringify({ dependencies: { react: "^18.3.1" } })),
      file("dist/index.html", "<!doctype html>"),
    ];
    const info = detectMonorepo(files);
    expect(info.appRoot).toBe("");
    expect(info.packages.some((p) => p.path === "dist")).toBe(false);
  });

  it("prefers the package that already carries a capacitor config", () => {
    const files = [
      file("apps/site/package.json", JSON.stringify({ dependencies: { react: "^18.3.1" }, scripts: { build: "vite build" } })),
      file("apps/site/index.html", "<!doctype html>"),
      file("apps/mobile/package.json", JSON.stringify({ dependencies: { react: "^18.3.1", "@capacitor/core": "^6.0.0" }, scripts: { build: "vite build" } })),
      file("apps/mobile/index.html", "<!doctype html>"),
      file("apps/mobile/capacitor.config.ts"),
    ];
    const info = detectMonorepo(files);
    expect(info.appRoot).toBe("apps/mobile");
  });

  it("falls back to the shallowest index.html when no package.json exists", () => {
    const files = [file("www/index.html", "<!doctype html>"), file("www/app.js")];
    const info = detectMonorepo(files);
    expect(info.appRoot).toBe("www");
  });
});

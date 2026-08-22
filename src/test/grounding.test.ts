import { describe, it, expect } from "vitest";
import {
  discoverProjectEntries,
  planProjectGrounding,
  STATIC_HTML_MARKER,
  type ProjectIndex,
} from "@/lib/tools/projectIndexer";

type F = { path: string; type: "file"; content?: string; size?: number; isBinary?: boolean };

const file = (path: string, content = ""): F => ({ path, type: "file", content, size: content.length });

const HTML = `<!doctype html><html><head><title>Site</title></head><body><h1>Hi</h1></body></html>`;

const byPath = (patches: { path: string; content: string }[], suffix: string) =>
  patches.find((p) => p.path === suffix || p.path.endsWith("/" + suffix));

describe("plain HTML upload grounding", () => {
  const files: F[] = [file("index.html", HTML), file("styles.css", "body{background:url('/bg.png')}"), file("app.js", "console.log(1)")];
  const { index, patches } = planProjectGrounding(files, "My Site", { appId: "com.demo.site" });

  it("detects a static HTML project", () => {
    expect(index.shape).toBe("plain-html");
    expect(index.isStaticHtml).toBe(true);
    expect(index.entryHtml).toBe("index.html");
  });

  it("generates a package.json with a build script", () => {
    const pkgPatch = byPath(patches, "package.json");
    expect(pkgPatch).toBeTruthy();
    const pkg = JSON.parse(pkgPatch!.content);
    expect(typeof pkg.scripts.build).toBe("string");
    expect(pkg.scripts.build.length).toBeGreaterThan(0);
    expect(pkg.dependencies["@capacitor/core"]).toBeTruthy();
    expect(pkg.dependencies["@capacitor/android"]).toBeTruthy();
  });

  it("generates a capacitor config with webDir=www", () => {
    const capPatch = byPath(patches, "capacitor.config.json");
    expect(capPatch).toBeTruthy();
    const cfg = JSON.parse(capPatch!.content);
    expect(cfg.webDir).toBe("www");
    expect(cfg.appId).toBe("com.demo.site");
    expect(cfg.appName).toBe("My Site");
  });

  it("writes the static-html runner marker", () => {
    const marker = byPath(patches, STATIC_HTML_MARKER);
    expect(marker).toBeTruthy();
    expect(JSON.parse(marker!.content).type).toBe("static-html");
  });

  it("materializes a validated www output during normalization", () => {
    const entry = byPath(patches, "www/index.html");
    const script = byPath(patches, "www/app.js");
    expect(entry?.content).toContain("Hi");
    expect(script?.content).toContain("console.log(1)");
    expect(index.outputDir).toBe("www");
  });

  it("never invents an index.html when one already exists", () => {
    const sourceEntries = patches.filter((p) => p.path === "index.html");
    expect(sourceEntries.length).toBeLessThanOrEqual(1);
    expect(byPath(patches, "www/index.html")?.content).toContain("Hi");
  });

  it("relativizes absolute CSS urls", () => {
    const css = byPath(patches, "styles.css");
    expect(css!.content).toContain("url('bg.png')");
  });
});

describe("GitHub clone with nested root folder", () => {
  const files: F[] = [
    file("my-repo-main/index.html", HTML),
    file("my-repo-main/assets/app.js", "console.log(1)"),
  ];
  const { index, patches } = planProjectGrounding(files, "Cloned App");

  it("still grounds missing files inside the detected project root", () => {
    expect(index.isStaticHtml).toBe(true);
    expect(byPath(patches, "package.json")).toBeTruthy();
    expect(byPath(patches, "capacitor.config.json")).toBeTruthy();
    expect(byPath(patches, STATIC_HTML_MARKER)).toBeTruthy();
  });
});

describe("frontend with nested backend package.json", () => {
  const files: F[] = [
    file("index.html", HTML),
    file("backend/package.json", JSON.stringify({ name: "api", scripts: { start: "node server.js" } })),
    file("backend/server.js", "require('http')"),
  ];
  const { index, patches } = planProjectGrounding(files, "Hybrid");

  it("does not let the backend package hijack the web project root", () => {
    expect(index.isStaticHtml).toBe(true);
    const pkgPatch = byPath(patches, "package.json");
    expect(pkgPatch).toBeTruthy();
    expect(JSON.parse(pkgPatch!.content).scripts.build).toBeTruthy();
  });
});

describe("plain HTML with Capacitor-only package metadata", () => {
  const files: F[] = [
    file("index.html", HTML),
    file("package.json", JSON.stringify({
      scripts: { build: "echo no-op" },
      dependencies: { "@capacitor/core": "^7.0.0" },
    })),
  ];

  it("uses the static www pipeline instead of rejecting an unknown web builder", () => {
    const { index, patches } = planProjectGrounding(files, "Static Capacitor");
    expect(index.shape).toBe("plain-html");
    expect(index.isStaticHtml).toBe(true);
    expect(index.staticCapable).toBe(true);
    expect(index.outputDir).toBe("www");
    expect(byPath(patches, "www/index.html")?.content).toContain("Hi");
    const groundedPackage = JSON.parse(byPath(patches, "package.json")?.content || "{}");
    expect(groundedPackage.scripts.build).not.toBe("echo no-op");
    expect(groundedPackage.nativeforge.type).toBe("static-html");
  });
});

describe("uploaded plain HTML archive shape", () => {
  const files: F[] = [
    file("afrisocial-frontend-dev-main/index.html", HTML),
    file("afrisocial-frontend-dev-main/feed.html", HTML),
    file("afrisocial-frontend-dev-main/feed.js", "console.log('feed')"),
    file("afrisocial-frontend-dev-main/package.json", JSON.stringify({
      name: "afrisocial-frontend",
      scripts: { build: "echo no-op" },
    })),
  ];

  it("normalizes the selected wrapped entry to the www static pipeline", () => {
    const { index, patches } = planProjectGrounding(files, "Afrisocial", {
      preferredRoot: "afrisocial-frontend-dev-main",
      preferredEntry: "afrisocial-frontend-dev-main/index.html",
    });
    expect(index.staticCapable).toBe(true);
    expect(index.buildTool).toBe("static-html");
    expect(index.outputDir).toBe("www");
    expect(byPath(patches, "www/index.html")?.content).toContain("Hi");
    expect(JSON.parse(byPath(patches, "package.json")?.content || "{}").scripts.build).not.toBe("echo no-op");
  });
});

describe("Spring Boot project sources", () => {
  const pom = `<project><parent><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-parent</artifactId></parent></project>`;

  it("packages Spring static resources through the generated www pipeline", () => {
    const files: F[] = [
      file("spring-app/pom.xml", pom),
      file("spring-app/src/main/resources/static/index.html", HTML),
      file("spring-app/src/main/resources/static/app.js", "console.log('spring web')"),
    ];
    const entries = discoverProjectEntries(files);
    expect(entries).toHaveLength(1);
    expect(entries[0].framework).toBe("Spring Boot static web");
    expect(entries[0].projectRoot).toBe("spring-app/src/main/resources/static");
    expect(entries[0].staticCapable).toBe(true);
    expect(entries[0].outputDir).toBe("www");

    const { index, patches } = planProjectGrounding(files, "Spring Web", {
      preferredRoot: entries[0].projectRoot,
      preferredEntry: entries[0].entryHtml,
    });
    expect(index.isStaticHtml).toBe(true);
    expect(byPath(patches, "www/index.html")?.content).toContain("Hi");
  });

  it("reports a precise blocker for a backend-only Spring project", () => {
    const { index } = planProjectGrounding([
      file("pom.xml", pom),
      file("src/main/java/com/example/Application.java", "class Application {}"),
    ], "Spring API");
    expect(index.buildTool).toBe("spring-boot");
    expect(index.staticCapable).toBe(false);
    expect(index.staticBlockers[0]).toContain("backend-only");
    expect(index.staticBlockers[0]).toContain("src/main/resources/static/index.html");
  });

  it("does not mistake server-rendered Thymeleaf templates for a static bundle", () => {
    const files: F[] = [
      file("pom.xml", pom),
      file("src/main/resources/templates/index.html", `<html xmlns:th="http://www.thymeleaf.org"><p th:text="${'${message}'}"></p></html>`),
    ];
    expect(discoverProjectEntries(files)).toHaveLength(0);
    const { index } = planProjectGrounding(files, "Spring Thymeleaf");
    expect(index.buildTool).toBe("spring-boot");
    expect(index.staticCapable).toBe(false);
  });
});

describe("previously normalized static project", () => {
  const files: F[] = [
    file("index.html", HTML),
    file("package.json", JSON.stringify({
      scripts: { build: "node static-copy.js" },
      dependencies: { "@capacitor/core": "^7.0.0" },
    })),
    file(STATIC_HTML_MARKER, JSON.stringify({ type: "static-html", webDir: "www" })),
    file("www/index.html", HTML),
  ];

  it("keeps plain-html classification and www instead of drifting to capacitor/dist", () => {
    const { index } = planProjectGrounding(files, "Grounded");
    expect(index.shape).toBe("plain-html");
    expect(index.outputDir).toBe("www");
    expect(index.entryHtml).toBe("index.html");
  });
});

describe("no HTML entry point at all", () => {
  it("does not fabricate an index.html", () => {
    const { patches } = planProjectGrounding([file("readme.md", "# hi")], "Empty");
    const synthetic = patches.find((p) => p.path.endsWith("index.html"));
    expect(synthetic).toBeUndefined();
  });
});

describe("project index shape", () => {
  it("always reports a build command and output dir", () => {
    const { index }: { index: ProjectIndex } = planProjectGrounding([file("index.html", HTML)], "X");
    expect(index.buildCommand).toBeTruthy();
    expect(index.outputDir).toBeTruthy();
  });
});

describe("entry-point discovery", () => {
  it("returns selectable entries with concrete outputs for a monorepo", () => {
    const files: F[] = [
      file("apps/site/index.html", HTML),
      file("apps/site/package.json", JSON.stringify({ scripts: { build: "vite build" }, devDependencies: { vite: "^5" } })),
      file("apps/admin/index.html", HTML),
      file("apps/admin/package.json", JSON.stringify({ scripts: { build: "vite build" }, devDependencies: { vite: "^5" } })),
    ];
    const entries = discoverProjectEntries(files);
    expect(entries.map((entry) => entry.entryHtml)).toEqual(["apps/admin/index.html", "apps/site/index.html"]);
    expect(entries.every((entry) => entry.outputDir === "dist")).toBe(true);
  });

  it("gives plain HTML a www output before project creation", () => {
    const [entry] = discoverProjectEntries([file("site/index.html", HTML)]);
    expect(entry.entryHtml).toBe("site/index.html");
    expect(entry.projectRoot).toBe("site");
    expect(entry.outputDir).toBe("www");
    expect(entry.buildCommand).toBe("npm run build");
  });

  it("discovers and normalizes a multi-page HTML site without index.html", () => {
    const files: F[] = [
      file("site/home.html", `<a href="about.html">About</a>`),
      file("site/about.html", `<a href="/home.html">Home</a>`),
      file("site/assets/site.css", `body{background:url('/hero.png')}`),
    ];
    const entries = discoverProjectEntries(files);
    expect(entries.map((entry) => entry.entryHtml)).toEqual(["site/home.html", "site/about.html"]);
    expect(entries.every((entry) => entry.framework === "plain HTML" && entry.outputDir === "www")).toBe(true);

    const { index, patches } = planProjectGrounding(files, "Multi Page", { preferredRoot: "site", preferredEntry: "site/home.html" });
    expect(index.shape).toBe("plain-html");
    expect(index.entryHtml).toBe("site/home.html");
    expect(index.outputDir).toBe("www");
    expect(byPath(patches, "site/www/index.html")?.content).toContain("About");
    expect(byPath(patches, "site/www/about.html")?.content).toContain("./home.html");
    expect(byPath(patches, "site/www/assets/site.css")?.content).toContain("url('hero.png')");
  });

  it("ignores generated HTML folders while finding source pages", () => {
    const entries = discoverProjectEntries([
      file("site/main.html", HTML),
      file("site/dist/index.html", HTML),
      file("site/www/index.html", HTML),
      file("site/node_modules/pkg/index.html", HTML),
    ]);
    expect(entries.map((entry) => entry.entryHtml)).toEqual(["site/main.html"]);
  });
});

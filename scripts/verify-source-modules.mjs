import { access } from "node:fs/promises";

const requiredModules = [
  "src/lib/logs/logSink.ts",
  "src/components/logs/LogsExplorer.tsx",
];

const missing = [];
for (const path of requiredModules) {
  try {
    await access(path);
  } catch {
    missing.push(path);
  }
}

if (missing.length > 0) {
  console.error(`Required source modules are missing:\n${missing.map((path) => `- ${path}`).join("\n")}`);
  process.exit(1);
}

console.log("Required source modules verified.");
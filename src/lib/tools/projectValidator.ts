/**
 * TOOL: Project Validator
 * Pre-build security & structure validation.
 * Blocks broken or malicious projects before they reach the cloud builder.
 */

import type { ProjectScanResult } from "./projectScanner";

export interface ValidationResult {
  canBuild: boolean;
  errors: string[];
  warnings: string[];
}

interface FileEntry {
  path: string;
  type: "file" | "folder";
  content?: string;
  size?: number;
  isBinary?: boolean;
  binaryContent?: ArrayBuffer;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Patterns that indicate potentially malicious code
const MALICIOUS_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /eval\s*\(\s*atob\s*\(/, label: "eval(atob(...)) — base64-encoded eval" },
  { pattern: /eval\s*\(\s*unescape\s*\(/, label: "eval(unescape(...)) — encoded eval" },
  { pattern: /eval\s*\(\s*String\.fromCharCode/, label: "eval(String.fromCharCode(...)) — char code eval" },
  { pattern: /new\s+Function\s*\(\s*atob/, label: "new Function(atob(...)) — dynamic function from base64" },
  { pattern: /document\.write\s*\(\s*unescape/, label: "document.write(unescape(...)) — obfuscated DOM write" },
  { pattern: /\\x[0-9a-fA-F]{2}(\\x[0-9a-fA-F]{2}){20,}/, label: "Excessive hex escape sequences — possible obfuscation" },
  { pattern: /child_process|spawn\s*\(|exec\s*\(\s*['"`].*rm\s+-rf/, label: "Shell command execution" },
  { pattern: /process\.env\[.*\]\s*\+\s*['"`]/, label: "Environment variable exfiltration pattern" },
];

// File name patterns that could indicate shell injection
const DANGEROUS_FILE_NAMES = [
  /[;&|`$]/, // Shell metacharacters in file names
  /\.\.\//,  // Path traversal
];

/**
 * Validates a project before sending to cloud builder.
 * Returns structured errors (block build) and warnings (allow but inform).
 */
export function validateProjectForBuild(
  files: FileEntry[],
  scan: ProjectScanResult | null
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sourceFiles = files.filter(f => f.type === "file");
  const hasIndexHtml = sourceFiles.some(f => f.path === "index.html" || f.path.endsWith("/index.html"));
  const isStaticHtml = scan?.framework === "static" || (!scan?.hasPackageJson && hasIndexHtml);

  // 1. Must have package.json unless this is a plain static HTML project.
  // Static projects are grounded by synthesizing package.json + dist output.
  if (scan && !scan.hasPackageJson && !isStaticHtml) {
    errors.push("No package.json found — the cloud builder cannot install dependencies without it.");
  } else if (isStaticHtml && !scan?.hasPackageJson) {
    warnings.push("Static HTML project detected — package.json and build output will be generated automatically.");
  }

  // 2. Should have a build script
  if (scan && scan.hasPackageJson && !scan.hasBuildScript) {
    warnings.push("No 'build' script in package.json — the builder will attempt common alternatives but may fail.");
  }

  // 3. Check for oversized files
  for (const f of sourceFiles) {
    const size = f.size || (f.binaryContent?.byteLength ?? 0) || (f.content?.length ?? 0);
    if (size > MAX_FILE_SIZE) {
      errors.push(`File "${f.path}" is ${(size / (1024 * 1024)).toFixed(1)} MB — exceeds 50 MB limit.`);
    }
  }

  // 4. Check for dangerous file names
  for (const f of sourceFiles) {
    for (const pattern of DANGEROUS_FILE_NAMES) {
      if (pattern.test(f.path)) {
        errors.push(`File name "${f.path}" contains dangerous characters — possible injection attempt.`);
        break;
      }
    }
  }

  // 5. Scan text content for malicious patterns
  let maliciousHits = 0;
  for (const f of sourceFiles) {
    if (!f.content || f.isBinary) continue;
    // Skip node_modules, lock files, and minified bundles > 500KB
    if (f.path.includes("node_modules/") || f.path.endsWith(".lock") || f.path.endsWith(".lockb")) continue;
    if (f.content.length > 500_000) continue; // Skip large minified files

    for (const { pattern, label } of MALICIOUS_PATTERNS) {
      if (pattern.test(f.content)) {
        maliciousHits++;
        warnings.push(`Suspicious pattern in "${f.path}": ${label}`);
        if (maliciousHits >= 5) {
          errors.push("Multiple suspicious code patterns detected — project may contain malicious code.");
          break;
        }
      }
    }
    if (maliciousHits >= 5) break;
  }

  // 6. SSR warning from scan
  if (scan?.hasSSR) {
    warnings.push(`${scan.framework} uses SSR — ensure static export is configured for native builds.`);
  }

  return {
    canBuild: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Convert validation result to log lines for the AI Action Feed.
 */
export function validationToLogs(result: ValidationResult): string[] {
  const logs: string[] = [];
  if (result.canBuild && result.warnings.length === 0) {
    logs.push("✓ Project passed all pre-build checks");
  }
  for (const e of result.errors) logs.push(`✗ ${e}`);
  for (const w of result.warnings) logs.push(`⚠ ${w}`);
  return logs;
}

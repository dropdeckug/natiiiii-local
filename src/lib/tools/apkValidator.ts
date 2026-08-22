/**
 * TOOL: APK Validator
 * Validates the built APK artifact (as a ZIP from GitHub Actions) for:
 *   - Manifest presence and validity
 *   - Icon presence in density buckets
 *   - Correct package name
 *   - APK file integrity
 */

import JSZip from "jszip";

export interface ApkValidationResult {
  valid: boolean;
  apkFound: boolean;
  apkSizeBytes: number;
  checks: ApkCheck[];
  warnings: string[];
  errors: string[];
}

export interface ApkCheck {
  id: string;
  label: string;
  status: "pass" | "fail" | "warn";
  detail: string;
}

/**
 * Validates an APK artifact ZIP (the GitHub Actions upload-artifact output).
 * The ZIP contains the .apk file(s).
 */
export async function validateApkArtifact(
  artifactZip: JSZip,
  expectedPackageName?: string,
  expectedAppName?: string
): Promise<ApkValidationResult> {
  const checks: ApkCheck[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. Find APK file in artifact
  const apkFileName = Object.keys(artifactZip.files).find(name => name.endsWith(".apk"));
  if (!apkFileName) {
    return {
      valid: false,
      apkFound: false,
      apkSizeBytes: 0,
      checks: [{ id: "apk-present", label: "APK file", status: "fail", detail: "No .apk file found in build artifact" }],
      warnings,
      errors: ["No APK file found in the build artifact ZIP"],
    };
  }

  const apkData = await artifactZip.files[apkFileName].async("arraybuffer");
  const apkSizeBytes = apkData.byteLength;

  checks.push({
    id: "apk-present",
    label: "APK file",
    status: "pass",
    detail: `Found: ${apkFileName} (${(apkSizeBytes / (1024 * 1024)).toFixed(1)} MB)`,
  });

  // 2. Validate APK size (should be at least 500KB for a real app)
  if (apkSizeBytes < 500 * 1024) {
    checks.push({
      id: "apk-size",
      label: "APK size",
      status: "warn",
      detail: `APK is very small (${(apkSizeBytes / 1024).toFixed(0)} KB) — may be incomplete`,
    });
    warnings.push("APK file is suspiciously small. The build may have failed partially.");
  } else if (apkSizeBytes > 100 * 1024 * 1024) {
    checks.push({
      id: "apk-size",
      label: "APK size",
      status: "warn",
      detail: `APK is very large (${(apkSizeBytes / (1024 * 1024)).toFixed(0)} MB)`,
    });
    warnings.push("APK exceeds 100MB. Consider enabling ProGuard or splitting APKs.");
  } else {
    checks.push({
      id: "apk-size",
      label: "APK size",
      status: "pass",
      detail: `${(apkSizeBytes / (1024 * 1024)).toFixed(1)} MB — within normal range`,
    });
  }

  // 3. Try to inspect APK contents (APK is a ZIP file)
  try {
    const apkZip = await JSZip.loadAsync(apkData);
    const apkFiles = Object.keys(apkZip.files);

    // Check for AndroidManifest.xml
    const hasManifest = apkFiles.some(f => f === "AndroidManifest.xml");
    checks.push({
      id: "manifest",
      label: "AndroidManifest.xml",
      status: hasManifest ? "pass" : "fail",
      detail: hasManifest ? "Manifest found in APK" : "AndroidManifest.xml missing from APK",
    });
    if (!hasManifest) errors.push("AndroidManifest.xml not found in APK");

    // Check for classes.dex (compiled code)
    const hasDex = apkFiles.some(f => f.endsWith(".dex"));
    checks.push({
      id: "dex",
      label: "Compiled code (DEX)",
      status: hasDex ? "pass" : "fail",
      detail: hasDex ? `DEX files found (${apkFiles.filter(f => f.endsWith(".dex")).length} file(s))` : "No DEX files — app has no compiled code",
    });
    if (!hasDex) errors.push("No DEX files found. The APK may be empty or corrupted.");

    // Check for resources
    const hasResources = apkFiles.some(f => f === "resources.arsc");
    checks.push({
      id: "resources",
      label: "Resources",
      status: hasResources ? "pass" : "warn",
      detail: hasResources ? "Resource table found" : "resources.arsc missing — app may lack UI resources",
    });

    // Check for app icons in various densities
    const iconDensities = ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"];
    const foundIcons = iconDensities.filter(d =>
      apkFiles.some(f => f.includes(`mipmap-${d}`) || f.includes(`drawable-${d}`))
    );
    if (foundIcons.length >= 3) {
      checks.push({
        id: "icons",
        label: "App icons",
        status: "pass",
        detail: `Icons found for ${foundIcons.length}/${iconDensities.length} densities (${foundIcons.join(", ")})`,
      });
    } else if (foundIcons.length > 0) {
      checks.push({
        id: "icons",
        label: "App icons",
        status: "warn",
        detail: `Only ${foundIcons.length} icon densities found. Some devices may show blurry icons.`,
      });
      warnings.push(`Only ${foundIcons.length} icon density buckets present. Recommended: at least 3.`);
    } else {
      checks.push({
        id: "icons",
        label: "App icons",
        status: "warn",
        detail: "No density-specific icons found. Default Android icon will be used.",
      });
      warnings.push("No app icons found in the APK.");
    }

    // Check for web assets (Capacitor apps should have public/ or assets/public/)
    const hasWebAssets = apkFiles.some(f =>
      f.includes("assets/public/index.html") || f.includes("assets/public/") || f.includes("assets/www/")
    );
    if (hasWebAssets) {
      checks.push({
        id: "web-assets",
        label: "Web assets",
        status: "pass",
        detail: "Web app files found in APK assets",
      });
    } else {
      // Check if there are any assets at all
      const hasAnyAssets = apkFiles.some(f => f.startsWith("assets/"));
      checks.push({
        id: "web-assets",
        label: "Web assets",
        status: hasAnyAssets ? "warn" : "warn",
        detail: hasAnyAssets ? "Assets directory exists but no index.html found" : "No assets directory — may be a URL-mode app",
      });
    }

    // Check for signing (META-INF should contain cert files)
    const hasSignature = apkFiles.some(f => f.startsWith("META-INF/") && (f.endsWith(".RSA") || f.endsWith(".SF") || f.endsWith(".DSA")));
    checks.push({
      id: "signing",
      label: "APK signing",
      status: hasSignature ? "pass" : "warn",
      detail: hasSignature ? "APK is signed" : "No signature found — APK may be unsigned (debug build)",
    });

    // Package name validation (from APK filename convention)
    if (expectedPackageName && apkFileName) {
      // Debug APKs typically don't encode the package name in the filename,
      // but we can check the manifest binary for the package string
      try {
        const manifestData = await apkZip.files["AndroidManifest.xml"]?.async("arraybuffer");
        if (manifestData) {
          const bytes = new Uint8Array(manifestData);
          // Binary XML — search for package name string
          const decoder = new TextDecoder("utf-8", { fatal: false });
          const roughText = decoder.decode(bytes);
          const containsPackage = roughText.includes(expectedPackageName);
          checks.push({
            id: "package-name",
            label: "Package name",
            status: containsPackage ? "pass" : "warn",
            detail: containsPackage
              ? `Package '${expectedPackageName}' found in manifest`
              : `Could not verify '${expectedPackageName}' in binary manifest`,
          });
        }
      } catch {
        checks.push({
          id: "package-name",
          label: "Package name",
          status: "warn",
          detail: "Could not parse binary manifest to verify package name",
        });
      }
    }
  } catch (zipErr) {
    checks.push({
      id: "apk-integrity",
      label: "APK integrity",
      status: "fail",
      detail: "APK file is not a valid ZIP archive — may be corrupted",
    });
    errors.push("APK file could not be opened as a ZIP archive.");
  }

  const hasErrors = checks.some(c => c.status === "fail");

  return {
    valid: !hasErrors,
    apkFound: true,
    apkSizeBytes,
    checks,
    warnings,
    errors,
  };
}

export function validationToLogs(result: ApkValidationResult): string[] {
  const logs: string[] = [];
  logs.push("── APK Validation ──");
  for (const check of result.checks) {
    const icon = check.status === "pass" ? "✓" : check.status === "warn" ? "⚠" : "✗";
    logs.push(`${icon} ${check.label}: ${check.detail}`);
  }
  if (result.warnings.length > 0) {
    for (const w of result.warnings) logs.push(`⚠ ${w}`);
  }
  if (result.errors.length > 0) {
    for (const e of result.errors) logs.push(`✗ ${e}`);
  }
  logs.push(result.valid ? "✓ APK validation passed" : "✗ APK validation failed");
  return logs;
}

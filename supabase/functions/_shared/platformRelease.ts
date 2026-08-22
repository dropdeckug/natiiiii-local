/**
 * NativeForge platform release.
 * Runtime-agnostic by design so browser CPR and Edge workflows consume the
 * exact same compatibility contract.
 */
export const PLATFORM_RELEASE = {
  id: "2026.08",
  nodeVersion: "24",
  npmVersion: "11.5.1",
  capacitorMajor: 7,
  capacitorVersion: "7.4.3",
  compileSdk: 36,
  targetSdk: 36,
  minSdk: 24,
  agpVersion: "8.7.3",
  gradleVersion: "8.10.2",
  jdkVersion: 21,
} as const;

export type PlatformRelease = typeof PLATFORM_RELEASE;
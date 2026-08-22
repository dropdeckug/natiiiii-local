/**
 * TOOL 5: Config Generator
 * Generates all Android/Capacitor config files using the version matrix.
 * Single source of truth — no hardcoded versions anywhere else.
 */

import { CURRENT_ANDROID_CONFIG, generateVariablesGradle } from "@/lib/generators/versionMatrix";

export interface GeneratedConfig {
  variablesGradle: string;
  agpVersion: string;
  gradleVersion: string;
  capacitorVersion: string;
  jdkVersion: number;
  compileSdk: number;
  targetSdk: number;
  minSdk: number;
}

export function generateBuildConfig(): GeneratedConfig {
  const cfg = CURRENT_ANDROID_CONFIG;
  return {
    variablesGradle: generateVariablesGradle(cfg),
    agpVersion: cfg.agpVersion,
    gradleVersion: cfg.gradleVersion,
    capacitorVersion: cfg.capacitorVersion,
    jdkVersion: cfg.jdkVersion,
    compileSdk: cfg.compileSdk,
    targetSdk: cfg.targetSdk,
    minSdk: cfg.minSdk,
  };
}

export function configToLogs(config: GeneratedConfig): string[] {
  return [
    `Capacitor: ${config.capacitorVersion}`,
    `compileSdk: ${config.compileSdk} | targetSdk: ${config.targetSdk} | minSdk: ${config.minSdk}`,
    `AGP: ${config.agpVersion} | Gradle: ${config.gradleVersion} | JDK: ${config.jdkVersion}`,
  ];
}

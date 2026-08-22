/**
 * Single source of truth for Android build version compatibility.
 * All generators and workflows MUST import from here — no scattered hardcoded versions.
 */

export interface AndroidVersionConfig {
  capacitorVersion: string;
  compileSdk: number;
  targetSdk: number;
  minSdk: number;
  agpVersion: string;
  gradleVersion: string;
  jdkVersion: number;
  androidxActivityVersion: string;
  androidxAppCompatVersion: string;
  androidxCoordinatorLayoutVersion: string;
  androidxCoreVersion: string;
  androidxFragmentVersion: string;
  coreSplashScreenVersion: string;
  androidxWebkitVersion: string;
  junitVersion: string;
  androidxJunitVersion: string;
  androidxEspressoCoreVersion: string;
  cordovaAndroidVersion: string;
}

import { PLATFORM_RELEASE } from "../../../cpr/versions/index";

/** Current Android config, projected from the CPR platform release. */
export const CURRENT_ANDROID_CONFIG: AndroidVersionConfig = {
  capacitorVersion: PLATFORM_RELEASE.capacitorVersion,
  compileSdk: PLATFORM_RELEASE.compileSdk,
  targetSdk: PLATFORM_RELEASE.targetSdk,
  minSdk: PLATFORM_RELEASE.minSdk,
  agpVersion: PLATFORM_RELEASE.agpVersion,
  gradleVersion: PLATFORM_RELEASE.gradleVersion,
  jdkVersion: PLATFORM_RELEASE.jdkVersion,
  androidxActivityVersion: "1.9.3",
  androidxAppCompatVersion: "1.7.0",
  androidxCoordinatorLayoutVersion: "1.2.0",
  androidxCoreVersion: "1.15.0",
  androidxFragmentVersion: "1.8.5",
  coreSplashScreenVersion: "1.0.1",
  androidxWebkitVersion: "1.12.1",
  junitVersion: "4.13.2",
  androidxJunitVersion: "1.2.1",
  androidxEspressoCoreVersion: "3.6.1",
  cordovaAndroidVersion: "10.1.1",
};

/**
 * Generates the variables.gradle content from the version matrix.
 */
export function generateVariablesGradle(config = CURRENT_ANDROID_CONFIG): string {
  return `ext {
    minSdkVersion = ${config.minSdk}
    compileSdkVersion = ${config.compileSdk}
    targetSdkVersion = ${config.targetSdk}
    androidxActivityVersion = '${config.androidxActivityVersion}'
    androidxAppCompatVersion = '${config.androidxAppCompatVersion}'
    androidxCoordinatorLayoutVersion = '${config.androidxCoordinatorLayoutVersion}'
    androidxCoreVersion = '${config.androidxCoreVersion}'
    androidxFragmentVersion = '${config.androidxFragmentVersion}'
    coreSplashScreenVersion = '${config.coreSplashScreenVersion}'
    androidxWebkitVersion = '${config.androidxWebkitVersion}'
    junitVersion = '${config.junitVersion}'
    androidxJunitVersion = '${config.androidxJunitVersion}'
    androidxEspressoCoreVersion = '${config.androidxEspressoCoreVersion}'
    cordovaAndroidVersion = '${config.cordovaAndroidVersion}'
}
`;
}

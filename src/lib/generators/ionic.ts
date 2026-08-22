import type { GeneratorConfig, GeneratedFile } from "./shared";
import { generateCapacitorProject } from "./capacitor";

// Ionic builds on top of Capacitor — same project structure,
// but adds Ionic-specific dependencies and configuration

export const generateIonicProject = (config: GeneratorConfig): GeneratedFile[] => {
  const baseFiles = generateCapacitorProject(config);

  // Override capacitor.config.ts with Ionic-specific config
  const configIdx = baseFiles.findIndex(f => f.path === "capacitor.config.ts");
  if (configIdx !== -1) {
    baseFiles[configIdx] = {
      path: "capacitor.config.ts",
      content: `import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: '${config.packageName}',
  appName: '${config.appName}',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    }
  }
};

export default config;
`,
    };
  }

  // Override app/build.gradle to add Ionic dependencies
  const appGradleIdx = baseFiles.findIndex(f => f.path === "app/build.gradle");
  if (appGradleIdx !== -1) {
    const original = baseFiles[appGradleIdx].content as string;
    baseFiles[appGradleIdx] = {
      path: "app/build.gradle",
      content: original.replace(
        `androidTestImplementation "androidx.test.espresso:espresso-core:$androidxEspressoCoreVersion"`,
        `androidTestImplementation "androidx.test.espresso:espresso-core:$androidxEspressoCoreVersion"

    // Ionic Framework
    implementation 'com.google.android.material:material:1.11.0'`
      ),
    };
  }

  return baseFiles;
};

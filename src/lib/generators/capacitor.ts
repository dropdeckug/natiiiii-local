import type { GeneratorConfig, GeneratedFile } from "./shared";
import { getSharedFiles } from "./shared";

import { generateVariablesGradle, CURRENT_ANDROID_CONFIG } from "./versionMatrix";

const variablesGradle = () => generateVariablesGradle();

const rootBuildGradle = () =>
`buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.7.3'
        classpath 'com.google.gms:google-services:4.4.0'
    }
}

apply from: "variables.gradle"

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

task clean(type: Delete) {
    delete rootProject.buildDir
}
`;

const settingsGradle = (appName: string) =>
`include ':app'
rootProject.name = '${appName}'
`;

const appBuildGradle = (packageName: string) =>
`apply plugin: 'com.android.application'

android {
    namespace "${packageName}"
    compileSdk rootProject.ext.compileSdkVersion

    defaultConfig {
        applicationId "${packageName}"
        minSdk rootProject.ext.minSdkVersion
        targetSdk rootProject.ext.targetSdkVersion
        versionCode 1
        versionName "1.0"
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_21
        targetCompatibility JavaVersion.VERSION_21
    }
}

dependencies {
    // Capacitor core (Maven Central artifact)
    implementation 'com.capacitorjs:core:7.5.0'
    implementation 'org.apache.cordova:framework:10.1.1'
    implementation "androidx.appcompat:appcompat:\$androidxAppCompatVersion"
    implementation "androidx.coordinatorlayout:coordinatorlayout:\$androidxCoordinatorLayoutVersion"
    implementation "androidx.activity:activity:\$androidxActivityVersion"
    implementation "androidx.fragment:fragment:\$androidxFragmentVersion"
    implementation "androidx.webkit:webkit:\$androidxWebkitVersion"

    testImplementation "junit:junit:\$junitVersion"
    androidTestImplementation "androidx.test.ext:junit:\$androidxJunitVersion"
    androidTestImplementation "androidx.test.espresso:espresso-core:\$androidxEspressoCoreVersion"
}
`;

const androidManifest = (packageName: string) =>
`<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:launchMode="singleTask"
            android:theme="@style/AppTheme.NoActionBarLaunch">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="\${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>
    </application>
</manifest>
`;

const mainActivity = (packageName: string) =>
`package ${packageName};

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }
}
`;

const stylesXml = () =>
`<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
    </style>

    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
    </style>

    <style name="AppTheme.NoActionBarLaunch" parent="AppTheme.NoActionBar">
        <item name="android:background">@drawable/splash_screen</item>
    </style>
</resources>
`;

const colorsXml = () =>
`<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#FF6200EE</color>
    <color name="colorPrimaryDark">#FF3700B3</color>
    <color name="colorAccent">#FF03DAC5</color>
</resources>
`;

const capacitorConfigTs = (packageName: string, appName: string) =>
`import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: '${packageName}',
  appName: '${appName}',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
    cleartext: true,
  },
  android: {
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#111111',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default config;
`;

const capacitorConfigJson = (packageName: string, appName: string, url?: string) => {
  const config: Record<string, unknown> = {
    appId: packageName,
    appName: appName,
    // Must match what the GH Actions workflow copies into android/app/src/main/assets/public
    webDir: "public",
    server: {
      androidScheme: "https",
      hostname: "localhost",
      cleartext: true,
      ...(url ? { url } : {}),
    },
    android: {
      webContentsDebuggingEnabled: true,
    },
    plugins: {
      SplashScreen: {
        launchShowDuration: 1500,
        launchAutoHide: true,
        backgroundColor: "#111111",
        androidSplashResourceName: "splash",
        androidScaleType: "CENTER_CROP",
        showSpinner: false,
      },
    },
  };
  return JSON.stringify(config, null, 2);
};

const fallbackIndexHtml = (url?: string) =>
`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Loading...</title>
  <style>
    body { margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui, sans-serif; background: #111; color: #fff; }
    .loader { text-align: center; }
    .spinner { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <p>Loading app...</p>
  </div>
${url ? `  <script>window.location.href = ${JSON.stringify(url)};</script>` : ''}
</body>
</html>
`;

export const generateCapacitorProject = (config: GeneratorConfig): GeneratedFile[] => {
  const pkgPath = config.packageName.replace(/\./g, "/");

  return [
    ...getSharedFiles(config),
    { path: "variables.gradle", content: variablesGradle() },
    { path: "build.gradle", content: rootBuildGradle() },
    { path: "settings.gradle", content: settingsGradle(config.appName) },
    { path: "app/build.gradle", content: appBuildGradle(config.packageName) },
    
    { path: "app/src/main/AndroidManifest.xml", content: androidManifest(config.packageName) },
    { path: `app/src/main/java/${pkgPath}/MainActivity.java`, content: mainActivity(config.packageName) },
    { path: "app/src/main/res/values/styles.xml", content: stylesXml() },
    { path: "app/src/main/res/values/colors.xml", content: colorsXml() },
    { path: "capacitor.config.ts", content: capacitorConfigTs(config.packageName, config.appName) },
    // Runtime config that the Android Capacitor runtime actually reads
    { path: "app/src/main/assets/capacitor.config.json", content: capacitorConfigJson(config.packageName, config.appName, config.url) },
    // Fallback index.html so BridgeActivity always has something to load
    { path: "app/src/main/assets/public/index.html", content: fallbackIndexHtml(config.url) },
  ];
};

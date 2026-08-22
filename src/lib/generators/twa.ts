import type { GeneratorConfig, GeneratedFile } from "./shared";
import { getSharedFiles } from "./shared";

const rootBuildGradle = () =>
`buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.2.2'
    }
}

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
`rootProject.name = '${appName}'
include ':app'
`;

const appBuildGradle = (packageName: string) =>
`plugins {
    id 'com.android.application'
}

android {
    namespace '${packageName}'
    compileSdk 34

    defaultConfig {
        applicationId "${packageName}"
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0"

        manifestPlaceholders = [
            hostName: "",
            defaultUrl: "",
            launcherName: "${packageName}",
            assetStatements: '[]'
        ]
    }

    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

dependencies {
    implementation 'com.google.androidbrowserhelper:androidbrowserhelper:2.5.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'androidx.core:core-splashscreen:1.0.1'
}
`;

const androidManifest = (packageName: string, url: string) => {
  let host = "";
  try { host = new URL(url).hostname; } catch {}

  return `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${packageName}">

    <uses-permission android:name="android.permission.INTERNET" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">

        <meta-data
            android:name="asset_statements"
            android:resource="@string/asset_statements" />

        <activity
            android:name="android.support.customtabs.trusted.LauncherActivity"
            android:exported="true"
            android:label="@string/app_name">
            <meta-data
                android:name="android.support.customtabs.trusted.DEFAULT_URL"
                android:value="${url}" />
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="${host}" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`;
};

const stringsXml = (appName: string, url: string) => {
  let host = "";
  try { host = new URL(url).hostname; } catch {}

  return `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${appName}</string>
    <string name="asset_statements">
        [{
            \\"relation\\": [\\"delegate_permission/common.handle_all_urls\\"],
            \\"target\\": {
                \\"namespace\\": \\"web\\",
                \\"site\\": \\"https://${host}\\"
            }
        }]
    </string>
</resources>
`;
};

const stylesXml = () =>
`<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.Light.NoActionBar">
        <item name="colorPrimary">#FF6200EE</item>
        <item name="colorPrimaryDark">#FF3700B3</item>
        <item name="colorAccent">#FF03DAC5</item>
        <item name="android:windowBackground">@drawable/splash_screen</item>
    </style>
</resources>
`;

export const generateTwaProject = (config: GeneratorConfig): GeneratedFile[] => {
  const url = config.url || "https://example.com";
  const files = getSharedFiles(config);

  // Override strings.xml from shared with TWA-specific one
  const stringsIdx = files.findIndex(f => f.path === "app/src/main/res/values/strings.xml");
  if (stringsIdx !== -1) {
    files[stringsIdx] = { path: "app/src/main/res/values/strings.xml", content: stringsXml(config.appName, url) };
  }

  return [
    ...files,
    { path: "build.gradle", content: rootBuildGradle() },
    { path: "settings.gradle", content: settingsGradle(config.appName) },
    { path: "app/build.gradle", content: appBuildGradle(config.packageName) },
    { path: "app/src/main/AndroidManifest.xml", content: androidManifest(config.packageName, url) },
    { path: "app/src/main/res/values/styles.xml", content: stylesXml() },
  ];
};

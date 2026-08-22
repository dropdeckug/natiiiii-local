import { useState } from "react";
import { Globe, Smartphone, Image as ImageIcon, Type, Loader2, Download, CheckCircle, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import JSZip from "jszip";

interface AppConfig {
  websiteUrl: string;
  appName: string;
  packageName: string;
  appIcon: File | null;
  splashScreen: File | null;
}

type BuildStatus = "idle" | "building" | "success" | "error";

const generateAndroidManifest = (packageName: string, appName: string) => `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${packageName}">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="${appName}"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:launchMode="singleTop">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;

const generateMainActivity = (packageName: string, url: string) => `package ${packageName};

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.GeolocationPermissions;
import android.webkit.ValueCallback;
import android.net.Uri;

public class MainActivity extends Activity {

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Fullscreen
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        );

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                view.loadUrl(url);
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }
        });

        webView.loadUrl("${url}");
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}`;

const generateBuildGradle = (packageName: string) => `plugins {
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
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'androidx.webkit:webkit:1.8.0'
}`;

const generateStringsXml = (appName: string) => `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${appName}</string>
</resources>`;

const generateStylesXml = () => `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="android:Theme.Material.Light.NoActionBar">
        <item name="android:windowBackground">@drawable/splash_screen</item>
        <item name="android:statusBarColor">@android:color/transparent</item>
        <item name="android:navigationBarColor">@android:color/transparent</item>
    </style>
</resources>`;

const generateSplashDrawable = () => `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@android:color/white" />
    <item>
        <bitmap
            android:gravity="center"
            android:src="@mipmap/ic_launcher" />
    </item>
</layer-list>`;

const generateSettingsGradle = (appName: string) => `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "${appName}"
include ':app'`;

const generateRootBuildGradle = () => `plugins {
    id 'com.android.application' version '8.2.0' apply false
}`;

const generateGradleProperties = () => `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.nonTransitiveRClass=true`;

const generateReadme = (appName: string, url: string) => `# ${appName}

Android WebView app wrapping: ${url}

## Build Instructions

1. Open this project in Android Studio
2. Wait for Gradle sync to complete
3. Run on emulator or device (API 24+)

## Generated by MobileForge
`;

const UrlConfigForm = () => {
  const [config, setConfig] = useState<AppConfig>({
    websiteUrl: "",
    appName: "",
    packageName: "com.mobileforge.app",
    appIcon: null,
    splashScreen: null,
  });
  const [buildStatus, setBuildStatus] = useState<BuildStatus>("idle");
  const [buildProgress, setBuildProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: "appIcon" | "splashScreen") => {
    const file = e.target.files?.[0] || null;
    setConfig((prev) => ({ ...prev, [field]: file }));
  };

  const isValidUrl = (url: string) => {
    try { new URL(url); return true; } catch { return false; }
  };

  const handleBuild = async () => {
    if (!config.websiteUrl || !isValidUrl(config.websiteUrl)) return;

    setBuildStatus("building");
    setBuildProgress(0);

    const progressInterval = setInterval(() => {
      setBuildProgress((prev) => {
        if (prev >= 95) return prev;
        return prev + Math.random() * 12;
      });
    }, 400);

    // Generate real Android project ZIP
    setTimeout(async () => {
      clearInterval(progressInterval);
      setBuildProgress(100);
      setBuildStatus("success");
    }, 4000);
  };

  const handleDownload = async () => {
    const zip = new JSZip();
    const appName = config.appName || "MyApp";
    const pkg = config.packageName || "com.mobileforge.app";
    const pkgPath = pkg.replace(/\./g, "/");

    // Android project structure
    zip.file("README.md", generateReadme(appName, config.websiteUrl));
    zip.file("settings.gradle", generateSettingsGradle(appName));
    zip.file("build.gradle", generateRootBuildGradle());
    zip.file("gradle.properties", generateGradleProperties());
    zip.file("app/build.gradle", generateBuildGradle(pkg));
    zip.file("app/src/main/AndroidManifest.xml", generateAndroidManifest(pkg, appName));
    zip.file(`app/src/main/java/${pkgPath}/MainActivity.java`, generateMainActivity(pkg, config.websiteUrl));
    zip.file("app/src/main/res/values/strings.xml", generateStringsXml(appName));
    zip.file("app/src/main/res/values/styles.xml", generateStylesXml());
    zip.file("app/src/main/res/drawable/splash_screen.xml", generateSplashDrawable());

    // Add app icon if provided
    if (config.appIcon) {
      const iconData = await config.appIcon.arrayBuffer();
      zip.file("app/src/main/res/mipmap-xxxhdpi/ic_launcher.png", iconData);
      zip.file("app/src/main/res/mipmap-xxhdpi/ic_launcher.png", iconData);
      zip.file("app/src/main/res/mipmap-xhdpi/ic_launcher.png", iconData);
      zip.file("app/src/main/res/mipmap-hdpi/ic_launcher.png", iconData);
      zip.file("app/src/main/res/mipmap-mdpi/ic_launcher.png", iconData);
      zip.file("app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png", iconData);
      zip.file("app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png", iconData);
      zip.file("app/src/main/res/mipmap-xhdpi/ic_launcher_round.png", iconData);
      zip.file("app/src/main/res/mipmap-hdpi/ic_launcher_round.png", iconData);
      zip.file("app/src/main/res/mipmap-mdpi/ic_launcher_round.png", iconData);
    }

    // Add splash screen if provided
    if (config.splashScreen) {
      const splashData = await config.splashScreen.arrayBuffer();
      zip.file("app/src/main/res/drawable-xxxhdpi/splash_image.png", splashData);
      zip.file("app/src/main/res/drawable-xxhdpi/splash_image.png", splashData);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${appName.replace(/\s+/g, "_")}_android_project.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const canBuild = config.websiteUrl && isValidUrl(config.websiteUrl) && config.appName;

  return (
    <div className="space-y-5">
      {/* Website URL */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Globe size={16} className="text-primary" />
          Website URL
        </label>
        <Input
          type="url"
          placeholder="https://example.com"
          value={config.websiteUrl}
          onChange={(e) => setConfig((prev) => ({ ...prev, websiteUrl: e.target.value }))}
          className="bg-background border-border"
        />
        {config.websiteUrl && !isValidUrl(config.websiteUrl) && (
          <p className="text-xs text-destructive">Please enter a valid URL</p>
        )}
      </div>

      {/* App Name */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Type size={16} className="text-primary" />
          App Name
        </label>
        <Input
          type="text"
          placeholder="My Awesome App"
          value={config.appName}
          onChange={(e) => setConfig((prev) => ({ ...prev, appName: e.target.value }))}
          className="bg-background border-border"
          maxLength={30}
        />
        <p className="text-xs text-muted-foreground">{config.appName.length}/30 characters</p>
      </div>

      {/* Package Name */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Package size={16} className="text-primary" />
          Package Name
        </label>
        <Input
          type="text"
          placeholder="com.example.myapp"
          value={config.packageName}
          onChange={(e) => setConfig((prev) => ({ ...prev, packageName: e.target.value }))}
          className="bg-background border-border font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">Used as the Android application ID</p>
      </div>

      {/* App Icon */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Smartphone size={16} className="text-primary" />
          App Icon (512×512 PNG)
        </label>
        <div className="flex items-center gap-4">
          <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-border rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => handleFileChange(e, "appIcon")}
              className="hidden"
            />
            {config.appIcon ? (
              <span className="text-sm text-foreground">{config.appIcon.name}</span>
            ) : (
              <span className="text-sm text-muted-foreground">Choose file or drag here</span>
            )}
          </label>
          {config.appIcon && (
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
              <img
                src={URL.createObjectURL(config.appIcon)}
                alt="App Icon Preview"
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      </div>

      {/* Splash Screen */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <ImageIcon size={16} className="text-primary" />
          Splash Screen (optional)
        </label>
        <label className="flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-border rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => handleFileChange(e, "splashScreen")}
            className="hidden"
          />
          {config.splashScreen ? (
            <span className="text-sm text-foreground">{config.splashScreen.name}</span>
          ) : (
            <span className="text-sm text-muted-foreground">Choose file or drag here</span>
          )}
        </label>
      </div>

      {/* Build Progress */}
      {buildStatus === "building" && (
        <div className="space-y-2 p-4 rounded-lg bg-muted/50">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-primary" />
              Generating Android project...
            </span>
            <span className="text-muted-foreground">{Math.round(buildProgress)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${buildProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Success State */}
      {buildStatus === "success" && (
        <div className="space-y-3 p-4 rounded-lg bg-[hsl(var(--success))]/10 border border-[hsl(var(--success))]/30">
          <div className="flex items-center gap-2 text-[hsl(var(--success))]">
            <CheckCircle size={18} />
            <span className="font-medium">Android Project Ready!</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Download the complete Android Studio project. Open it in Android Studio, sync Gradle, and run on your device.
          </p>
          <Button onClick={handleDownload} className="w-full gap-2">
            <Download size={16} />
            Download Android Project (.zip)
          </Button>
        </div>
      )}

      {/* Build Button */}
      {buildStatus !== "success" && (
        <Button
          onClick={handleBuild}
          disabled={!canBuild || buildStatus === "building"}
          className="w-full gap-2"
        >
          {buildStatus === "building" ? (
            <><Loader2 size={16} className="animate-spin" /> Building...</>
          ) : (
            <><Smartphone size={16} /> Generate Android Project</>
          )}
        </Button>
      )}

      {buildStatus === "success" && (
        <Button
          variant="outline"
          onClick={() => { setBuildStatus("idle"); setBuildProgress(0); }}
          className="w-full"
        >
          Build Another App
        </Button>
      )}
    </div>
  );
};

export default UrlConfigForm;

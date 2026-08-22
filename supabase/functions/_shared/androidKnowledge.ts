/**
 * Compact Android / Java / Gradle knowledge pack injected lazily into the
 * Agent's system prompt only when it touches Android files. Keeping it small
 * preserves token budget for actual source reading.
 */

export const ANDROID_KNOWLEDGE = `
## Android / Java / Gradle quick reference

### Manifest
- Permissions go inside <manifest> as <uses-permission android:name="..."/>.
- POST_NOTIFICATIONS required for Android 13+ push.
- READ_MEDIA_IMAGES / VIDEO / AUDIO replace READ_EXTERNAL_STORAGE on SDK 33+.
- Camera/mic must declare <uses-feature android:required="false"/> for Play.
- Deep links: <intent-filter android:autoVerify="true"> with a <data> tag inside the launcher activity.

### Gradle compatibility (must stay in sync)
| AGP    | Gradle | Kotlin     | compileSdk |
|--------|--------|------------|------------|
| 8.7.x  | 8.9    | 1.9.24+    | 35         |
| 8.5.x  | 8.7    | 1.9.20+    | 34         |
| 8.2.x  | 8.2    | 1.9.0+     | 34         |
| 8.1.x  | 8.0    | 1.8.10+    | 33         |

- gradle-wrapper.properties controls Gradle. build.gradle (project) sets AGP. variables.gradle sets sdk levels.
- Plugin order in app/build.gradle: 'com.android.application' before 'org.jetbrains.kotlin.android' before 'kotlin-kapt'.

### targetSdk 35 / Edge-to-edge
- Android 15+ enforces edge-to-edge by default. Apps must call WindowCompat.setDecorFitsSystemWindows(getWindow(), false) after super.onCreate(savedInstanceState) and handle insets.
- NativeBridge uses true native edge-to-edge by patching MainActivity.java directly; do not install @capacitor/edge-to-edge or @capawesome/capacitor-android-edge-to-edge-support for this behavior.
- Status-bar style controlled via WindowInsetsControllerCompat(window, decorView).isAppearanceLightStatusBars.

### MainActivity
- Capacitor extends BridgeActivity (com.getcapacitor.BridgeActivity).
- Java: 'public class MainActivity extends BridgeActivity { }'.
- Kotlin: 'class MainActivity : BridgeActivity()'.
- Plugin registration is automatic from package.json scan; manual registerPlugin() only for non-CapacitorCommunity.

### Signing
- debug.keystore at ~/.android/debug.keystore, alias 'androiddebugkey', password 'android'.
- Release: signingConfigs { release { storeFile file(...) storePassword ... keyAlias ... keyPassword ... } }, then buildTypes.release.signingConfig signingConfigs.release.
- Play App Signing strips your upload key; only the upload SHA-1 needs to match what's registered.

### Common errors
- 'Manifest merger failed' → check duplicate <activity> or conflicting <uses-permission> across plugin manifests; add tools:replace="..." or tools:node="merge".
- 'compileSdk version 35 requires JDK 17' → Set Java toolchain to 17.
- 'Unsupported class file major version' → Java/Gradle/AGP mismatch.
- 'Could not find google-services.json' → drop the file in android/app/.
`.trim();

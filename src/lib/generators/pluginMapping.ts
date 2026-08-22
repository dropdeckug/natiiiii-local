// Maps internal plugin IDs to their npm package names for Capacitor CLI installation

export interface PluginNpmEntry {
  npm: string;
  /** Additional npm packages this plugin requires at runtime (siblings/companions). */
  companionNpms?: string[];
  engines: ("capacitor" | "ionic" | "electron" | "webview" | "twa")[];
  needsSecrets?: boolean;
  secretsDescription?: string;
  needsManualConfig?: boolean;
  manualConfigDescription?: string;
  usagePatterns?: string[];
  description?: string;
  codeSnippet?: string;
  permissions?: string[];
  category?: string;
}

export const PLUGIN_NPM_MAP: Record<string, PluginNpmEntry> = {
  // ── Core Capacitor plugins ──
  app: {
    npm: "@capacitor/app", engines: ["capacitor", "ionic"], category: "Core",
    description: "Manage app lifecycle events like background/foreground and back button.",
    usagePatterns: ["App.addListener", "App.getInfo", "App.exitApp"],
    codeSnippet: `import { App } from '@capacitor/app';\n\nApp.addListener('appStateChange', ({ isActive }) => {\n  console.log('App active:', isActive);\n});`,
  },
  "splash-screen": {
    npm: "@capacitor/splash-screen", engines: ["capacitor", "ionic"], category: "Core",
    description: "Control the native splash screen visibility and duration.",
    usagePatterns: ["SplashScreen.hide", "SplashScreen.show"],
    codeSnippet: `import { SplashScreen } from '@capacitor/splash-screen';\n\nawait SplashScreen.hide();`,
  },
  "status-bar": {
    npm: "@capacitor/status-bar", engines: ["capacitor", "ionic"], category: "Core",
    description: "Control the device status bar style, visibility, and color.",
    usagePatterns: ["StatusBar.setStyle", "StatusBar.setBackgroundColor", "StatusBar.hide"],
    codeSnippet: `import { StatusBar, Style } from '@capacitor/status-bar';\n\nawait StatusBar.setStyle({ style: Style.Dark });`,
  },

  // ── Feature plugins (zero config) ──
  camera: {
    npm: "@capacitor/camera", engines: ["capacitor", "ionic"], category: "Media",
    description: "Take photos, pick images from gallery, and manage camera permissions.",
    usagePatterns: ["Camera.getPhoto", "Camera.requestPermissions", "Camera.pickImages"],
    permissions: ["android.permission.CAMERA", "android.permission.READ_MEDIA_IMAGES"],
    codeSnippet: `import { Camera, CameraResultType } from '@capacitor/camera';\n\nconst photo = await Camera.getPhoto({\n  quality: 90,\n  resultType: CameraResultType.Uri,\n});`,
  },
  geolocation: {
    npm: "@capacitor/geolocation", engines: ["capacitor", "ionic"], category: "Location",
    description: "Get current GPS position or watch location changes.",
    usagePatterns: ["Geolocation.getCurrentPosition", "Geolocation.watchPosition"],
    permissions: ["android.permission.ACCESS_FINE_LOCATION", "android.permission.ACCESS_COARSE_LOCATION"],
    codeSnippet: `import { Geolocation } from '@capacitor/geolocation';\n\nconst pos = await Geolocation.getCurrentPosition();\nconsole.log(pos.coords.latitude, pos.coords.longitude);`,
  },
  "push-notifications": {
    npm: "@capacitor/push-notifications", engines: ["capacitor", "ionic"], category: "Notifications",
    description: "Register for push notifications via Firebase Cloud Messaging.",
    needsSecrets: true, secretsDescription: "Requires google-services.json for Firebase Cloud Messaging",
    needsManualConfig: true, manualConfigDescription: "Needs Firebase Gradle plugin and google-services.json in android/app/",
    usagePatterns: ["PushNotifications.register", "PushNotifications.addListener", "PushNotifications.requestPermissions"],
    permissions: ["android.permission.POST_NOTIFICATIONS", "android.permission.RECEIVE_BOOT_COMPLETED"],
    codeSnippet: `import { PushNotifications } from '@capacitor/push-notifications';\n\nawait PushNotifications.requestPermissions();\nawait PushNotifications.register();\nPushNotifications.addListener('pushNotificationReceived', (notification) => {\n  console.log('Push received:', notification);\n});`,
  },
  filesystem: {
    npm: "@capacitor/filesystem", engines: ["capacitor", "ionic"], category: "Storage",
    description: "Read and write files on the device filesystem.",
    usagePatterns: ["Filesystem.readFile", "Filesystem.writeFile", "Filesystem.readdir"],
    permissions: ["android.permission.READ_EXTERNAL_STORAGE", "android.permission.WRITE_EXTERNAL_STORAGE"],
    codeSnippet: `import { Filesystem, Directory } from '@capacitor/filesystem';\n\nawait Filesystem.writeFile({\n  path: 'data.txt',\n  data: 'Hello World',\n  directory: Directory.Documents,\n});`,
  },
  share: {
    npm: "@capacitor/share", engines: ["capacitor", "ionic"], category: "Social",
    description: "Share content via the native share sheet.",
    usagePatterns: ["Share.share"],
    codeSnippet: `import { Share } from '@capacitor/share';\n\nawait Share.share({\n  title: 'Check this out',\n  text: 'Amazing content',\n  url: 'https://example.com',\n});`,
  },
  haptics: {
    npm: "@capacitor/haptics", engines: ["capacitor", "ionic"], category: "Device",
    description: "Trigger haptic feedback (vibration) on the device.",
    usagePatterns: ["Haptics.vibrate", "Haptics.impact", "Haptics.notification"],
    codeSnippet: `import { Haptics, ImpactStyle } from '@capacitor/haptics';\n\nawait Haptics.impact({ style: ImpactStyle.Medium });`,
  },
  preferences: {
    npm: "@capacitor/preferences", engines: ["capacitor", "ionic"], category: "Storage",
    description: "Simple key-value storage on the device.",
    usagePatterns: ["Preferences.get", "Preferences.set", "Preferences.remove"],
    codeSnippet: `import { Preferences } from '@capacitor/preferences';\n\nawait Preferences.set({ key: 'user', value: JSON.stringify({ name: 'John' }) });\nconst { value } = await Preferences.get({ key: 'user' });`,
  },
  network: {
    npm: "@capacitor/network", engines: ["capacitor", "ionic"], category: "Device",
    description: "Monitor network connectivity status and type.",
    usagePatterns: ["Network.getStatus", "Network.addListener"],
    permissions: ["android.permission.ACCESS_NETWORK_STATE"],
    codeSnippet: `import { Network } from '@capacitor/network';\n\nconst status = await Network.getStatus();\nconsole.log('Connected:', status.connected);`,
  },
  clipboard: {
    npm: "@capacitor/clipboard", engines: ["capacitor", "ionic"], category: "Device",
    description: "Copy and paste text from the system clipboard.",
    usagePatterns: ["Clipboard.write", "Clipboard.read"],
    codeSnippet: `import { Clipboard } from '@capacitor/clipboard';\n\nawait Clipboard.write({ string: 'Hello!' });\nconst { value } = await Clipboard.read();`,
  },
  device: {
    npm: "@capacitor/device", engines: ["capacitor", "ionic"], category: "Device",
    description: "Get device info like model, OS version, battery, and unique ID.",
    usagePatterns: ["Device.getInfo", "Device.getId", "Device.getBatteryInfo"],
    codeSnippet: `import { Device } from '@capacitor/device';\n\nconst info = await Device.getInfo();\nconsole.log(info.model, info.platform, info.operatingSystem);`,
  },
  keyboard: {
    npm: "@capacitor/keyboard", engines: ["capacitor", "ionic"], category: "UI",
    description: "Control and listen to the soft keyboard.",
    usagePatterns: ["Keyboard.show", "Keyboard.hide", "Keyboard.addListener"],
    codeSnippet: `import { Keyboard } from '@capacitor/keyboard';\n\nKeyboard.addListener('keyboardWillShow', (info) => {\n  console.log('Keyboard height:', info.keyboardHeight);\n});`,
  },
  "local-notifications": {
    npm: "@capacitor/local-notifications", engines: ["capacitor", "ionic"], category: "Notifications",
    description: "Schedule and manage local notifications.",
    usagePatterns: ["LocalNotifications.schedule", "LocalNotifications.addListener"],
    codeSnippet: `import { LocalNotifications } from '@capacitor/local-notifications';\n\nawait LocalNotifications.schedule({\n  notifications: [{ title: 'Reminder', body: 'Check your app', id: 1, schedule: { at: new Date(Date.now() + 5000) } }]\n});`,
  },
  browser: {
    npm: "@capacitor/browser", engines: ["capacitor", "ionic"], category: "Navigation",
    description: "Open URLs in an in-app browser (Chrome Custom Tabs / SFSafariViewController).",
    usagePatterns: ["Browser.open", "Browser.close"],
    codeSnippet: `import { Browser } from '@capacitor/browser';\n\nawait Browser.open({ url: 'https://example.com' });`,
  },
  "action-sheet": {
    npm: "@capacitor/action-sheet", engines: ["capacitor", "ionic"], category: "UI",
    description: "Show native action sheets with multiple options.",
    usagePatterns: ["ActionSheet.showActions"],
    codeSnippet: `import { ActionSheet } from '@capacitor/action-sheet';\n\nconst result = await ActionSheet.showActions({\n  title: 'Choose',\n  options: [{ title: 'Share' }, { title: 'Delete', style: 'destructive' }]\n});`,
  },
  "app-launcher": {
    npm: "@capacitor/app-launcher", engines: ["capacitor", "ionic"], category: "Device",
    description: "Check if apps are installed and launch them via URL schemes.",
    usagePatterns: ["AppLauncher.canOpenUrl", "AppLauncher.openUrl"],
    codeSnippet: `import { AppLauncher } from '@capacitor/app-launcher';\n\nconst { value } = await AppLauncher.canOpenUrl({ url: 'com.example.app' });`,
  },
  dialog: {
    npm: "@capacitor/dialog", engines: ["capacitor", "ionic"], category: "UI",
    description: "Show native alert, confirm, and prompt dialogs.",
    usagePatterns: ["Dialog.alert", "Dialog.confirm", "Dialog.prompt"],
    codeSnippet: `import { Dialog } from '@capacitor/dialog';\n\nawait Dialog.alert({ title: 'Hello', message: 'This is a native alert!' });`,
  },
  "google-maps": {
    npm: "@capacitor/google-maps", engines: ["capacitor", "ionic"], category: "Maps",
    description: "Embed Google Maps with native rendering and markers.",
    needsSecrets: true, secretsDescription: "Requires Google Maps API key",
    needsManualConfig: true, manualConfigDescription: "Needs API key as <meta-data> in AndroidManifest.xml",
    usagePatterns: ["GoogleMap.create", "GoogleMap.addMarker"],
    codeSnippet: `import { GoogleMap } from '@capacitor/google-maps';\n\nconst map = await GoogleMap.create({ id: 'map', element: mapRef, apiKey: 'YOUR_KEY', config: { center: { lat: 0, lng: 0 }, zoom: 8 } });`,
  },
  motion: {
    npm: "@capacitor/motion", engines: ["capacitor", "ionic"], category: "Sensors",
    description: "Listen to accelerometer and device orientation events.",
    usagePatterns: ["Motion.addListener"],
    codeSnippet: `import { Motion } from '@capacitor/motion';\n\nMotion.addListener('accel', (event) => {\n  console.log('Acceleration:', event.acceleration);\n});`,
  },
  "screen-orientation": {
    npm: "@capacitor/screen-orientation", engines: ["capacitor", "ionic"], category: "UI",
    description: "Lock or unlock screen orientation.",
    usagePatterns: ["ScreenOrientation.lock", "ScreenOrientation.unlock"],
    codeSnippet: `import { ScreenOrientation } from '@capacitor/screen-orientation';\n\nawait ScreenOrientation.lock({ orientation: 'portrait' });`,
  },
  "screen-reader": {
    npm: "@capacitor/screen-reader", engines: ["capacitor", "ionic"], category: "Accessibility",
    description: "Text-to-speech and screen reader accessibility APIs.",
    usagePatterns: ["ScreenReader.speak", "ScreenReader.isEnabled"],
    codeSnippet: `import { ScreenReader } from '@capacitor/screen-reader';\n\nawait ScreenReader.speak({ value: 'Hello, accessibility!' });`,
  },
  toast: {
    npm: "@capacitor/toast", engines: ["capacitor", "ionic"], category: "UI",
    description: "Show native toast notifications.",
    usagePatterns: ["Toast.show"],
    codeSnippet: `import { Toast } from '@capacitor/toast';\n\nawait Toast.show({ text: 'Saved successfully!', duration: 'short' });`,
  },
  cookies: {
    npm: "@capacitor/cookies", engines: ["capacitor", "ionic"], category: "Storage",
    description: "Manage HTTP cookies on the native HTTP stack.",
    usagePatterns: ["Cookies.getCookies", "Cookies.setCookie", "Cookies.deleteCookie"],
    codeSnippet: `import { Cookies } from '@capacitor/cookies';\n\nawait Cookies.setCookie({ url: 'https://example.com', key: 'token', value: 'abc123' });`,
  },
  "text-zoom": {
    npm: "@capacitor/text-zoom", engines: ["capacitor", "ionic"], category: "Accessibility",
    description: "Get and set the text zoom level of the WebView.",
    usagePatterns: ["TextZoom.get", "TextZoom.set"],
    codeSnippet: `import { TextZoom } from '@capacitor/text-zoom';\n\nawait TextZoom.set({ value: 1.2 });`,
  },

  // ── Capawesome plugins ──
  "capawesome-accelerometer": {
    npm: "@capawesome/capacitor-accelerometer", engines: ["capacitor", "ionic"], category: "Sensors",
    description: "Read raw accelerometer sensor data.",
    usagePatterns: ["Accelerometer.start", "Accelerometer.addListener"],
    codeSnippet: `import { Accelerometer } from '@capawesome/capacitor-accelerometer';\n\nAccelerometer.addListener('accel', (event) => {\n  console.log(event.x, event.y, event.z);\n});`,
  },
  "capawesome-app-review": {
    npm: "@capawesome/capacitor-app-review", engines: ["capacitor", "ionic"], category: "Distribution",
    description: "Prompt users to rate your app in the store.",
    usagePatterns: ["AppReview.requestReview"],
    codeSnippet: `import { AppReview } from '@capawesome/capacitor-app-review';\n\nawait AppReview.requestReview();`,
  },
  "capawesome-app-update": {
    npm: "@capawesome/capacitor-app-update", engines: ["capacitor", "ionic"], category: "Distribution",
    description: "Check for app updates and prompt in-app update flows.",
    usagePatterns: ["AppUpdate.getAppUpdateInfo", "AppUpdate.performImmediateUpdate"],
    codeSnippet: `import { AppUpdate } from '@capawesome/capacitor-app-update';\n\nconst info = await AppUpdate.getAppUpdateInfo();\nif (info.updateAvailability === 2) {\n  await AppUpdate.performImmediateUpdate();\n}`,
  },
  "capawesome-biometrics": {
    npm: "@capawesome/capacitor-biometrics", engines: ["capacitor", "ionic"], category: "Security",
    description: "Biometric authentication (fingerprint, face recognition).",
    usagePatterns: ["Biometrics.authenticate", "Biometrics.isAvailable"],
    codeSnippet: `import { Biometrics } from '@capawesome/capacitor-biometrics';\n\nconst result = await Biometrics.authenticate({ reason: 'Verify identity' });`,
  },
  "capawesome-nfc": {
    npm: "@capawesome/capacitor-nfc", engines: ["capacitor", "ionic"], category: "Hardware",
    description: "Read and write NFC tags.",
    usagePatterns: ["Nfc.startScanSession", "Nfc.addListener"],
    permissions: ["android.permission.NFC"],
    codeSnippet: `import { Nfc } from '@capawesome/capacitor-nfc';\n\nawait Nfc.startScanSession();\nNfc.addListener('nfcTagScanned', (tag) => {\n  console.log('Tag:', tag);\n});`,
  },
  "capawesome-badge": {
    npm: "@capawesome/capacitor-badge", engines: ["capacitor", "ionic"], category: "UI",
    description: "Set app icon badge count.",
    usagePatterns: ["Badge.set", "Badge.get", "Badge.clear"],
    codeSnippet: `import { Badge } from '@capawesome/capacitor-badge';\n\nawait Badge.set({ count: 5 });`,
  },
  "capawesome-cloudinary": {
    npm: "@capawesome/capacitor-cloudinary", engines: ["capacitor", "ionic"], category: "Media",
    description: "Upload images and videos to Cloudinary.",
    needsSecrets: true, secretsDescription: "Requires Cloudinary cloud name and upload preset",
    usagePatterns: ["Cloudinary.uploadResource"],
    codeSnippet: `import { Cloudinary } from '@capawesome/capacitor-cloudinary';\n\nawait Cloudinary.initialize({ cloudName: 'your-cloud' });\nawait Cloudinary.uploadResource({ path: '/path/to/image.jpg' });`,
  },
  "capawesome-contacts": {
    npm: "@capawesome/capacitor-contacts", engines: ["capacitor", "ionic"], category: "Social",
    description: "Access the device contact list.",
    permissions: ["android.permission.READ_CONTACTS"],
    usagePatterns: ["Contacts.getContacts"],
    codeSnippet: `import { Contacts } from '@capawesome/capacitor-contacts';\n\nconst result = await Contacts.getContacts({ projection: { name: true, phones: true } });`,
  },
  "capawesome-file-compressor": {
    npm: "@capawesome/capacitor-file-compressor", engines: ["capacitor", "ionic"], category: "Storage",
    description: "Compress images with configurable quality.",
    usagePatterns: ["FileCompressor.compressImage"],
    codeSnippet: `import { FileCompressor } from '@capawesome/capacitor-file-compressor';\n\nconst result = await FileCompressor.compressImage({ path: '/path/to/image.jpg', quality: 0.6 });`,
  },
  "capawesome-file-opener": {
    npm: "@capawesome/capacitor-file-opener", engines: ["capacitor", "ionic"], category: "Storage",
    description: "Open files with the system default app.",
    usagePatterns: ["FileOpener.openFile"],
    codeSnippet: `import { FileOpener } from '@capawesome/capacitor-file-opener';\n\nawait FileOpener.openFile({ path: '/path/to/document.pdf' });`,
  },
  "capawesome-file-picker": {
    npm: "@capawesome/capacitor-file-picker", engines: ["capacitor", "ionic"], category: "Storage",
    description: "Pick files from the device with native file picker.",
    usagePatterns: ["FilePicker.pickFiles"],
    codeSnippet: `import { FilePicker } from '@capawesome/capacitor-file-picker';\n\nconst result = await FilePicker.pickFiles({ types: ['application/pdf'] });`,
  },
  "capawesome-datetime-picker": {
    npm: "@capawesome/capacitor-datetime-picker", engines: ["capacitor", "ionic"], category: "UI",
    description: "Show a native date/time picker dialog.",
    usagePatterns: ["DatetimePicker.present"],
    codeSnippet: `import { DatetimePicker } from '@capawesome/capacitor-datetime-picker';\n\nconst { value } = await DatetimePicker.present({ mode: 'date' });`,
  },
  "capawesome-geocoder": {
    npm: "@capawesome/capacitor-geocoder", engines: ["capacitor", "ionic"], category: "Location",
    description: "Forward and reverse geocoding.",
    usagePatterns: ["Geocoder.forwardGeocode", "Geocoder.reverseGeocode"],
    codeSnippet: `import { Geocoder } from '@capawesome/capacitor-geocoder';\n\nconst result = await Geocoder.forwardGeocode({ addressString: '1600 Amphitheatre Parkway' });`,
  },
  "capawesome-live-update": {
    npm: "@capawesome/capacitor-live-update", engines: ["capacitor", "ionic"], category: "Distribution",
    description: "Push OTA updates to your app without app store review.",
    needsSecrets: true, secretsDescription: "Requires Capawesome Cloud license key",
    usagePatterns: ["LiveUpdate.sync", "LiveUpdate.ready"],
    codeSnippet: `import { LiveUpdate } from '@capawesome/capacitor-live-update';\n\nawait LiveUpdate.sync();\nawait LiveUpdate.ready();`,
  },
  "capawesome-photo-editor": {
    npm: "@capawesome/capacitor-photo-editor", engines: ["capacitor", "ionic"], category: "Media",
    description: "Edit photos with native editing capabilities.",
    usagePatterns: ["PhotoEditor.editPhoto"],
    codeSnippet: `import { PhotoEditor } from '@capawesome/capacitor-photo-editor';\n\nconst result = await PhotoEditor.editPhoto({ path: '/path/to/photo.jpg' });`,
  },
  "capawesome-printer": {
    npm: "@capawesome/capacitor-printer", engines: ["capacitor", "ionic"], category: "Hardware",
    description: "Print documents and HTML content.",
    usagePatterns: ["Printer.print"],
    codeSnippet: `import { Printer } from '@capawesome/capacitor-printer';\n\nawait Printer.print({ content: '<h1>Hello Printer!</h1>' });`,
  },
  "capawesome-screen-orientation": {
    npm: "@capawesome/capacitor-screen-orientation", engines: ["capacitor", "ionic"], category: "UI",
    description: "Lock or unlock screen orientation (Capawesome version).",
    usagePatterns: ["ScreenOrientation.lock"],
    codeSnippet: `import { ScreenOrientation } from '@capawesome/capacitor-screen-orientation';\n\nawait ScreenOrientation.lock({ type: 'portrait' });`,
  },
  "capawesome-screenshot": {
    npm: "@capawesome/capacitor-screenshot", engines: ["capacitor", "ionic"], category: "Media",
    description: "Capture screenshots of the current screen.",
    usagePatterns: ["Screenshot.take"],
    codeSnippet: `import { Screenshot } from '@capawesome/capacitor-screenshot';\n\nconst { base64 } = await Screenshot.take();`,
  },
  "capawesome-secure-preferences": {
    npm: "@capawesome/capacitor-secure-preferences", engines: ["capacitor", "ionic"], category: "Security",
    description: "Encrypted key-value storage using Keystore/Keychain.",
    usagePatterns: ["SecurePreferences.set", "SecurePreferences.get"],
    codeSnippet: `import { SecurePreferences } from '@capawesome/capacitor-secure-preferences';\n\nawait SecurePreferences.set({ key: 'token', value: 'secret123' });`,
  },
  "capawesome-speech-recognition": {
    npm: "@capawesome/capacitor-speech-recognition", engines: ["capacitor", "ionic"], category: "AI",
    description: "Convert speech to text using native speech recognition.",
    permissions: ["android.permission.RECORD_AUDIO"],
    usagePatterns: ["SpeechRecognition.start"],
    codeSnippet: `import { SpeechRecognition } from '@capawesome/capacitor-speech-recognition';\n\nconst { results } = await SpeechRecognition.start({ language: 'en-US' });`,
  },
  "capawesome-speech-synthesis": {
    npm: "@capawesome/capacitor-speech-synthesis", engines: ["capacitor", "ionic"], category: "AI",
    description: "Text-to-speech using native TTS engine.",
    usagePatterns: ["SpeechSynthesis.speak"],
    codeSnippet: `import { SpeechSynthesis } from '@capawesome/capacitor-speech-synthesis';\n\nawait SpeechSynthesis.speak({ text: 'Hello world', language: 'en-US' });`,
  },
  "capawesome-sqlite": {
    npm: "@capawesome/capacitor-sqlite", engines: ["capacitor", "ionic"], category: "Storage",
    description: "Full SQLite database support on device.",
    usagePatterns: ["SQLite.open", "SQLite.execute"],
    codeSnippet: `import { SQLite } from '@capawesome/capacitor-sqlite';\n\nconst db = await SQLite.open({ name: 'mydb' });\nawait SQLite.execute({ database: 'mydb', statements: 'CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)' });`,
  },
  "capawesome-torch": {
    npm: "@capawesome/capacitor-torch", engines: ["capacitor", "ionic"], category: "Hardware",
    description: "Control the device flashlight/torch.",
    usagePatterns: ["Torch.enable", "Torch.disable"],
    permissions: ["android.permission.CAMERA"],
    codeSnippet: `import { Torch } from '@capawesome/capacitor-torch';\n\nawait Torch.enable();`,
  },
  "capawesome-wifi": {
    npm: "@capawesome/capacitor-wifi", engines: ["capacitor", "ionic"], category: "Hardware",
    description: "Get WiFi info and scan for nearby networks.",
    permissions: ["android.permission.ACCESS_WIFI_STATE", "android.permission.ACCESS_FINE_LOCATION"],
    usagePatterns: ["Wifi.getNetwork", "Wifi.scan"],
    codeSnippet: `import { Wifi } from '@capawesome/capacitor-wifi';\n\nconst network = await Wifi.getNetwork();`,
  },
  "capawesome-zip": {
    npm: "@capawesome/capacitor-zip", engines: ["capacitor", "ionic"], category: "Storage",
    description: "Zip and unzip files on the device.",
    usagePatterns: ["Zip.zip", "Zip.unzip"],
    codeSnippet: `import { Zip } from '@capawesome/capacitor-zip';\n\nawait Zip.unzip({ source: '/path/to/file.zip', destination: '/path/to/output' });`,
  },
  "capawesome-foreground-service": {
    npm: "@capawesome/capacitor-android-foreground-service", engines: ["capacitor", "ionic"], category: "Background",
    description: "Run a persistent foreground service on Android.",
    permissions: ["android.permission.FOREGROUND_SERVICE"],
    usagePatterns: ["ForegroundService.startForegroundService"],
    codeSnippet: `import { ForegroundService } from '@capawesome/capacitor-android-foreground-service';\n\nawait ForegroundService.startForegroundService({ body: 'Running...', title: 'Service Active', id: 1 });`,
  },
  "capawesome-background-task": {
    npm: "@capawesome/capacitor-background-task", engines: ["capacitor", "ionic"], category: "Background",
    description: "Run short background tasks when the app is backgrounded.",
    usagePatterns: ["BackgroundTask.beforeExit"],
    codeSnippet: `import { BackgroundTask } from '@capawesome/capacitor-background-task';\n\nApp.addListener('appStateChange', ({ isActive }) => {\n  if (!isActive) {\n    const taskId = BackgroundTask.beforeExit(async () => {\n      // cleanup work\n      BackgroundTask.finish({ taskId });\n    });\n  }\n});`,
  },
  "capawesome-audio-player": {
    npm: "@capawesome/capacitor-audio-player", engines: ["capacitor", "ionic"], category: "Media",
    description: "Play audio files with native audio player.",
    usagePatterns: ["AudioPlayer.play", "AudioPlayer.pause"],
    codeSnippet: `import { AudioPlayer } from '@capawesome/capacitor-audio-player';\n\nawait AudioPlayer.play({ source: '/path/to/audio.mp3' });`,
  },
  "capawesome-audio-recorder": {
    npm: "@capawesome/capacitor-audio-recorder", engines: ["capacitor", "ionic"], category: "Media",
    description: "Record audio using the device microphone.",
    permissions: ["android.permission.RECORD_AUDIO"],
    usagePatterns: ["AudioRecorder.start", "AudioRecorder.stop"],
    codeSnippet: `import { AudioRecorder } from '@capawesome/capacitor-audio-recorder';\n\nawait AudioRecorder.start();\nconst { path } = await AudioRecorder.stop();`,
  },
  "capawesome-barometer": {
    npm: "@capawesome/capacitor-barometer", engines: ["capacitor", "ionic"], category: "Sensors",
    description: "Read barometric pressure sensor data.",
    usagePatterns: ["Barometer.start"],
    codeSnippet: `import { Barometer } from '@capawesome/capacitor-barometer';\n\nBarometer.addListener('barometerData', (data) => {\n  console.log('Pressure:', data.pressure);\n});`,
  },
  "capawesome-pedometer": {
    npm: "@capawesome/capacitor-pedometer", engines: ["capacitor", "ionic"], category: "Sensors",
    description: "Count steps using device sensors.",
    permissions: ["android.permission.ACTIVITY_RECOGNITION"],
    usagePatterns: ["Pedometer.start"],
    codeSnippet: `import { Pedometer } from '@capawesome/capacitor-pedometer';\n\nPedometer.addListener('stepCount', (data) => {\n  console.log('Steps:', data.steps);\n});`,
  },
  "capawesome-media-session": {
    npm: "@capawesome/capacitor-media-session", engines: ["capacitor", "ionic"], category: "Media",
    description: "Control media session for lock screen and notification controls.",
    usagePatterns: ["MediaSession.setMetadata", "MediaSession.setPlaybackState"],
    codeSnippet: `import { MediaSession } from '@capawesome/capacitor-media-session';\n\nawait MediaSession.setMetadata({ title: 'My Song', artist: 'Artist' });`,
  },
  "capawesome-purchases": {
    npm: "@capawesome/capacitor-purchases", engines: ["capacitor", "ionic"], category: "Payments",
    description: "In-app purchases and subscriptions.",
    needsSecrets: true, secretsDescription: "Requires license key for in-app billing",
    usagePatterns: ["Purchases.getProducts", "Purchases.purchase"],
    codeSnippet: `import { Purchases } from '@capawesome/capacitor-purchases';\n\nconst products = await Purchases.getProducts({ productIdentifiers: ['premium'] });\nawait Purchases.purchase({ productIdentifier: 'premium' });`,
  },
  "capawesome-posthog": {
    npm: "@capawesome/capacitor-posthog", engines: ["capacitor", "ionic"], category: "Analytics",
    description: "PostHog analytics integration.",
    needsSecrets: true, secretsDescription: "Requires PostHog API key",
    usagePatterns: ["PostHog.capture"],
    codeSnippet: `import { PostHog } from '@capawesome/capacitor-posthog';\n\nawait PostHog.setup({ apiKey: 'YOUR_KEY' });\nawait PostHog.capture({ event: 'button_clicked' });`,
  },

  // ── Firebase plugins ──
  "capawesome-firebase-analytics": {
    npm: "@capawesome/capacitor-firebase-analytics", engines: ["capacitor", "ionic"], category: "Firebase",
    description: "Firebase Analytics event tracking.",
    needsSecrets: true, secretsDescription: "Requires google-services.json",
    needsManualConfig: true, manualConfigDescription: "Needs google-services.json and Firebase Gradle plugin",
    usagePatterns: ["FirebaseAnalytics.logEvent"],
    codeSnippet: `import { FirebaseAnalytics } from '@capawesome/capacitor-firebase-analytics';\n\nawait FirebaseAnalytics.logEvent({ name: 'screen_view', params: { screen: 'home' } });`,
  },
  "capawesome-firebase-auth": {
    npm: "@capawesome/capacitor-firebase-authentication", engines: ["capacitor", "ionic"], category: "Firebase",
    description: "Firebase Authentication with multiple sign-in providers.",
    needsSecrets: true, secretsDescription: "Requires google-services.json and Firebase config",
    needsManualConfig: true, manualConfigDescription: "Needs Firebase SDK setup and google-services.json",
    usagePatterns: ["FirebaseAuthentication.signInWithGoogle", "FirebaseAuthentication.signInWithEmailAndPassword"],
    codeSnippet: `import { FirebaseAuthentication } from '@capawesome/capacitor-firebase-authentication';\n\nconst result = await FirebaseAuthentication.signInWithGoogle();`,
  },
  "capawesome-firebase-crashlytics": {
    npm: "@capawesome/capacitor-firebase-crashlytics", engines: ["capacitor", "ionic"], category: "Firebase",
    description: "Firebase Crashlytics for crash reporting.",
    needsSecrets: true, secretsDescription: "Requires google-services.json",
    usagePatterns: ["FirebaseCrashlytics.crash", "FirebaseCrashlytics.log"],
    codeSnippet: `import { FirebaseCrashlytics } from '@capawesome/capacitor-firebase-crashlytics';\n\nawait FirebaseCrashlytics.log({ message: 'User action logged' });`,
  },
  "capawesome-firebase-messaging": {
    npm: "@capawesome/capacitor-firebase-cloud-messaging", engines: ["capacitor", "ionic"], category: "Firebase",
    description: "Firebase Cloud Messaging push notifications.",
    needsSecrets: true, secretsDescription: "Requires google-services.json",
    needsManualConfig: true, manualConfigDescription: "Needs Firebase Gradle plugin and google-services.json",
    permissions: ["android.permission.POST_NOTIFICATIONS"],
    usagePatterns: ["FirebaseMessaging.getToken", "FirebaseMessaging.addListener"],
    codeSnippet: `import { FirebaseMessaging } from '@capawesome/capacitor-firebase-cloud-messaging';\n\nconst { token } = await FirebaseMessaging.getToken();\nconsole.log('FCM Token:', token);`,
  },
  "capawesome-firebase-remote-config": {
    npm: "@capawesome/capacitor-firebase-remote-config", engines: ["capacitor", "ionic"], category: "Firebase",
    description: "Firebase Remote Config for feature flags.",
    needsSecrets: true, secretsDescription: "Requires google-services.json",
    usagePatterns: ["FirebaseRemoteConfig.fetchAndActivate", "FirebaseRemoteConfig.getString"],
    codeSnippet: `import { FirebaseRemoteConfig } from '@capawesome/capacitor-firebase-remote-config';\n\nawait FirebaseRemoteConfig.fetchAndActivate();\nconst { value } = await FirebaseRemoteConfig.getString({ key: 'welcome_message' });`,
  },
  "capawesome-firebase-performance": {
    npm: "@capawesome/capacitor-firebase-performance-monitoring", engines: ["capacitor", "ionic"], category: "Firebase",
    description: "Firebase Performance Monitoring for app metrics.",
    needsSecrets: true, secretsDescription: "Requires google-services.json",
    usagePatterns: ["FirebasePerformance.startTrace"],
    codeSnippet: `import { FirebasePerformance } from '@capawesome/capacitor-firebase-performance-monitoring';\n\nawait FirebasePerformance.startTrace({ traceName: 'load_data' });`,
  },

  // ── ML Kit plugins ──
  "capawesome-mlkit-barcode": {
    npm: "@capawesome/capacitor-mlkit-barcode-scanning", engines: ["capacitor", "ionic"], category: "ML Kit",
    description: "Scan barcodes and QR codes using ML Kit.",
    permissions: ["android.permission.CAMERA"],
    usagePatterns: ["BarcodeScanner.scan", "BarcodeScanner.startScan"],
    codeSnippet: `import { BarcodeScanner } from '@capawesome/capacitor-mlkit-barcode-scanning';\n\nconst { barcodes } = await BarcodeScanner.scan();`,
  },
  "capawesome-mlkit-face-detection": {
    npm: "@capawesome/capacitor-mlkit-face-detection", engines: ["capacitor", "ionic"], category: "ML Kit",
    description: "Detect faces in images using ML Kit.",
    permissions: ["android.permission.CAMERA"],
    usagePatterns: ["FaceDetection.processImage"],
    codeSnippet: `import { FaceDetection } from '@capawesome/capacitor-mlkit-face-detection';\n\nconst { faces } = await FaceDetection.processImage({ path: '/path/to/image.jpg' });`,
  },
  "capawesome-mlkit-translation": {
    npm: "@capawesome/capacitor-mlkit-translation", engines: ["capacitor", "ionic"], category: "ML Kit",
    description: "Translate text between languages using on-device ML.",
    usagePatterns: ["Translation.translate"],
    codeSnippet: `import { Translation } from '@capawesome/capacitor-mlkit-translation';\n\nconst { text } = await Translation.translate({ text: 'Hello', sourceLanguage: 'en', targetLanguage: 'es' });`,
  },
  "capawesome-mlkit-document-scanner": {
    npm: "@capawesome/capacitor-mlkit-document-scanner", engines: ["capacitor", "ionic"], category: "ML Kit",
    description: "Scan documents with edge detection and perspective correction.",
    permissions: ["android.permission.CAMERA"],
    usagePatterns: ["DocumentScanner.scanDocument"],
    codeSnippet: `import { DocumentScanner } from '@capawesome/capacitor-mlkit-document-scanner';\n\nconst { pages } = await DocumentScanner.scanDocument();`,
  },
  "capawesome-mlkit-selfie-segmentation": {
    npm: "@capawesome/capacitor-mlkit-selfie-segmentation", engines: ["capacitor", "ionic"], category: "ML Kit",
    description: "Separate people from backgrounds in images.",
    permissions: ["android.permission.CAMERA"],
    usagePatterns: ["SelfieSegmentation.processImage"],
    codeSnippet: `import { SelfieSegmentation } from '@capawesome/capacitor-mlkit-selfie-segmentation';\n\nconst result = await SelfieSegmentation.processImage({ path: '/path/to/selfie.jpg' });`,
  },

  // ── Community / Third-party ──
  "bluetooth-le": {
    npm: "@capacitor-community/bluetooth-le", engines: ["capacitor", "ionic"], category: "Hardware",
    description: "Communicate with Bluetooth Low Energy devices.",
    permissions: ["android.permission.BLUETOOTH", "android.permission.BLUETOOTH_ADMIN", "android.permission.BLUETOOTH_CONNECT", "android.permission.BLUETOOTH_SCAN"],
    usagePatterns: ["BleClient.initialize", "BleClient.scan", "BleClient.connect"],
    codeSnippet: `import { BleClient } from '@capacitor-community/bluetooth-le';\n\nawait BleClient.initialize();\nawait BleClient.requestDevice({ services: ['your-service-uuid'] });`,
  },
  microphone: {
    npm: "@mozartec/capacitor-microphone", engines: ["capacitor", "ionic"], category: "Media",
    description: "Record audio from the device microphone.",
    permissions: ["android.permission.RECORD_AUDIO"],
    usagePatterns: ["Microphone.start", "Microphone.stop"],
    codeSnippet: `import { Microphone } from '@mozartec/capacitor-microphone';\n\nawait Microphone.start();\nconst { base64 } = await Microphone.stop();`,
  },
  "google-auth": {
    npm: "@capawesome/capacitor-google-sign-in", engines: ["capacitor", "ionic"], category: "Auth",
    description: "Sign in with Google using the modern, maintained Capawesome plugin (Credential Manager on Android, native iOS).",
    needsSecrets: true, secretsDescription: "Requires a Web OAuth Client ID (used as serverClientId on Android & iOS).",
    needsManualConfig: true, manualConfigDescription: "Android: add SHA-1 fingerprint to your Google OAuth client. iOS: add GIDClientID + reversed-client-id URL scheme to Info.plist.",
    usagePatterns: ["GoogleSignIn.initialize", "GoogleSignIn.signIn", "GoogleSignIn.signOut"],
    codeSnippet: `import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';\n\nawait GoogleSignIn.initialize({ clientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID });\nconst result = await GoogleSignIn.signIn();`,
  },
  "apple-sign-in": {
    npm: "@capawesome/capacitor-apple-sign-in", engines: ["capacitor", "ionic"], category: "Auth",
    description: "Sign in with Apple via the maintained Capawesome plugin (iOS, Android, Web).",
    needsSecrets: true, secretsDescription: "Requires an Apple Services ID (for Web/Android) configured in Apple Developer.",
    needsManualConfig: true, manualConfigDescription: "Enable 'Sign In with Apple' capability in Xcode entitlements. For Web/Android also configure Services ID + redirect URI in Apple Developer.",
    usagePatterns: ["AppleSignIn.authorize"],
    codeSnippet: `import { AppleSignIn } from '@capawesome/capacitor-apple-sign-in';\n\nconst result = await AppleSignIn.authorize({\n  clientId: import.meta.env.VITE_APPLE_SERVICE_ID,\n  redirectURI: 'https://your-app.com/auth/apple/callback',\n  scopes: 'email name',\n});`,
  },
  "facebook-login": {
    npm: "@capawesome/capacitor-facebook-login", engines: ["capacitor", "ionic"], category: "Auth",
    description: "Login with Facebook via the maintained Capawesome plugin.",
    needsSecrets: true, secretsDescription: "Requires Facebook App ID and Client Token",
    needsManualConfig: true, manualConfigDescription: "Needs App ID in AndroidManifest.xml and strings.xml",
    usagePatterns: ["FacebookLogin.login", "FacebookLogin.getCurrentAccessToken"],
    codeSnippet: `import { FacebookLogin } from '@capawesome/capacitor-facebook-login';\n\nconst result = await FacebookLogin.login({ permissions: ['public_profile', 'email'] });`,
  },
  sms: {
    npm: "@byteowls/capacitor-sms", engines: ["capacitor", "ionic"], category: "Communication",
    description: "Send SMS messages programmatically.",
    permissions: ["android.permission.SEND_SMS"],
    usagePatterns: ["Sms.send"],
    codeSnippet: `import { Sms } from '@byteowls/capacitor-sms';\n\nawait Sms.send({ numbers: ['+1234567890'], text: 'Hello!' });`,
  },
  "capawesome-google-sign-in": {
    npm: "@capawesome/capacitor-google-sign-in", engines: ["capacitor", "ionic"], category: "Auth",
    description: "Modern Google Sign-In for Android (Credential Manager), iOS, and Web. Recommended for new apps.",
    needsSecrets: true,
    secretsDescription: "Requires a Web OAuth Client ID (used as serverClientId on Android & iOS). Optional iOS Client ID for native iOS sign-in. See capawesome.io/blog/how-to-sign-in-with-google-using-capacitor.",
    needsManualConfig: true,
    manualConfigDescription: "Android: add SHA-1 fingerprint to your Android OAuth client. iOS: add GIDClientID + reversed-client-id URL scheme to Info.plist (handled automatically when iOS Client ID is provided).",
    usagePatterns: ["GoogleSignIn.initialize", "GoogleSignIn.signIn", "GoogleSignIn.handleRedirectCallback", "GoogleSignIn.signOut"],
    codeSnippet: `import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';\n\nawait GoogleSignIn.initialize({\n  clientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID,\n});\n\nconst result = await GoogleSignIn.signIn();\nconsole.log('ID token:', result.idToken);\nconsole.log('Email:', result.email);`,
  },
  "capawesome-apple-sign-in": {
    npm: "@capawesome/capacitor-apple-sign-in", engines: ["capacitor", "ionic"], category: "Auth",
    description: "Sign in with Apple via Capawesome — supports iOS, Android, and Web.",
    needsSecrets: true,
    secretsDescription: "Requires an Apple Services ID (for Web/Android) configured in Apple Developer.",
    needsManualConfig: true,
    manualConfigDescription: "Enable 'Sign In with Apple' capability in Xcode. For Web/Android also configure Services ID + redirect URI in Apple Developer Console.",
    usagePatterns: ["AppleSignIn.authorize"],
    codeSnippet: `import { AppleSignIn } from '@capawesome/capacitor-apple-sign-in';\n\nconst result = await AppleSignIn.authorize({\n  clientId: import.meta.env.VITE_APPLE_SERVICE_ID,\n  redirectURI: 'https://your-app.com/auth/apple/callback',\n  scopes: 'email name',\n});`,
  },
  "capawesome-firebase-authentication": {
    npm: "@capawesome-team/capacitor-firebase-authentication", engines: ["capacitor", "ionic"], category: "Auth",
    description: "Firebase Authentication wrapper supporting Google, Apple, Facebook, GitHub, Microsoft, phone, and email/password sign-in.",
    needsSecrets: true,
    secretsDescription: "Requires google-services.json (Android) and GoogleService-Info.plist (iOS). For Google sign-in also needs a Web OAuth Client ID.",
    needsManualConfig: true,
    manualConfigDescription: "Place google-services.json in android/app/ and GoogleService-Info.plist in ios/App/App/. Configure providers in Firebase Console.",
    usagePatterns: ["FirebaseAuthentication.signInWithGoogle", "FirebaseAuthentication.signInWithApple", "FirebaseAuthentication.signInWithEmailAndPassword"],
    codeSnippet: `import { FirebaseAuthentication } from '@capawesome-team/capacitor-firebase-authentication';\n\nconst result = await FirebaseAuthentication.signInWithGoogle();\nconsole.log('User:', result.user);`,
  },
  "capawesome-oauth": {
    npm: "@capawesome/capacitor-oauth", engines: ["capacitor", "ionic"], category: "Auth",
    description: "Generic OAuth 2.0 / OpenID Connect — works with any provider (Auth0, Okta, Microsoft, etc.).",
    needsSecrets: true,
    secretsDescription: "Requires the OAuth client ID and authorization base URL of your provider.",
    needsManualConfig: true,
    manualConfigDescription: "Register your custom URL scheme as a redirect URI with your OAuth provider, and add it to Info.plist (iOS) and AndroidManifest.xml.",
    usagePatterns: ["OAuth.authenticate"],
    codeSnippet: `import { OAuth } from '@capawesome/capacitor-oauth';\n\nconst result = await OAuth.authenticate({\n  appId: import.meta.env.VITE_OAUTH_CLIENT_ID,\n  authorizationBaseUrl: 'https://your-provider.com/oauth/authorize',\n  responseType: 'code',\n  redirectUrl: 'com.yourapp://oauth/callback',\n});`,
  },
  "capawesome-share-target": {
    npm: "@capawesome/capacitor-share-target", engines: ["capacitor", "ionic"], category: "Social",
    description: "Receive shared content from other apps.",
    usagePatterns: ["ShareTarget.addListener"],
    codeSnippet: `import { ShareTarget } from '@capawesome/capacitor-share-target';\n\nShareTarget.addListener('shareTargetReceived', (data) => {\n  console.log('Shared data:', data);\n});`,
  },
  // Edge-to-Edge is implemented as true native wiring in NativeBridge:
  // we install StatusBar for runtime icon contrast, then patch MainActivity.java
  // directly with WindowCompat.setDecorFitsSystemWindows(getWindow(), false).
  "edge-to-edge": {
    npm: "@capacitor/status-bar",
    engines: ["capacitor", "ionic"],
    category: "UI",
    description: "NativeForge Display Mode — five modes (Classic, Themed, Edge to edge, Glassmorphism, Per-page) with all four Android resource folders, safe-area CSS and runtime colour matching.",
    usagePatterns: ["WindowCompat.setDecorFitsSystemWindows", "StatusBar.setOverlaysWebView"],
    codeSnippet: `// Auto-wired by NativeBridge.
// Native side: MainActivity.java calls WindowCompat.setDecorFitsSystemWindows(getWindow(), false)
// after super.onCreate(savedInstanceState).`,
  },
};

// Legacy aliases
PLUGIN_NPM_MAP["geo"] = PLUGIN_NPM_MAP["geolocation"];
PLUGIN_NPM_MAP["push"] = PLUGIN_NPM_MAP["push-notifications"];
PLUGIN_NPM_MAP["files"] = PLUGIN_NPM_MAP["filesystem"];
PLUGIN_NPM_MAP["storage"] = PLUGIN_NPM_MAP["preferences"];
PLUGIN_NPM_MAP["splash"] = PLUGIN_NPM_MAP["splash-screen"];
PLUGIN_NPM_MAP["statusbar"] = PLUGIN_NPM_MAP["status-bar"];
PLUGIN_NPM_MAP["local-notif"] = PLUGIN_NPM_MAP["local-notifications"];
PLUGIN_NPM_MAP["in-app-browser"] = PLUGIN_NPM_MAP["browser"];
PLUGIN_NPM_MAP["biometrics"] = PLUGIN_NPM_MAP["capawesome-biometrics"];
PLUGIN_NPM_MAP["biometric-auth"] = PLUGIN_NPM_MAP["capawesome-biometrics"];
PLUGIN_NPM_MAP["barcode"] = PLUGIN_NPM_MAP["capawesome-mlkit-barcode"];
PLUGIN_NPM_MAP["barcode-scanning"] = PLUGIN_NPM_MAP["capawesome-mlkit-barcode"];
PLUGIN_NPM_MAP["sign-in-with-apple"] = PLUGIN_NPM_MAP["apple-sign-in"];
PLUGIN_NPM_MAP["google-sign-in"] = PLUGIN_NPM_MAP["capawesome-google-sign-in"];
PLUGIN_NPM_MAP["codetrix-google-auth"] = PLUGIN_NPM_MAP["google-auth"];
PLUGIN_NPM_MAP["@codetrix-studio/capacitor-google-auth"] = PLUGIN_NPM_MAP["google-auth"];
PLUGIN_NPM_MAP["capawesome-firebase-auth"] = PLUGIN_NPM_MAP["capawesome-firebase-authentication"];
PLUGIN_NPM_MAP["firebase-auth"] = PLUGIN_NPM_MAP["capawesome-firebase-authentication"];
PLUGIN_NPM_MAP["oauth"] = PLUGIN_NPM_MAP["capawesome-oauth"];
PLUGIN_NPM_MAP["bluetooth"] = PLUGIN_NPM_MAP["bluetooth-le"];
PLUGIN_NPM_MAP["iap"] = PLUGIN_NPM_MAP["capawesome-purchases"];
PLUGIN_NPM_MAP["purchases"] = PLUGIN_NPM_MAP["capawesome-purchases"];
PLUGIN_NPM_MAP["privacy-screen"] = { npm: "@nicasource/capacitor-privacy-screen", engines: ["capacitor", "ionic"], category: "Security", usagePatterns: ["PrivacyScreen.enable"] };
PLUGIN_NPM_MAP["background-runner"] = { npm: "@nicasource/capacitor-background-runner", engines: ["capacitor", "ionic"], category: "Background", usagePatterns: ["BackgroundRunner.dispatchEvent"] };

export const getPluginNpmPackages = (enabledPluginIds: string[], engine?: string): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of enabledPluginIds) {
    const entry = PLUGIN_NPM_MAP[id];
    if (!entry) continue;
    if (engine && !entry.engines.includes(engine as any)) continue;
    for (const pkg of [entry.npm, ...(entry.companionNpms ?? [])]) {
      if (seen.has(pkg)) continue;
      seen.add(pkg);
      out.push(pkg);
    }
  }
  return out;
};

export const getPluginsNeedingConfig = (enabledPluginIds: string[]): { id: string; npm: string; secretsDescription?: string; manualConfigDescription?: string }[] => {
  const results: { id: string; npm: string; secretsDescription?: string; manualConfigDescription?: string }[] = [];
  const seen = new Set<string>();
  for (const id of enabledPluginIds) {
    const entry = PLUGIN_NPM_MAP[id];
    if (!entry || seen.has(entry.npm)) continue;
    seen.add(entry.npm);
    if (entry.needsSecrets || entry.needsManualConfig) {
      results.push({ id, npm: entry.npm, secretsDescription: entry.secretsDescription, manualConfigDescription: entry.manualConfigDescription });
    }
  }
  return results;
};

export const detectUnusedPlugins = (
  enabledPluginIds: string[],
  sourceContents: string[]
): { pluginId: string; npm: string }[] => {
  const allContent = sourceContents.join("\n");
  const unused: { pluginId: string; npm: string }[] = [];
  const checked = new Set<string>();
  for (const id of enabledPluginIds) {
    const entry = PLUGIN_NPM_MAP[id];
    if (!entry || checked.has(entry.npm)) continue;
    checked.add(entry.npm);
    if (!entry.usagePatterns || entry.usagePatterns.length === 0) continue;
    const isUsed = entry.usagePatterns.some(pattern => allContent.includes(pattern));
    if (!isUsed) unused.push({ pluginId: id, npm: entry.npm });
  }
  return unused;
};

/** Get all unique categories from the plugin registry */
export const getPluginCategories = (): string[] => {
  const cats = new Set<string>();
  const seen = new Set<string>();
  for (const entry of Object.values(PLUGIN_NPM_MAP)) {
    if (seen.has(entry.npm)) continue;
    seen.add(entry.npm);
    if (entry.category) cats.add(entry.category);
  }
  return Array.from(cats).sort();
};

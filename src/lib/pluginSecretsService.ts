/**
 * Service for managing plugin secrets in Supabase.
 * Handles CRUD operations for plugin credentials (API keys, config files).
 */

import { supabase } from "@/integrations/supabase/client";

export interface PluginSecret {
  id: string;
  plugin_id: string;
  secret_key: string;
  secret_value: string | null;
  file_path: string | null;
  created_at: string;
}

/** Required secrets definition per plugin */
export interface PluginSecretRequirement {
  pluginId: string;
  pluginName: string;
  secrets: {
    key: string;
    label: string;
    type: "text" | "file";
    placeholder?: string;
    description?: string;
    required?: boolean;
  }[];
  quickTips?: string[];
}

/** Define which plugins need what secrets */
export const PLUGIN_SECRET_REQUIREMENTS: PluginSecretRequirement[] = [
  {
    pluginId: "google-auth",
    pluginName: "Google Sign-In",
    secrets: [
      { key: "GOOGLE_CLIENT_ID", label: "Google OAuth Client ID (Web)", type: "text", placeholder: "xxxx.apps.googleusercontent.com", description: "The only value NativeBridge needs. Google Cloud Console → Credentials → OAuth 2.0 Client ID (Web application). It is wired as serverClientId on Android and iOS.", required: true },
      { key: "google-services.json", label: "google-services.json (optional)", type: "file", description: "Only required if you also use Firebase services.", required: false },
    ],
    quickTips: [
      "Create a 'Web application' OAuth 2.0 Client ID in Google Cloud Console — that is the client ID to paste here",
      "Also create an 'Android' OAuth client with your package name + SHA-1 (from the Signing page) so Google authorises the app",
      "NativeBridge installs @capacitor/browser and @capacitor/app automatically — the sign-in sheet and the redirect back both need them",
      "If using Supabase Auth: pass the returned idToken to supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })",
    ],
  },
  {
    pluginId: "capawesome-google-sign-in",
    pluginName: "Google Sign-In (Capawesome)",
    secrets: [
      { key: "GOOGLE_CLIENT_ID", label: "Google OAuth Client ID (Web)", type: "text", placeholder: "xxxx.apps.googleusercontent.com", description: "The only required credential. Used as serverClientId on Android and iOS. From Google Cloud Console → Credentials → OAuth 2.0 Client ID (Web application).", required: true },
      { key: "google-services.json", label: "google-services.json (optional)", type: "file", description: "Only required when you also use Firebase.", required: false },
    ],
    quickTips: [
      "Docs: https://capawesome.io/docs/sdks/capacitor/google-sign-in/",
      "Add your SHA-1 fingerprint from the Signing page to the Android OAuth client",
      "@capacitor/browser + @capacitor/app are installed automatically as required companions",
    ],
  },
  {
    pluginId: "edge-to-edge",
    pluginName: "Edge-to-Edge Display",
    secrets: [
      { key: "EDGE_TO_EDGE_MODE", label: "Display mode", type: "text", description: "Chosen in the Edge-to-Edge mode picker.", required: false },
    ],
  },
  {
    pluginId: "capawesome-oauth",
    pluginName: "OAuth 2.0 / OpenID Connect",
    secrets: [
      { key: "OAUTH_ENABLED_PROVIDERS", label: "Enabled providers", type: "text", description: "Chosen in the provider picker.", required: false },
    ],
    quickTips: [
      "Docs: https://capawesome.io/docs/sdks/capacitor/oauth/",
      "Every provider opens an in-app browser, so @capacitor/browser and @capacitor/app are installed automatically",
      "The redirect URL must use a custom scheme registered in your app, e.g. com.yourapp://oauth/callback",
    ],
  },


  {
    pluginId: "push-notifications",
    pluginName: "Push Notifications",
    secrets: [
      { key: "google-services.json", label: "google-services.json", type: "file", description: "Download from Firebase Console → Project Settings → Your Apps → Android", required: true },
    ],
    quickTips: [
      "Enable Cloud Messaging in Firebase Console → Project Settings → Cloud Messaging",
      "Make sure your package name matches the one registered in Firebase",
    ],
  },
  {
    pluginId: "push",
    pluginName: "Push Notifications",
    secrets: [
      { key: "google-services.json", label: "google-services.json", type: "file", description: "Download from Firebase Console → Project Settings", required: true },
    ],
  },
  {
    pluginId: "google-maps",
    pluginName: "Google Maps",
    secrets: [
      { key: "GOOGLE_MAPS_KEY", label: "Google Maps API Key", type: "text", placeholder: "AIza...", description: "From Google Cloud Console → APIs & Services → Credentials", required: true },
    ],
    quickTips: [
      "Enable 'Maps SDK for Android' in Google Cloud Console → APIs & Services → Library",
      "Restrict the API key to your Android app's package name and SHA-1 fingerprint",
    ],
  },
  {
    pluginId: "facebook-login",
    pluginName: "Facebook Login",
    secrets: [
      { key: "FACEBOOK_APP_ID", label: "Facebook App ID", type: "text", placeholder: "123456789", description: "From Meta for Developers → App Dashboard", required: true },
      { key: "FACEBOOK_CLIENT_TOKEN", label: "Facebook Client Token", type: "text", placeholder: "abc123...", description: "From Meta for Developers → App Dashboard → Settings → Advanced" },
    ],
    quickTips: [
      "Add your Android key hash in Meta for Developers → Settings → Basic → Key Hashes",
      "Use the SHA-1 from the Signing page, convert to base64 for the key hash",
    ],
  },
  {
    pluginId: "capawesome-firebase-analytics",
    pluginName: "Firebase Analytics",
    secrets: [
      { key: "google-services.json", label: "google-services.json", type: "file", description: "Download from Firebase Console", required: true },
    ],
  },
  {
    pluginId: "capawesome-firebase-auth",
    pluginName: "Firebase Auth",
    secrets: [
      { key: "google-services.json", label: "google-services.json", type: "file", description: "Download from Firebase Console", required: true },
    ],
    quickTips: [
      "Enable the auth providers you need in Firebase Console → Authentication → Sign-in method",
      "If using Supabase Auth alongside Firebase: use Firebase for native sign-in, then pass the token to Supabase",
    ],
  },
  {
    pluginId: "capawesome-firebase-crashlytics",
    pluginName: "Firebase Crashlytics",
    secrets: [
      { key: "google-services.json", label: "google-services.json", type: "file", description: "Download from Firebase Console", required: true },
    ],
  },
  {
    pluginId: "capawesome-firebase-messaging",
    pluginName: "Firebase Cloud Messaging",
    secrets: [
      { key: "google-services.json", label: "google-services.json", type: "file", description: "Download from Firebase Console", required: true },
    ],
  },
  {
    pluginId: "capawesome-firebase-remote-config",
    pluginName: "Firebase Remote Config",
    secrets: [
      { key: "google-services.json", label: "google-services.json", type: "file", description: "Download from Firebase Console", required: true },
    ],
  },
  {
    pluginId: "capawesome-firebase-performance",
    pluginName: "Firebase Performance",
    secrets: [
      { key: "google-services.json", label: "google-services.json", type: "file", description: "Download from Firebase Console", required: true },
    ],
  },
  {
    pluginId: "iap",
    pluginName: "In-App Purchases",
    secrets: [
      { key: "IAP_PUBLIC_KEY", label: "Google Play License Key", type: "text", placeholder: "MIIBIjAN...", description: "From Google Play Console → Monetization → License" },
    ],
  },
  {
    pluginId: "capawesome-purchases",
    pluginName: "In-App Purchases (Capawesome)",
    secrets: [
      { key: "IAP_PUBLIC_KEY", label: "Google Play License Key", type: "text", placeholder: "MIIBIjAN...", description: "From Google Play Console → Monetization → License" },
    ],
  },
];

/** Get requirements for a specific plugin */
export function getPluginSecretRequirements(pluginId: string): PluginSecretRequirement | undefined {
  return PLUGIN_SECRET_REQUIREMENTS.find(r => r.pluginId === pluginId);
}

/** Get requirements for multiple plugins */
export function getRequirementsForPlugins(pluginIds: string[]): PluginSecretRequirement[] {
  return PLUGIN_SECRET_REQUIREMENTS.filter(r => pluginIds.includes(r.pluginId));
}

/** Load all saved secrets for a project (project-scoped + user-scoped via RLS) */
export async function loadPluginSecrets(projectId: string): Promise<PluginSecret[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !projectId) return [];

  const { data, error } = await supabase
    .from("plugin_secrets" as any)
    .select("*")
    .eq("user_id", session.user.id)
    .eq("project_id", projectId);

  if (error) {
    console.error("loadPluginSecrets failed:", error);
    return [];
  }
  return (data || []) as unknown as PluginSecret[];
}

/** Save a text secret (e.g., GOOGLE_CLIENT_ID) — strictly scoped to one project */
export async function savePluginSecret(projectId: string, pluginId: string, secretKey: string, secretValue: string): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !projectId) return false;

  const { error } = await supabase
    .from("plugin_secrets" as any)
    .upsert({
      user_id: session.user.id,
      project_id: projectId,
      plugin_id: pluginId,
      secret_key: secretKey,
      secret_value: secretValue,
      file_path: null,
    } as any, { onConflict: "user_id,project_id,plugin_id,secret_key" });

  if (error) console.error("savePluginSecret failed:", error);
  return !error;
}

/** Upload a file secret (e.g., google-services.json) to project-scoped storage path */
export async function savePluginFileSecret(projectId: string, pluginId: string, secretKey: string, file: File): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !projectId) return false;

  const filePath = `${session.user.id}/${projectId}/plugins/${pluginId}/${file.name}`;
  const { error: uploadErr } = await supabase.storage
    .from("build-artifacts")
    .upload(filePath, file, { upsert: true });

  if (uploadErr) {
    console.error("File upload error:", uploadErr);
    return false;
  }

  const { error } = await supabase
    .from("plugin_secrets" as any)
    .upsert({
      user_id: session.user.id,
      project_id: projectId,
      plugin_id: pluginId,
      secret_key: secretKey,
      secret_value: null,
      file_path: filePath,
    } as any, { onConflict: "user_id,project_id,plugin_id,secret_key" });

  if (error) console.error("savePluginFileSecret upsert failed:", error);
  return !error;
}

/** Check if all required secrets for a plugin are fulfilled */
export function arePluginSecretsComplete(pluginId: string, savedSecrets: PluginSecret[]): boolean {
  const req = getPluginSecretRequirements(pluginId);
  if (!req) return true; // No requirements = complete
  
  const pluginSecrets = savedSecrets.filter(s => s.plugin_id === pluginId);
  
  return req.secrets
    .filter(s => s.required !== false)
    .every(s => {
      const saved = pluginSecrets.find(ps => ps.secret_key === s.key);
      if (!saved) return false;
      if (s.type === "text") return !!saved.secret_value;
      if (s.type === "file") return !!saved.file_path;
      return false;
    });
}

/** Delete a plugin secret */
export async function deletePluginSecret(secretId: string): Promise<boolean> {
  const { error } = await supabase
    .from("plugin_secrets" as any)
    .delete()
    .eq("id", secretId);
  return !error;
}

/** Get secrets formatted for build injection */
export async function getSecretsForBuild(projectId: string): Promise<{
  textSecrets: Record<string, string>;
  fileSecrets: { pluginId: string; key: string; storagePath: string }[];
}> {
  const secrets = await loadPluginSecrets(projectId);
  const textSecrets: Record<string, string> = {};
  const fileSecrets: { pluginId: string; key: string; storagePath: string }[] = [];

  for (const s of secrets) {
    if (s.secret_value) {
      textSecrets[s.secret_key] = s.secret_value;
    }
    if (s.file_path) {
      fileSecrets.push({ pluginId: s.plugin_id, key: s.secret_key, storagePath: s.file_path });
    }
  }

  return { textSecrets, fileSecrets };
}

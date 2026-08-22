import { Key, Upload, FileJson, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SecretField {
  key: string;
  label: string;
  type: "text" | "file";
  placeholder?: string;
  description?: string;
}

interface PluginSecretConfig {
  pluginId: string;
  pluginName: string;
  secrets: SecretField[];
}

const PLUGIN_SECRETS: PluginSecretConfig[] = [
  {
    pluginId: "google-auth",
    pluginName: "Google Auth (legacy)",
    secrets: [
      { key: "GOOGLE_CLIENT_ID", label: "Google OAuth Web Client ID", type: "text", placeholder: "xxxx.apps.googleusercontent.com", description: "From Google Cloud Console → Credentials → OAuth 2.0 Client ID (Web application)" },
      { key: "google-services.json", label: "google-services.json", type: "file", description: "Download from Firebase Console → Project Settings" },
    ],
  },
  {
    pluginId: "capawesome-google-sign-in",
    pluginName: "Google Sign-In (Capawesome)",
    secrets: [
      { key: "GOOGLE_WEB_CLIENT_ID", label: "Web OAuth Client ID", type: "text", placeholder: "xxxx.apps.googleusercontent.com", description: "REQUIRED. Used as serverClientId on Android & iOS. Create a 'Web application' OAuth client in Google Cloud Console." },
      { key: "GOOGLE_IOS_CLIENT_ID", label: "iOS OAuth Client ID (optional)", type: "text", placeholder: "xxxx.apps.googleusercontent.com", description: "Only needed for native iOS sign-in. Create an 'iOS' OAuth client with your bundle ID." },
      { key: "GOOGLE_ANDROID_CLIENT_ID", label: "Android OAuth Client ID (optional)", type: "text", placeholder: "xxxx.apps.googleusercontent.com", description: "Create an 'Android' OAuth client with your package name + SHA-1 fingerprint. Used to authorize your app." },
      { key: "google-services.json", label: "google-services.json (optional)", type: "file", description: "Required only if you also use Firebase. Download from Firebase Console → Project Settings." },
    ],
  },
  {
    pluginId: "capawesome-apple-sign-in",
    pluginName: "Apple Sign-In (Capawesome)",
    secrets: [
      { key: "APPLE_SERVICE_ID", label: "Apple Service ID", type: "text", placeholder: "com.example.signin", description: "From Apple Developer → Identifiers → Services IDs. Required for Web/Android." },
      { key: "APPLE_REDIRECT_URI", label: "Redirect URI", type: "text", placeholder: "https://your-app.com/auth/apple/callback", description: "Must match the Return URL configured in your Apple Service ID." },
    ],
  },
  {
    pluginId: "capawesome-firebase-authentication",
    pluginName: "Firebase Authentication",
    secrets: [
      { key: "google-services.json", label: "google-services.json", type: "file", description: "Required for Android. Download from Firebase Console → Project Settings → Android app." },
      { key: "GoogleService-Info.plist", label: "GoogleService-Info.plist", type: "file", description: "Required for iOS. Download from Firebase Console → Project Settings → iOS app." },
      { key: "GOOGLE_WEB_CLIENT_ID", label: "Web OAuth Client ID (for Google sign-in)", type: "text", placeholder: "xxxx.apps.googleusercontent.com", description: "Required only if you enable Google as an auth provider." },
    ],
  },
  {
    pluginId: "capawesome-oauth",
    pluginName: "OAuth 2.0 / OpenID Connect",
    secrets: [
      { key: "OAUTH_CLIENT_ID", label: "OAuth Client ID", type: "text", placeholder: "your-client-id", description: "From your OAuth provider (Auth0, Okta, Microsoft, etc.)" },
      { key: "OAUTH_AUTH_URL", label: "Authorization URL", type: "text", placeholder: "https://your-provider.com/oauth/authorize", description: "Authorization endpoint of your OAuth provider." },
      { key: "OAUTH_REDIRECT_URL", label: "Redirect URL", type: "text", placeholder: "com.yourapp://oauth/callback", description: "Custom URL scheme used to redirect back into your app." },
    ],
  },
  {
    pluginId: "push",
    pluginName: "Push Notifications",
    secrets: [
      { key: "google-services.json", label: "google-services.json", type: "file", description: "Download from Firebase Console → Project Settings" },
    ],
  },
  {
    pluginId: "push-notifications",
    pluginName: "Push Notifications",
    secrets: [
      { key: "google-services.json", label: "google-services.json", type: "file", description: "Download from Firebase Console → Project Settings" },
    ],
  },
  {
    pluginId: "maps",
    pluginName: "Google Maps",
    secrets: [
      { key: "GOOGLE_MAPS_KEY", label: "Google Maps API Key", type: "text", placeholder: "AIza...", description: "From Google Cloud Console → APIs & Services → Credentials" },
    ],
  },
  {
    pluginId: "facebook-login",
    pluginName: "Facebook Login",
    secrets: [
      { key: "FACEBOOK_APP_ID", label: "Facebook App ID", type: "text", placeholder: "123456789", description: "From Meta for Developers → App Dashboard" },
      { key: "FACEBOOK_CLIENT_TOKEN", label: "Facebook Client Token", type: "text", placeholder: "abc123...", description: "From Meta for Developers → Settings → Advanced → Client Token" },
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
    pluginId: "purchases",
    pluginName: "In-App Purchases",
    secrets: [
      { key: "IAP_PUBLIC_KEY", label: "Google Play License Key", type: "text", placeholder: "MIIBIjAN...", description: "From Google Play Console → Monetization → License" },
    ],
  },
  {
    pluginId: "apple-sign-in",
    pluginName: "Sign in with Apple",
    secrets: [
      { key: "APPLE_SERVICE_ID", label: "Apple Service ID", type: "text", placeholder: "com.example.signin", description: "From Apple Developer → Identifiers → Services IDs" },
    ],
  },
  {
    pluginId: "barcode",
    pluginName: "Barcode Scanner",
    secrets: [
      { key: "GOOGLE_ML_KEY", label: "Google ML Kit API Key (optional)", type: "text", placeholder: "AIza...", description: "Only needed for cloud-based scanning. On-device scanning works without a key." },
    ],
  },
];

interface PluginSecretsFormProps {
  enabledPlugins: string[];
  secrets: Record<string, string>;
  fileSecrets: Record<string, File>;
  onSecretChange: (key: string, value: string) => void;
  onFileSecretChange: (key: string, file: File) => void;
}

const PluginSecretsForm = ({
  enabledPlugins,
  secrets,
  fileSecrets,
  onSecretChange,
  onFileSecretChange,
}: PluginSecretsFormProps) => {
  const requiredSecrets = PLUGIN_SECRETS.filter((p) =>
    enabledPlugins.some((ep) => ep.includes(p.pluginId))
  );

  if (requiredSecrets.length === 0) return null;

  return (
    <div className="rounded-xl bg-card border border-border p-4 space-y-4">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Key size={14} className="text-primary" />
        Plugin Credentials
      </h3>
      <p className="text-xs text-muted-foreground">
        Some plugins require API keys or config files to work properly.
      </p>

      {requiredSecrets.map((plugin) => (
        <div key={plugin.pluginId} className="space-y-3">
          <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <AlertCircle size={11} className="text-[hsl(var(--warning))]" />
            {plugin.pluginName}
          </div>

          {plugin.secrets.map((secret) => (
            <div key={secret.key} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{secret.label}</Label>
              {secret.type === "text" ? (
                <Input
                  type="text"
                  placeholder={secret.placeholder}
                  value={secrets[secret.key] || ""}
                  onChange={(e) => onSecretChange(secret.key, e.target.value)}
                  className="bg-secondary border-border font-mono text-xs h-8"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-secondary text-xs text-muted-foreground cursor-pointer hover:border-primary/30 transition-colors">
                    <Upload size={12} />
                    {fileSecrets[secret.key] ? fileSecrets[secret.key].name : "Choose file"}
                    <input
                      type="file"
                      accept=".json,.plist"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onFileSecretChange(secret.key, f);
                      }}
                    />
                  </label>
                  {fileSecrets[secret.key] && (
                    <FileJson size={14} className="text-[hsl(var(--success))]" />
                  )}
                </div>
              )}
              {secret.description && (
                <p className="text-[10px] text-muted-foreground">{secret.description}</p>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default PluginSecretsForm;

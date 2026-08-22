/**
 * OAuth 2.0 / OpenID Connect provider catalogue for the Capawesome OAuth
 * plugin (@capawesome-team/capacitor-oauth) and the dedicated social plugins.
 *
 * Every provider here follows the same native flow: open an in-app browser,
 * let the user sign in, and receive the redirect back into the app via a
 * custom URL scheme. That is why the `browser` + `app` plugins are hard
 * dependencies (see src/lib/plugins/dependencies.ts).
 *
 * Docs: https://capawesome.io/docs/sdks/capacitor/oauth/
 *       https://capawesome.io/docs/sdks/capacitor/google-sign-in/
 */

import googleIcon from "@/assets/oauth/google.svg";
import xIcon from "@/assets/oauth/x.svg";
import facebookIcon from "@/assets/oauth/facebook.svg";
import githubIcon from "@/assets/oauth/github.svg";
import gitlabIcon from "@/assets/oauth/gitlab.svg";
import microsoftIcon from "@/assets/oauth/microsoft.svg";
import appleIcon from "@/assets/oauth/apple.svg";
import discordIcon from "@/assets/oauth/discord.svg";
import slackIcon from "@/assets/oauth/slack.svg";
import linkedinIcon from "@/assets/oauth/linkedin.svg";
import twitchIcon from "@/assets/oauth/twitch.svg";
import spotifyIcon from "@/assets/oauth/spotify.svg";
import redditIcon from "@/assets/oauth/reddit.svg";
import auth0Icon from "@/assets/oauth/auth0.svg";
import oktaIcon from "@/assets/oauth/okta.svg";
import keycloakIcon from "@/assets/oauth/keycloak.svg";
import amazonIcon from "@/assets/oauth/amazon.svg";
import dropboxIcon from "@/assets/oauth/dropbox.svg";
import notionIcon from "@/assets/oauth/notion.svg";
import figmaIcon from "@/assets/oauth/figma.svg";

export interface OAuthField {
  /** Secret key persisted in plugin_secrets. `{P}` is replaced by the provider id (upper snake). */
  key: string;
  label: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
}

export interface OAuthProvider {
  id: string;
  name: string;
  icon: string;
  /** Brand accent used for the selected ring. */
  accent: string;
  authorizationUrl?: string;
  /** Extra fields on top of the shared client-id / redirect-url pair. */
  extraFields?: OAuthField[];
  scopes?: string;
  docsUrl?: string;
  /** Some providers have a first-party plugin that is preferred over generic OAuth. */
  nativePluginId?: string;
  notes?: string;
}

export const OAUTH_PROVIDERS: OAuthProvider[] = [
  {
    id: "google",
    name: "Google",
    icon: googleIcon,
    accent: "#4285F4",
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scopes: "openid email profile",
    nativePluginId: "capawesome-google-sign-in",
    docsUrl: "https://capawesome.io/docs/sdks/capacitor/google-sign-in/",
    notes: "Only the Web OAuth Client ID is required — it is used as serverClientId on Android and iOS.",
  },
  {
    id: "apple",
    name: "Apple",
    icon: appleIcon,
    accent: "#000000",
    authorizationUrl: "https://appleid.apple.com/auth/authorize",
    scopes: "name email",
    nativePluginId: "capawesome-apple-sign-in",
    extraFields: [
      { key: "OAUTH_APPLE_SERVICE_ID", label: "Service ID", placeholder: "com.example.signin", description: "Apple Developer → Identifiers → Services IDs (used on Android & Web).", required: true },
    ],
    docsUrl: "https://capawesome.io/docs/sdks/capacitor/apple-sign-in/",
  },
  { id: "x", name: "X (Twitter)", icon: xIcon, accent: "#000000", authorizationUrl: "https://twitter.com/i/oauth2/authorize", scopes: "tweet.read users.read offline.access" },
  { id: "facebook", name: "Facebook", icon: facebookIcon, accent: "#1877F2", authorizationUrl: "https://www.facebook.com/v19.0/dialog/oauth", scopes: "public_profile,email" },
  { id: "github", name: "GitHub", icon: githubIcon, accent: "#181717", authorizationUrl: "https://github.com/login/oauth/authorize", scopes: "read:user user:email" },
  { id: "gitlab", name: "GitLab", icon: gitlabIcon, accent: "#FC6D26", authorizationUrl: "https://gitlab.com/oauth/authorize", scopes: "openid read_user" },
  { id: "microsoft", name: "Microsoft", icon: microsoftIcon, accent: "#0078D4", authorizationUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", scopes: "openid profile email offline_access", extraFields: [{ key: "OAUTH_MICROSOFT_TENANT", label: "Tenant ID", placeholder: "common", description: "Use 'common' for multi-tenant apps." }] },
  { id: "discord", name: "Discord", icon: discordIcon, accent: "#5865F2", authorizationUrl: "https://discord.com/oauth2/authorize", scopes: "identify email" },
  { id: "slack", name: "Slack", icon: slackIcon, accent: "#4A154B", authorizationUrl: "https://slack.com/openid/connect/authorize", scopes: "openid profile email" },
  { id: "linkedin", name: "LinkedIn", icon: linkedinIcon, accent: "#0A66C2", authorizationUrl: "https://www.linkedin.com/oauth/v2/authorization", scopes: "openid profile email" },
  { id: "twitch", name: "Twitch", icon: twitchIcon, accent: "#9146FF", authorizationUrl: "https://id.twitch.tv/oauth2/authorize", scopes: "user:read:email" },
  { id: "spotify", name: "Spotify", icon: spotifyIcon, accent: "#1DB954", authorizationUrl: "https://accounts.spotify.com/authorize", scopes: "user-read-email" },
  { id: "reddit", name: "Reddit", icon: redditIcon, accent: "#FF4500", authorizationUrl: "https://www.reddit.com/api/v1/authorize", scopes: "identity" },
  { id: "amazon", name: "Amazon", icon: amazonIcon, accent: "#FF9900", authorizationUrl: "https://www.amazon.com/ap/oa", scopes: "profile" },
  { id: "dropbox", name: "Dropbox", icon: dropboxIcon, accent: "#0061FF", authorizationUrl: "https://www.dropbox.com/oauth2/authorize", scopes: "account_info.read" },
  { id: "notion", name: "Notion", icon: notionIcon, accent: "#000000", authorizationUrl: "https://api.notion.com/v1/oauth/authorize" },
  { id: "figma", name: "Figma", icon: figmaIcon, accent: "#F24E1E", authorizationUrl: "https://www.figma.com/oauth", scopes: "file_read" },
  { id: "auth0", name: "Auth0", icon: auth0Icon, accent: "#EB5424", scopes: "openid profile email", extraFields: [{ key: "OAUTH_AUTH0_DOMAIN", label: "Auth0 Domain", placeholder: "your-tenant.eu.auth0.com", required: true }] },
  { id: "okta", name: "Okta", icon: oktaIcon, accent: "#007DC1", scopes: "openid profile email", extraFields: [{ key: "OAUTH_OKTA_DOMAIN", label: "Okta Domain", placeholder: "your-org.okta.com", required: true }] },
  { id: "keycloak", name: "Keycloak", icon: keycloakIcon, accent: "#4D4D4D", scopes: "openid profile email", extraFields: [{ key: "OAUTH_KEYCLOAK_URL", label: "Realm URL", placeholder: "https://kc.example.com/realms/myrealm", required: true }] },
];

export const OAUTH_ENABLED_PROVIDERS_KEY = "OAUTH_ENABLED_PROVIDERS";

export function getOAuthProvider(id: string): OAuthProvider | undefined {
  return OAUTH_PROVIDERS.find((p) => p.id === id);
}

/** Secret keys for one provider: always a client id + redirect url, plus extras. */
export function oauthFieldsFor(provider: OAuthProvider): OAuthField[] {
  const upper = provider.id.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const base: OAuthField[] = [
    {
      key: `OAUTH_${upper}_CLIENT_ID`,
      label: `${provider.name} Client ID`,
      placeholder: provider.id === "google" ? "xxxx.apps.googleusercontent.com" : "your-client-id",
      description:
        provider.id === "google"
          ? "Web OAuth Client ID from Google Cloud Console. This is the only value NativeBridge needs."
          : `OAuth client id from the ${provider.name} developer console.`,
      required: true,
    },
  ];
  if (provider.id !== "google") {
    base.push({
      key: `OAUTH_${upper}_REDIRECT_URL`,
      label: "Redirect URL",
      placeholder: "com.yourapp://oauth/callback",
      description: "Custom URL scheme registered in your app. Must match the provider console exactly.",
      required: true,
    });
  }
  return [...base, ...(provider.extraFields ?? [])];
}

/** Plugin ids whose configuration UI is the OAuth provider picker. */
export const OAUTH_PLUGIN_IDS = ["capawesome-oauth", "oauth"];

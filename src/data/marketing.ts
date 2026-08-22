import {
  Smartphone, Apple, Monitor, Boxes, KeyRound, Bot, Cloud, GitBranch,
  BookOpen, Activity, Users, Newspaper, Rocket, Building2, GraduationCap,
  Briefcase, ShieldCheck, Gauge, Puzzle, Download,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  slug: string;
  to: string;
  label: string;
  desc: string;
  icon: LucideIcon;
}

export interface MarketingPageContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  bullets: { title: string; desc: string }[];
}

/* Product */
export const productItems: NavItem[] = [
  { slug: "android-builds", to: "/product/android-builds", label: "Android Builds", desc: "Signed APK + AAB from any web app", icon: Smartphone },
  { slug: "ios-builds", to: "/product/ios-builds", label: "iOS Builds", desc: "IPA on managed macOS runners", icon: Apple },
  { slug: "desktop-builds", to: "/product/desktop-builds", label: "Desktop Builds", desc: "Windows, macOS and Linux packages", icon: Monitor },
  { slug: "plugin-registry", to: "/product/plugin-registry", label: "Plugin Registry", desc: "Capacitor & Capawesome, auto-wired", icon: Puzzle },
  { slug: "signing-vault", to: "/product/signing-vault", label: "Signing Vault", desc: "Keystores and certificates, captured once", icon: KeyRound },
  { slug: "forge-ai", to: "/product/forge-ai", label: "ForgeAI Agent", desc: "An agent that edits your native project", icon: Bot },
];

/* Solutions */
export const solutionItems: NavItem[] = [
  { slug: "startups", to: "/solutions/startups", label: "Startups", desc: "Ship to the stores in an afternoon", icon: Rocket },
  { slug: "agencies", to: "/solutions/agencies", label: "Agencies", desc: "Client apps without a mobile team", icon: Briefcase },
  { slug: "enterprise", to: "/solutions/enterprise", label: "Enterprise", desc: "SSO, audit logs, dedicated runners", icon: Building2 },
  { slug: "education", to: "/solutions/education", label: "Education", desc: "Classroom projects to real devices", icon: GraduationCap },
];

/* Developers */
export const developerItems: NavItem[] = [
  { slug: "docs", to: "/docs", label: "Documentation", desc: "Guides, references and recipes", icon: BookOpen },
  { slug: "plugins", to: "/resources/plugins", label: "Plugin catalog", desc: "Every supported native plugin", icon: Boxes },
  { slug: "changelog", to: "/resources/changelog", label: "Changelog", desc: "What shipped, week by week", icon: GitBranch },
  { slug: "status", to: "/resources/status", label: "Build status", desc: "Runner health across all targets", icon: Activity },
  { slug: "community", to: "/resources/community", label: "Community", desc: "Discord, GitHub and showcases", icon: Users },
  { slug: "blog", to: "/resources/blog", label: "Blog", desc: "Deep dives on native packaging", icon: Newspaper },
];

const page = (
  item: NavItem,
  eyebrow: string,
  subtitle: string,
  bullets: { title: string; desc: string }[],
): MarketingPageContent => ({ eyebrow, title: item.label, subtitle, icon: item.icon, bullets });

export const marketingPages: Record<string, MarketingPageContent> = {
  "android-builds": page(productItems[0], "Product",
    "Upload source or connect a repo. We install dependencies, sync Capacitor, generate every icon density and hand you a signed APK and AAB in the same run.",
    [
      { title: "APK and AAB together", desc: "Every build produces both artifacts, stored and downloadable from your project." },
      { title: "Exact-ratio icons", desc: "Our generator scans the Android res tree and replaces each density with pixel-perfect assets." },
      { title: "Reproducible runners", desc: "Cached dependencies, pinned SDKs and a fresh environment for every build." },
    ]),
  "ios-builds": page(productItems[1], "Product",
    "Managed Apple silicon runners handle CocoaPods, provisioning profiles and code signing so an IPA lands next to your Android artifacts.",
    [
      { title: "Full signing surface", desc: "Bundle ID, Team ID, .p12, .mobileprovision and App Store Connect keys stored securely." },
      { title: "TestFlight ready", desc: "Release IPAs built with the configuration Apple expects." },
      { title: "Shared source of truth", desc: "One project, one codebase, both platforms." },
    ]),
  "desktop-builds": page(productItems[2], "Product",
    "The same web project becomes a Windows installer, a macOS DMG and Linux AppImage, DEB and RPM packages.",
    [
      { title: "Electron pipeline", desc: "Packaging, icons and installers configured for you." },
      { title: "Three Linux formats", desc: "One build produces AppImage, DEB and RPM." },
      { title: "Signed where it matters", desc: "Bring your own certificates for Windows and macOS." },
    ]),
  "plugin-registry": page(productItems[3], "Product",
    "Browse the full Capacitor and Capawesome plugin catalog, enable what you need and let the platform wire entry points, permissions and native config.",
    [
      { title: "Auto-detected entry points", desc: "We scan your code before enabling a plugin and patch the right files." },
      { title: "Permissions handled", desc: "Manifest and Info.plist entries added from plugin requirements." },
      { title: "Copyable snippets", desc: "Every plugin ships with usage examples you can drop into your app." },
    ]),
  "signing-vault": page(productItems[4], "Product",
    "Keys are captured on the first build and reused for every rebuild — the runner is disposable, your credentials are not.",
    [
      { title: "Captured once", desc: "Keystores, aliases and fingerprints persist in your project." },
      { title: "Visible and verifiable", desc: "SHA-1 and SHA-256 fingerprints shown in the signing page." },
      { title: "Reused on rebuilds", desc: "Store updates keep the same signature forever." },
    ]),
  "forge-ai": page(productItems[5], "Product",
    "An agent with read and write access to your project source, native folders, Gradle files and plugin registry — running in a loop until the build is green.",
    [
      { title: "Multi-file edits", desc: "Java, Kotlin, Gradle, manifests, TypeScript and configuration in one pass." },
      { title: "Grounded in docs", desc: "Capacitor and Capawesome documentation indexed for reference." },
      { title: "Scoped to your project", desc: "The agent only touches enabled plugins and real build failures." },
    ]),

  startups: page(solutionItems[0], "Solutions",
    "Skip the mobile hire. Turn the web product you already shipped into store-ready apps before your next standup.",
    [
      { title: "Zero native setup", desc: "No Android Studio, no Xcode, no local toolchains." },
      { title: "Free tier to start", desc: "Three builds a month, every engine included." },
      { title: "Grow into release", desc: "Add signing and store artifacts when you are ready." },
    ]),
  agencies: page(solutionItems[1], "Solutions",
    "Deliver native apps for every client from one dashboard, with isolated signing material per project.",
    [
      { title: "Project isolation", desc: "Separate source, keys and artifacts per client." },
      { title: "Repeatable delivery", desc: "Rebuild any project at any time from stored source." },
      { title: "White-label ready", desc: "Icons, splash screens and identity per app." },
    ]),
  enterprise: page(solutionItems[2], "Solutions",
    "Dedicated runner pools, SSO, audit logs and a private plugin registry for teams with compliance requirements.",
    [
      { title: "SAML and OIDC", desc: "Bring your identity provider." },
      { title: "Audit everything", desc: "Every build, key and artifact is traceable." },
      { title: "Dedicated capacity", desc: "No shared queues on any operating system." },
    ]),
  education: page(solutionItems[3], "Solutions",
    "Get student projects onto real devices without asking anyone to install a 12 GB IDE.",
    [
      { title: "Plain HTML welcome", desc: "Static projects are grounded automatically into buildable apps." },
      { title: "Shareable artifacts", desc: "Download links for every class project." },
      { title: "Readable build logs", desc: "Phase-by-phase output that teaches what happens." },
    ]),

  plugins: page(developerItems[1], "Developers",
    "Every native plugin the platform can install, wire and configure for you — searchable, expandable and packed with snippets.",
    [
      { title: "Capacitor core", desc: "Camera, filesystem, geolocation, push, share and more." },
      { title: "Capawesome", desc: "The stable community set, tested against our runners." },
      { title: "Auto-install", desc: "Enabled plugins are added to the workflow on the next build." },
    ]),
  changelog: page(developerItems[2], "Developers",
    "A running log of platform releases, runner upgrades and plugin additions.",
    [
      { title: "Runner upgrades", desc: "SDK, JDK and Gradle version bumps documented." },
      { title: "New plugins", desc: "Additions to the registry with wiring notes." },
      { title: "Agent improvements", desc: "Tooling and repair-loop changes." },
    ]),
  status: page(developerItems[3], "Developers",
    "Live health for Android, iOS, desktop and web runner pools plus build queue depth.",
    [
      { title: "Per-target health", desc: "Each runner pool reported independently." },
      { title: "Queue transparency", desc: "See wait times before you start a build." },
      { title: "Incident history", desc: "Past disruptions and their resolutions." },
    ]),
  community: page(developerItems[4], "Developers",
    "Builders shipping native apps from web code — join them on Discord, GitHub and in the showcase.",
    [
      { title: "Discord", desc: "Ask questions and share builds." },
      { title: "GitHub", desc: "Issues, discussions and example projects." },
      { title: "Showcase", desc: "Apps shipped through the platform." },
    ]),
  blog: page(developerItems[5], "Developers",
    "Deep dives on Capacitor internals, Gradle, signing, store submission and the agent loop.",
    [
      { title: "Engineering notes", desc: "How the build pipeline actually works." },
      { title: "Playbooks", desc: "Step-by-step store submission guides." },
      { title: "Release notes", desc: "Context behind the changelog." },
    ]),
};

export const trustBadges = [
  { icon: ShieldCheck, label: "Signing material never leaves your project" },
  { icon: Gauge, label: "Cached runners, minutes not hours" },
  { icon: Download, label: "APK, AAB, IPA and desktop artifacts" },
  { icon: Cloud, label: "Every build reproducible from stored source" },
];

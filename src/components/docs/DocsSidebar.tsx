import { useState } from "react";
import { ChevronRight, BookOpen, Zap, Cpu, Plug, Wrench, Bot, GitBranch, Key, HelpCircle, Layers, FileCode } from "lucide-react";

export interface SidebarSection {
  id: string;
  label: string;
  icon: React.ElementType;
  children: { id: string; label: string }[];
}

export const sidebarSections: SidebarSection[] = [
  {
    id: "overview", label: "Overview", icon: BookOpen,
    children: [
      { id: "what-is-nativebridge", label: "What is NativeBridge?" },
      { id: "how-it-works", label: "How It Works" },
      { id: "supported-platforms", label: "Supported Platforms" },
    ],
  },
  {
    id: "quick-start", label: "Quick Start", icon: Zap,
    children: [
      { id: "upload-source", label: "Upload Source Code" },
      { id: "configure-build", label: "Configure Build" },
      { id: "build-apk", label: "Build APK" },
    ],
  },
  {
    id: "engines", label: "Build Engines", icon: Cpu,
    children: [
      { id: "engine-capacitor", label: "Capacitor" },
      { id: "engine-ionic", label: "Ionic Capacitor" },
      { id: "engine-webview", label: "Android WebView" },
      { id: "engine-twa", label: "Trusted Web Activity" },
      { id: "engine-electron", label: "Electron (Desktop)" },
    ],
  },
  {
    id: "plugins", label: "Native Plugins", icon: Plug,
    children: [
      { id: "plugin-overview", label: "Plugin Overview" },
      { id: "plugin-camera", label: "Camera" },
      { id: "plugin-geolocation", label: "Geolocation" },
      { id: "plugin-push", label: "Push Notifications" },
      { id: "plugin-filesystem", label: "File System" },
      { id: "plugin-biometrics", label: "Biometrics" },
      { id: "plugin-local-notif", label: "Local Notifications" },
      { id: "plugin-share", label: "Share" },
      { id: "plugin-haptics", label: "Haptics" },
      { id: "plugin-clipboard", label: "Clipboard" },
      { id: "plugin-network", label: "Network" },
      { id: "plugin-device", label: "Device" },
      { id: "plugin-statusbar", label: "Status Bar" },
      { id: "plugin-keyboard", label: "Keyboard" },
      { id: "plugin-splash", label: "Splash Screen" },
      { id: "plugin-storage", label: "Preferences / Storage" },
      { id: "plugin-browser", label: "In-App Browser" },
      { id: "plugin-google-auth", label: "Google Auth" },
      { id: "plugin-apple-auth", label: "Apple Auth" },
      { id: "plugin-barcode", label: "Barcode Scanning" },
      { id: "plugin-bluetooth", label: "Bluetooth LE" },
      { id: "plugin-sms", label: "SMS" },
      { id: "plugin-iap", label: "In-App Purchases" },
      { id: "plugin-microphone", label: "Microphone" },
    ],
  },
  {
    id: "ai-assistant", label: "AI Assistant", icon: Bot,
    children: [
      { id: "forge-ai-overview", label: "ForgeAI Overview" },
      { id: "forge-ai-capabilities", label: "Capabilities" },
      { id: "forge-ai-context", label: "Context & Memory" },
    ],
  },
  {
    id: "build-tools", label: "Build Tools", icon: Wrench,
    children: [
      { id: "tool-project-scanner", label: "Project Scanner" },
      { id: "tool-compatibility", label: "Compatibility Checker" },
      { id: "tool-dependency", label: "Dependency Resolver" },
      { id: "tool-plugin-wirer", label: "Plugin Wirer" },
      { id: "tool-config-gen", label: "Config Generator" },
      { id: "tool-source-bundler", label: "Source Bundler" },
      { id: "tool-error-parser", label: "Build Error Parser" },
      { id: "tool-artifact", label: "Artifact Downloader" },
      { id: "tool-manifest", label: "Manifest Merger" },
      { id: "tool-logger", label: "Build Logger" },
      { id: "tool-apk-validator", label: "APK Validator" },
      { id: "tool-plugin-injector", label: "Plugin Code Injector" },
    ],
  },
  {
    id: "build-config", label: "Build Configuration", icon: Layers,
    children: [
      { id: "sdk-versions", label: "SDK & Gradle Versions" },
      { id: "github-actions", label: "GitHub Actions Runners" },
      { id: "aar-metadata", label: "AAR Metadata Resolution" },
    ],
  },
  {
    id: "project-structure", label: "Project Structure", icon: FileCode,
    children: [
      { id: "structure-capacitor", label: "Capacitor Project" },
      { id: "structure-webview", label: "WebView Project" },
      { id: "structure-twa", label: "TWA Project" },
      { id: "structure-electron", label: "Electron Project" },
    ],
  },
  {
    id: "github-integration", label: "GitHub Integration", icon: GitBranch,
    children: [
      { id: "repo-connection", label: "Repository Connection" },
      { id: "branch-selection", label: "Branch Selection" },
      { id: "webhook-builds", label: "Webhook Builds" },
    ],
  },
  {
    id: "signing", label: "Signing & Deployment", icon: Key,
    children: [
      { id: "debug-keystore", label: "Debug Keystore" },
      { id: "release-keystore", label: "Release Keystore" },
      { id: "google-play", label: "Google Play Upload" },
      { id: "aab-generation", label: "AAB Generation" },
    ],
  },
  {
    id: "sdk-reference", label: "SDK Reference", icon: Layers,
    children: [
      { id: "version-matrix", label: "Version Matrix" },
    ],
  },
  {
    id: "faq", label: "FAQ", icon: HelpCircle,
    children: [
      { id: "faq-frameworks", label: "Supported Frameworks" },
      { id: "faq-build-time", label: "Build Duration" },
      { id: "faq-play-store", label: "Google Play Publishing" },
      { id: "faq-aar-errors", label: "AAR Metadata Errors" },
      { id: "faq-ios", label: "iOS Support" },
      { id: "faq-desktop", label: "Desktop Support" },
    ],
  },
];

interface DocsSidebarProps {
  activeSection: string;
  onNavigate: (id: string) => void;
}

const DocsSidebar = ({ activeSection, onNavigate }: DocsSidebarProps) => {
  const [expanded, setExpanded] = useState<string[]>(
    sidebarSections.map((s) => s.id)
  );

  const toggle = (id: string) => {
    setExpanded((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const isChildActive = (section: SidebarSection) =>
    section.children.some((c) => c.id === activeSection);

  return (
    <aside className="w-[260px] shrink-0 border-r border-[#1e1e1e] bg-[#111] overflow-y-auto h-[calc(100vh-56px)] sticky top-14 hidden lg:block">
      <div className="py-4 px-3">
        {sidebarSections.map((section) => {
          const isOpen = expanded.includes(section.id);
          const Icon = section.icon;
          const childActive = isChildActive(section);

          return (
            <div key={section.id} className="mb-1">
              <button
                onClick={() => toggle(section.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  childActive ? "text-white bg-[#1a1a1a]" : "text-[#888] hover:text-white hover:bg-[#161616]"
                }`}
              >
                <Icon size={15} className={childActive ? "text-emerald-400" : "text-[#555]"} />
                <span className="flex-1 text-left">{section.label}</span>
                <ChevronRight
                  size={14}
                  className={`text-[#444] transition-transform ${isOpen ? "rotate-90" : ""}`}
                />
              </button>

              {isOpen && (
                <div className="ml-5 mt-0.5 border-l border-[#222] pl-3 space-y-0.5">
                  {section.children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => onNavigate(child.id)}
                      className={`block w-full text-left px-2 py-1.5 rounded text-[12.5px] transition-colors ${
                        activeSection === child.id
                          ? "text-emerald-400 bg-emerald-500/5 font-medium"
                          : "text-[#777] hover:text-[#ccc] hover:bg-[#161616]"
                      }`}
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};

export default DocsSidebar;

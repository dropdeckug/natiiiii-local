import { lazy, Suspense } from "react";
import { useBuildStore } from "@/stores/buildStore";
import {
  LayoutDashboard,
  Rocket,
  Package,
  Shield,
  Settings,
  KeyRound,
  Globe,
  ScrollText,
  HardDrive,
  Code2,
  Paintbrush,
} from "lucide-react";
// Lazy-loaded panels resolve in <100ms; rendering a skeleton column for them
// caused a flash of fake content. Each panel renders its own skeleton ONLY
// around the parts that actually fetch data.

const BuildsView = lazy(() => import("@/components/builds/BuildsView"));
const CreateFlow = lazy(() => import("@/components/create/CreateFlow"));
const CodeSourcePanel = lazy(() => import("@/components/dashboard/CodeSourcePanel"));
const CodeGitHubPanel = lazy(() => import("@/components/dashboard/CodeGitHubPanel"));
const CodeDependenciesPanel = lazy(() => import("@/components/dashboard/CodeDependenciesPanel"));
const CodeEnvironmentPanel = lazy(() => import("@/components/dashboard/CodeEnvironmentPanel"));
const SigningPanel = lazy(() => import("@/components/dashboard/SigningPanel"));
const ArtifactsPanel = lazy(() => import("@/components/dashboard/ArtifactsPanel"));
const PluginsPanel = lazy(() => import("@/components/dashboard/PluginsPanel"));
const PermissionsPanel = lazy(() => import("@/components/dashboard/PermissionsPanel"));
const AppearancePanel = lazy(() => import("@/components/dashboard/AppearancePanel"));
const OverviewContent = lazy(() => import("@/components/dashboard/OverviewContent"));
const SettingsPanel = lazy(() => import("@/components/dashboard/SettingsPanel"));
const DeveloperPanel = lazy(() => import("@/components/dashboard/DeveloperPanel"));
const InstallPanel = lazy(() => import("@/components/dashboard/InstallPanel"));
const LogsExplorer = lazy(() => import("@/components/logs/LogsExplorer"));


const Fallback = () => null;


interface PlaceholderProps {
  icon: React.ElementType;
  title: string;
  description: string;
}

const Placeholder = ({ icon: Icon, title, description }: PlaceholderProps) => (
  <div className="flex flex-col items-center justify-center h-full text-center px-8">
    <div className="flex h-12 w-12 items-center justify-center rounded-[6px] bg-muted mb-4">
      <Icon size={22} className="text-muted-foreground" />
    </div>
    <h2 className="text-base font-semibold text-foreground mb-1">{title}</h2>
    <p className="text-sm text-muted-foreground max-w-md">{description}</p>
  </div>
);

/** Feeds the Logs console with the active project + latest workflow run. */
const LogsWired = () => {
  const projectId = useBuildStore((s) => s.currentProjectId);
  const platform = useBuildStore((s) => s.activePlatform);
  const runUrl = useBuildStore((s) => s.activeRunUrl);
  const runId = runUrl ? Number(runUrl.split("/runs/")[1]?.split(/[/?#]/)[0]) : undefined;
  const repoName = runUrl ? runUrl.split("/")[4] : undefined;
  return (
    <LogsExplorer
      projectId={projectId ?? undefined}
      repoName={repoName}
      runId={Number.isFinite(runId) ? runId : undefined}
      platform={platform}
    />
  );
};

interface DashboardContentProps {
  section: string;
  activeItem: string;
}

const DashboardContent = ({ section, activeItem }: DashboardContentProps) => {
  if (section === "overview") {
    if (activeItem === "getting-started") {
      return <Placeholder icon={Rocket} title="Getting Started" description="Follow the setup guide to configure your project and trigger your first build." />;
    }
    return <Suspense fallback={<Fallback />}><OverviewContent /></Suspense>;
  }

  if (section === "code") {
    return (
      <Suspense fallback={<Fallback />}>
        {activeItem === "source-code" && <CodeSourcePanel />}
        {activeItem === "github-integration" && <CodeGitHubPanel />}
        {activeItem === "dependencies" && <CodeDependenciesPanel />}
        {activeItem === "environment" && <CodeEnvironmentPanel />}
        {!["source-code", "github-integration", "dependencies", "environment"].includes(activeItem) && <CodeSourcePanel />}
      </Suspense>
    );
  }

  if (section === "builds") {
    // Builds section removed — redirect users to overview.
    return <Placeholder icon={LayoutDashboard} title="Builds removed" description="The build section is no longer part of this dashboard." />;
  }

  if (section === "plugins") {
    if (activeItem === "app-permissions") {
      return <Suspense fallback={<Fallback />}><PermissionsPanel /></Suspense>;
    }
    // Extract plugin ID from "plugin:camera" format
    const pluginId = activeItem.startsWith("plugin:") ? activeItem.replace("plugin:", "") : undefined;
    return (
      <Suspense fallback={<Fallback />}>
        <PluginsPanel selectedPluginId={pluginId} />
      </Suspense>
    );
  }

  if (section === "config") {
    return <Placeholder icon={Settings} title="Configuration" description="Configure your app settings, Capacitor config, and environment variables." />;
  }

  if (section === "appearance") {
    return <Suspense fallback={<Fallback />}><AppearancePanel /></Suspense>;
  }

  if (section === "signing") {
    return <Suspense fallback={<Fallback />}><SigningPanel /></Suspense>;
  }

  if (section === "install") {
    return <Suspense fallback={<Fallback />}><InstallPanel /></Suspense>;
  }


  if (section === "networking") {
    return <Placeholder icon={Globe} title="Networking" description="Set up deep links, custom domains, and Android App Links." />;
  }

  if (section === "logs") {
    return <Suspense fallback={<Fallback />}><LogsWired /></Suspense>;
  }

  if (section === "storage") {
    return <Suspense fallback={<Fallback />}><ArtifactsPanel /></Suspense>;
  }

  if (section === "settings") {
    return <Suspense fallback={<Fallback />}><SettingsPanel activeItem={activeItem} /></Suspense>;
  }

  if (section === "developer") {
    // Developer / API moved under Settings.
    return <Suspense fallback={<Fallback />}><SettingsPanel activeItem={activeItem || "api-keys"} /></Suspense>;
  }

  return <Placeholder icon={LayoutDashboard} title="Dashboard" description="Select a section from the sidebar to get started." />;
};

export default DashboardContent;

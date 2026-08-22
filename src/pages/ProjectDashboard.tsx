import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardNavbar from "@/components/dashboard/DashboardNavbar";
import IconSidebarNav, { useSidebarPin } from "@/components/dashboard/IconSidebarNav";
import SectionPanel, { getDefaultItem } from "@/components/dashboard/SectionPanel";
import DashboardContent from "@/components/dashboard/DashboardContent";
import { useIsMobile } from "@/hooks/use-mobile";
// Skeleton removed: dashboard shell renders immediately while project loads.
import AssistantPanel from "@/components/layout/AssistantPanel";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { useProjectStore } from "@/stores/projectStore";
import { useBuildStore } from "@/stores/buildStore";
import { useResumableBuild } from "@/hooks/useResumableBuild";

const ProjectDashboard = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState("Project");
  const initialSection = searchParams.get("section") || "overview";
  const [section, setSection] = useState(initialSection);
  const [activeItem, setActiveItem] = useState(searchParams.get("item") || getDefaultItem(initialSection) || "project-overview");
  const [aiOpen, setAiOpen] = useState(true);
  const [hasApps, setHasApps] = useState(true);
  const { setGithubAccessToken, hydrateFromCloud, setCurrentProject, setSelectedEngine, setBuildAppName, setBuildPackageName, setEnabledPlugins } = useProjectStore();
  const setBuildCurrentProject = useBuildStore((s) => s.setCurrentProject);
  useResumableBuild(id);

  useEffect(() => {
    const routeSection = searchParams.get("section") || "overview";
    const routeItem = searchParams.get("item") || getDefaultItem(routeSection) || "project-overview";
    setSection(routeSection);
    setActiveItem(routeItem);
  }, [searchParams]);

  useEffect(() => {
    if (!id) return;
    // Reset both stores BEFORE any async work so the new project starts from a clean slate.
    setCurrentProject(id);
    setBuildCurrentProject(id);
    setLoading(true);

    let cancelled = false;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }

      if (session.provider_token) {
        setGithubAccessToken(session.provider_token);
      }

      const { data, error } = await supabase
        .from("projects")
        .select("name, engine")
        .eq("id", id)
        .single();

      if (cancelled) return;

      if (error || !data) {
        navigate("/projects");
        return;
      }

      setProjectName(data.name);

      // Sections other than the overview stay locked until an app is registered.
      try {
        const { count } = await supabase
          .from("project_apps")
          .select("id", { count: "exact", head: true })
          .eq("project_id", id);
        if (!cancelled) setHasApps((count ?? 0) > 0);
      } catch {
        if (!cancelled) setHasApps(true);
      }
      // Seed in-memory defaults from the project row so a fresh project doesn't inherit
      // engine / app-name from whatever project the user opened previously.
      if (data.engine) setSelectedEngine(data.engine);
      if (data.name) setBuildAppName(data.name);

      // Restore the package ID that this project actually builds with. Prefer
      // the latest build row, then a registered Android app config. This keeps
      // action-panel builds and artifact labels aligned after refresh/share.
      try {
        const [{ data: latestBuild }, { data: appRows }] = await Promise.all([
          supabase
            .from("builds")
            .select("package_name")
            .eq("project_id", id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("project_apps")
            .select("package_name, config")
            .eq("project_id", id)
            .order("updated_at", { ascending: false })
            .limit(5),
        ]);
        const appPackage = (appRows ?? [])
          .map((row: any) => row.package_name || row.config?.packageName)
          .find((value: unknown): value is string => typeof value === "string" && value.length > 0);
        const restoredPackage = latestBuild?.package_name || appPackage;
        if (!cancelled && restoredPackage) setBuildPackageName(restoredPackage);
      } catch (packageErr) {
        console.error("Failed to restore package ID:", packageErr);
      }

      // Load this project's enabled plugins so the in-memory Set matches the DB.
      try {
        const { data: pluginRows } = await supabase
          .from("project_plugins")
          .select("plugin_id, enabled")
          .eq("project_id", id);
        if (!cancelled) {
          const enabled = new Set<string>(
            (pluginRows ?? []).filter((r) => r.enabled).map((r) => r.plugin_id)
          );
          setEnabledPlugins(enabled);
        }
      } catch (pluginErr) {
        console.error("Failed to load project plugins:", pluginErr);
      }

      try {
        await hydrateFromCloud(id);
      } catch (hydrateError) {
        console.error("Failed to hydrate project source from cloud:", hydrateError);
      }

      // Scan-on-open: ensure project_index exists. If a snapshot is present but
      // the index row is not, invoke the index-project edge function so the
      // dashboard reflects the real framework / build command / output dir.
      try {
        const [{ data: indexRow }, { data: snap }] = await Promise.all([
          supabase.from("project_index").select("id, build_command, output_dir, entry_html").eq("project_id", id).maybeSingle(),
          supabase.from("project_snapshots").select("id").eq("project_id", id).limit(1).maybeSingle(),
        ]);
        if (snap && (!indexRow || !indexRow.build_command || !indexRow.output_dir || !indexRow.entry_html)) {
          supabase.functions.invoke("index-project", { body: { project_id: id } })
            .catch((err) => console.warn("[dashboard] index-project failed:", err));
        }
      } catch (indexErr) {
        console.warn("[dashboard] scan-on-open failed:", indexErr);
      }

      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id, navigate, setGithubAccessToken, hydrateFromCloud, setCurrentProject, setBuildCurrentProject, setSelectedEngine, setBuildAppName, setBuildPackageName, setEnabledPlugins]);

  // Clear current-project state when leaving the dashboard entirely.
  useEffect(() => {
    return () => {
      setCurrentProject(null);
      setBuildCurrentProject(null);
    };
  }, [setCurrentProject, setBuildCurrentProject]);

  // When a build finishes successfully, open the right-side assistant panel and
  // switch it to the Install tab so the user lands on "install to phone".
  const buildButtonState = useBuildStore((s) => s.buildButtonState);
  useEffect(() => {
    if (buildButtonState === "ready") {
      setAiOpen(true);
      window.dispatchEvent(new CustomEvent("nb:assistant-tab", { detail: "install" }));
    }
  }, [buildButtonState]);

  const lockedSections = hasApps
    ? []
    : ["code", "plugins", "appearance", "config", "signing", "networking", "logs", "storage"];

  const handleSectionChange = (newSection: string) => {
    if (lockedSections.includes(newSection)) return;
    const defaultItem = getDefaultItem(newSection);
    setSection(newSection);
    if (defaultItem) setActiveItem(defaultItem);
    const next = new URLSearchParams(searchParams);
    next.set("section", newSection);
    if (defaultItem) next.set("item", defaultItem);
    else next.delete("item");
    setSearchParams(next);
  };

  const handleItemChange = (newItem: string) => {
    setActiveItem(newItem);
    const next = new URLSearchParams(searchParams);
    next.set("section", section);
    next.set("item", newItem);
    setSearchParams(next);
  };


  // Note: we intentionally render the full dashboard shell while project metadata
  // is loading. Skeletons remain only on inner panels that actually fetch data
  // (overview KPIs, code source tree, etc.) — not on the column scaffolding.

  const { pinned, toggle: togglePin } = useSidebarPin();
  const effectiveSection = lockedSections.includes(section) ? "overview" : section;
  const effectiveItem = lockedSections.includes(section) ? "project-overview" : activeItem;

  return (
    <div className="flex h-screen flex-col bg-[hsl(var(--background))]">
      <DashboardNavbar
        projectName={projectName}
        projectId={id}
        onAIOpen={() => setAiOpen(!aiOpen)}
        section={section}
        onSectionChange={handleSectionChange}
      />

      <div className="flex flex-1 overflow-hidden">
        {!isMobile && (
          <div
            className="relative shrink-0"
            style={{ width: pinned ? 220 : 50 }}
          >
            <div
              className={`absolute inset-y-0 left-0 z-30 overflow-hidden border-r border-border bg-card ${
                pinned ? "w-[220px]" : "w-[50px]"
              }`}
            >
              <IconSidebarNav
                active={effectiveSection}
                onSelect={handleSectionChange}
                pinned={pinned}
                onPinToggle={togglePin}
                disabledIds={lockedSections}
              />
            </div>
          </div>
        )}

        <ResizablePanelGroup direction="horizontal" className="flex-1 min-w-0">
          {!isMobile && effectiveSection !== "logs" && effectiveItem !== "project-overview" && (
            <>
              <ResizablePanel defaultSize={15} minSize={12} maxSize={22} className="bg-card">
                <SectionPanel
                  section={effectiveSection}
                  activeItem={effectiveItem}
                  onItemSelect={handleItemChange}
                />
              </ResizablePanel>
              <ResizableHandle className="w-px bg-border hover:bg-primary/40 transition-colors" />
            </>
          )}

          <ResizablePanel defaultSize={aiOpen ? 55 : 85} minSize={35} className="bg-card">
            <main className={`h-full ${section === "logs" ? "overflow-hidden" : "overflow-auto"} ${isMobile ? "pt-[53px] pb-[53px]" : ""}`}>
              <DashboardContent section={effectiveSection} activeItem={effectiveItem} />
            </main>
          </ResizablePanel>

          {aiOpen && !isMobile && (
            <>
              <ResizableHandle className="w-px bg-border hover:bg-primary/40 transition-colors" />
              <ResizablePanel defaultSize={30} minSize={20} maxSize={45} className="bg-transparent">
                <AssistantPanel onClose={() => setAiOpen(false)} />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      {aiOpen && isMobile && (
        <div className="fixed inset-0 z-50 bg-background pt-[53px] pb-[53px]">
          <AssistantPanel onClose={() => setAiOpen(false)} />
        </div>
      )}
    </div>
  );
};

export default ProjectDashboard;

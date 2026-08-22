import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { PLUGIN_NPM_MAP, getPluginCategories } from "@/lib/generators/pluginMapping";
import { useProjectStore } from "@/stores/projectStore";
import { Input } from "@/components/ui/input";

const sectionMap: Record<string, { title: string; groups: { label: string; items: { id: string; label: string }[] }[] }> = {
  overview: {
    title: "Overview",
    groups: [
      { label: "", items: [{ id: "project-overview", label: "Project Overview" }, { id: "getting-started", label: "Getting Started" }] },
    ],
  },
  code: {
    title: "Code",
    groups: [
      { label: "MANAGE", items: [{ id: "source-code", label: "Source Code" }, { id: "github-integration", label: "Source Control" }] },
      { label: "TOOLS", items: [{ id: "dependencies", label: "Dependencies" }, { id: "environment", label: "Environment" }] },
    ],
  },
  // builds section removed

  plugins: { title: "Plugins & Permissions", groups: [] }, // Dynamic — rendered below
  config: {
    title: "Configuration",
    groups: [
      { label: "APP", items: [{ id: "app-config", label: "App Config" }, { id: "capacitor-config", label: "Capacitor Config" }] },
      { label: "ENVIRONMENT", items: [{ id: "env-variables", label: "Environment Variables" }] },
    ],
  },
  signing: {
    title: "Signing",
    groups: [
      { label: "KEYS", items: [{ id: "keystore-upload", label: "Keystore Upload" }, { id: "sha-keys", label: "SHA-1 Keys" }] },
      { label: "DISTRIBUTION", items: [{ id: "play-store-sync", label: "Play Store Sync" }] },
    ],
  },
  install: {
    title: "Install to Device",
    groups: [{ label: "", items: [{ id: "install-device", label: "USB Install" }, { id: "install-tips", label: "USB Debugging Tips" }] }],
  },

  networking: {
    title: "Networking",
    groups: [{ label: "LINKS", items: [{ id: "deep-links", label: "Deep Links" }, { id: "domains", label: "Domains" }, { id: "app-links", label: "App Links" }] }],
  },
  storage: {
    title: "Storage",
    groups: [{ label: "", items: [{ id: "artifacts", label: "Artifacts" }, { id: "downloads", label: "Downloads" }] }],
  },
  settings: {
    title: "Project Settings",
    groups: [
      {
        label: "PROJECT SETTINGS",
        items: [
          { id: "general", label: "General" },
          { id: "infrastructure", label: "Infrastructure" },
          { id: "integrations", label: "Integrations" },
          { id: "build", label: "Build" },
        ],
      },
      { label: "AI", items: [{ id: "ai-models", label: "AI Models" }] },
      { label: "CONFIGURATION", items: [{ id: "api-keys", label: "API Keys" }] },
      { label: "WORKSPACE", items: [{ id: "notifications", label: "Notifications" }] },
    ],
  },
};

const CORE_PLUGINS = ["app", "splash-screen", "status-bar"];

interface SectionPanelProps {
  section: string;
  activeItem: string;
  onItemSelect: (id: string) => void;
}

/* ── Dynamic plugins sidebar ── */
const PluginsSidebar = ({ activeItem, onItemSelect }: { activeItem: string; onItemSelect: (id: string) => void }) => {
  const { enabledPlugins } = useProjectStore();
  const categories = useMemo(() => getPluginCategories(), []);
  // Determine which category contains the active plugin so we expand only that one.
  const activePluginId = activeItem.startsWith("plugin:") ? activeItem.slice(7) : null;
  const activeCategory = activePluginId ? PLUGIN_NPM_MAP[activePluginId]?.category : null;
  // All categories start collapsed except the one containing the active plugin.
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(
    () => new Set(categories.filter((c) => c !== activeCategory))
  );
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = (label: string) => !q || label.toLowerCase().includes(q);

  const pluginsByCategory = useMemo(() => {
    const map: Record<string, { id: string; label: string; isEnabled: boolean; isCore: boolean }[]> = {};
    const seenIds = new Set<string>();
    const seenRefs = new Set<unknown>();
    for (const [id, entry] of Object.entries(PLUGIN_NPM_MAP)) {
      // De-dupe alias IDs that point at the SAME entry object (e.g. "splash" → "splash-screen"),
      // but keep distinct entries that happen to share an npm package (e.g. "status-bar" vs "edge-to-edge").
      if (seenRefs.has(entry) || seenIds.has(id)) continue;
      seenRefs.add(entry); seenIds.add(id);
      const cat = entry.category || "Other";
      if (!map[cat]) map[cat] = [];
      const shortName = id
        .replace(/^capawesome-/, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());
      map[cat].push({
        id: `plugin:${id}`,
        label: shortName,
        isEnabled: enabledPlugins.has(id) || CORE_PLUGINS.includes(id),
        isCore: CORE_PLUGINS.includes(id),
      });
    }
    return map;
  }, [enabledPlugins]);

  // Installed plugins (enabled ones)
  const installedPlugins = useMemo(() => {
    const list: { id: string; label: string; isCore: boolean }[] = [];
    const seenIds = new Set<string>();
    const seenRefs = new Set<unknown>();
    for (const [id, entry] of Object.entries(PLUGIN_NPM_MAP)) {
      if (seenRefs.has(entry) || seenIds.has(id)) continue;
      seenRefs.add(entry); seenIds.add(id);
      if (enabledPlugins.has(id) || CORE_PLUGINS.includes(id)) {
        const shortName = id
          .replace(/^capawesome-/, "")
          .replace(/-/g, " ")
          .replace(/\b\w/g, c => c.toUpperCase());
        list.push({ id: `plugin:${id}`, label: shortName, isCore: CORE_PLUGINS.includes(id) });
      }
    }
    return list;
  }, [enabledPlugins]);


  const toggleCat = (cat: string) => {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const filteredInstalled = installedPlugins.filter(p => matches(p.label));

  return (
    <div className="flex h-full w-full flex-col">
      <div className="px-5 pt-4 pb-2">
        <h2 className="text-sm font-semibold text-foreground">Plugins & Permissions</h2>
      </div>
      <div className="px-3 pb-2">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search plugins…"
            className="h-7 pl-7 text-[12px] bg-transparent"
          />
        </div>
      </div>
      <nav className="flex-1 px-3 pb-3 space-y-3 overflow-y-auto">
        {/* Permissions link */}
        {!q && (
          <div className="space-y-0.5">
            <button
              onClick={() => onItemSelect("app-permissions")}
              className={`flex w-full items-center rounded-[4px] px-2.5 py-1.5 text-[13px] transition-colors ${
                activeItem === "app-permissions"
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              App Permissions
            </button>
          </div>
        )}

        {/* Installed */}
        {filteredInstalled.length > 0 && (
          <div>
            <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              INSTALLED
            </p>
            <div className="space-y-0.5">
              {filteredInstalled.map(p => (
                <button
                  key={p.id}
                  onClick={() => onItemSelect(p.id)}
                  className={`flex w-full items-center gap-2 rounded-[4px] px-2.5 py-1.5 text-[13px] transition-colors ${
                    activeItem === p.id
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--success))] shrink-0" />
                  <span className="truncate">{p.label}</span>
                  {p.isCore && <span className="text-[9px] px-1 py-0 rounded bg-primary/10 text-primary ml-auto shrink-0">core</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Available by category */}
        {categories.map(cat => {
          const plugins = (pluginsByCategory[cat] || []).filter(p => matches(p.label));
          if (plugins.length === 0) return null;
          // Auto-expand categories when actively searching.
          const isOpen = q ? true : !collapsedCats.has(cat);
          return (
            <div key={cat}>
              <button
                onClick={() => toggleCat(cat)}
                className="flex w-full items-center gap-1 px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown size={11} className={`transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                {cat}
              </button>
              {isOpen && (
                <div className="space-y-0.5">
                  {plugins.map(p => (
                    <button
                      key={p.id}
                      onClick={() => onItemSelect(p.id)}
                      className={`flex w-full items-center gap-2 rounded-[4px] px-2.5 py-1.5 text-[13px] transition-colors ${
                        activeItem === p.id
                          ? "bg-muted text-foreground font-medium"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      }`}
                    >
                      {p.isEnabled && <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--success))] shrink-0" />}
                      <span className="truncate">{p.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {q && filteredInstalled.length === 0 &&
          categories.every(cat => (pluginsByCategory[cat] || []).filter(p => matches(p.label)).length === 0) && (
          <p className="px-2 py-4 text-[12px] text-muted-foreground/60 text-center">
            No plugins match "{query}"
          </p>
        )}
      </nav>
    </div>
  );
};

/* ── Static section sidebar ── */
const StaticSidebar = ({ section, activeItem, onItemSelect }: SectionPanelProps) => {
  const config = sectionMap[section];
  if (!config) return null;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">{config.title}</h2>
      </div>
      <nav className="flex-1 px-3 pb-3 space-y-4 overflow-y-auto">
        {config.groups.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = activeItem === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onItemSelect(item.id)}
                    className={`flex w-full items-center justify-between rounded-[4px] px-2.5 py-1.5 text-[13px] transition-colors ${
                      isActive
                        ? "bg-muted text-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
};

const SectionPanel = (props: SectionPanelProps) => {
  if (props.section === "plugins") {
    return <PluginsSidebar activeItem={props.activeItem} onItemSelect={props.onItemSelect} />;
  }
  return <StaticSidebar {...props} />;
};

// Helper to get default active item for a section
const getDefaultItem = (section: string): string => {
  if (section === "plugins") {
    // Auto-select the first plugin from the first alphabetical category.
    const categories: string[] = [];
    const byCat: Record<string, string[]> = {};
    const seen = new Set<string>();
    for (const [id, entry] of Object.entries(PLUGIN_NPM_MAP)) {
      if (seen.has(entry.npm)) continue;
      seen.add(entry.npm);
      const cat = entry.category || "Other";
      if (!byCat[cat]) { byCat[cat] = []; categories.push(cat); }
      byCat[cat].push(id);
    }
    categories.sort();
    const first = byCat[categories[0]]?.[0];
    return first ? `plugin:${first}` : "app-permissions";
  }
  const config = sectionMap[section];
  if (!config) return "";
  return config.groups[0]?.items[0]?.id || "";
};

export default SectionPanel;
export { sectionMap, getDefaultItem };

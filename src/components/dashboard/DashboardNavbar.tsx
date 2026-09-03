import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import NativeBridgeLogo from "@/components/layout/NativeBridgeLogo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  ChevronDown,
  Search,
  Bell,
  Moon,
  Sun,
  LogOut,
  User,
  CreditCard,
  Settings,
  FolderOpen,
  MessageSquare,
  HelpCircle,
  ExternalLink,
  Bot,
  Menu,
  Check,
  Plus,
  Smartphone,
  Hammer,
  Keyboard,
  Filter,
  Building2,
  KeyRound,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import IconSidebarNav from "./IconSidebarNav";
import AddAppDialog from "@/components/projects/AddAppDialog";
import { useProjectStore } from "@/stores/projectStore";
import { useBuildStore, type TargetPlatform } from "@/stores/buildStore";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import androidIcon from "@/assets/platforms/android.svg";
import appleIcon from "@/assets/platforms/apple.svg";
import webIcon from "@/assets/platforms/web.svg";
import windowsIcon from "@/assets/platforms/windows.svg";
import macosIcon from "@/assets/platforms/macos.svg";
import linuxIcon from "@/assets/platforms/linux.svg";
import flutterIcon from "@/assets/platforms/flutter.svg";
import capacitorIcon from "@/assets/icons/capacitor.svg";
import ionicIcon from "@/assets/icons/ionic.svg";
import webviewIcon from "@/assets/icons/webview.svg";
import chromeIcon from "@/assets/icons/chrome.svg";

const PLATFORM_ICONS: Record<string, string> = {
  android: androidIcon,
  ios: appleIcon,
  apple: appleIcon,
  web: webIcon,
  desktop: windowsIcon,
  flutter: flutterIcon,
  windows: windowsIcon,
  macos: macosIcon,
  linux: linuxIcon,
};
const ENGINE_ICONS: Record<string, string> = {
  capacitor: capacitorIcon,
  ionic: ionicIcon,
  webview: webviewIcon,
  twa: chromeIcon,
};

interface DashboardNavbarProps {
  projectName: string;
  projectId?: string;
  orgName?: string;
  onAIOpen?: () => void;
  section?: string;
  onSectionChange?: (section: string) => void;
}

const DashboardNavbar = ({ projectName, projectId, orgName = "Personal", onAIOpen, section, onSectionChange }: DashboardNavbarProps) => {
  const navigate = useNavigate();
  const { theme, toggle: toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [profile, setProfile] = useState<{
    display_name: string | null;
    avatar_url: string | null;
    email: string | null;
  } | null>(null);
  const [apps, setApps] = useState<{ id: string; nickname: string; platform: string }[]>([]);
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [projectSlug, setProjectSlug] = useState<string>("");
  const [showAddApp, setShowAddApp] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const selectedEngine = useProjectStore((s) => s.selectedEngine);
  const setActivePlatform = useBuildStore((s) => s.setActivePlatform);

  const applyPlatform = (platform?: string) => {
    const p = (platform || "android").toLowerCase();
    const known: TargetPlatform[] = ["android", "ios", "web", "desktop", "flutter"];
    setActivePlatform((known as string[]).includes(p) ? (p as TargetPlatform) : "android");
  };

  const selectApp = (id: string) => {
    setActiveAppId(id);
    applyPlatform(apps.find((a) => a.id === id)?.platform);
  };

  // Cmd/Ctrl+K opens search palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const loadApps = async () => {
    if (!projectId) return;
    const { data: proj } = await supabase
      .from("projects").select("project_id_slug").eq("id", projectId).maybeSingle();
    if (proj?.project_id_slug) setProjectSlug(proj.project_id_slug);
    const { data: appRows } = await supabase
      .from("project_apps")
      .select("id, nickname, platform")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (appRows) {
      setApps(appRows);
      setActiveAppId((curr) => (curr && appRows.some((a) => a.id === curr) ? curr : appRows[0]?.id ?? null));
    }
  };

  // Keep activePlatform synced with the selected app's platform safely in an effect
  useEffect(() => {
    if (!activeAppId || apps.length === 0) return;
    const activeApp = apps.find((a) => a.id === activeAppId);
    if (activeApp?.platform) {
      applyPlatform(activeApp.platform);
    }
  }, [activeAppId, apps]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, email")
        .eq("id", session.user.id)
        .single();
      if (data) setProfile(data);

      const { data: projData } = await supabase
        .from("projects")
        .select("id, name")
        .eq("user_id", session.user.id)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (projData) setProjects(projData);
    })();
  }, []);

  useEffect(() => { loadApps(); }, [projectId]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const initials = (profile?.display_name || profile?.email || "U")[0].toUpperCase();
  const displayOrg = profile?.display_name || profile?.email?.split("@")[0] || orgName;

  return (
    <header className="sticky top-0 z-50 flex h-12 items-center border-b border-border bg-card overflow-x-auto scrollbar-hide">
      {isMobile && onSectionChange && (
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <button className="flex items-center justify-center h-full w-11 hover:bg-muted/50 transition-colors">
              <Menu size={18} />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[260px]">
            <IconSidebarNav
              active={section || "overview"}
              onSelect={(id) => {
                onSectionChange(id);
                setMobileMenuOpen(false);
              }}
            />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex items-center h-full shrink-0">
        <button
          onClick={() => navigate("/projects")}
          className="flex items-center justify-center h-full w-12 hover:bg-muted/50 transition-colors"
        >
          <NativeBridgeLogo size={20} />
        </button>

        {!isMobile && (
          <>
            <div className="flex items-center h-full">
              <button
                onClick={() => navigate("/projects")}
                className="flex items-center gap-1.5 px-3 h-full text-sm text-foreground hover:bg-muted/50 transition-colors"
              >
                <span className="truncate max-w-[120px]">{displayOrg}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-[3px] font-normal uppercase tracking-wider">
                  Free
                </Badge>
              </button>
              <ChevronDown size={12} className="text-muted-foreground mr-2" />
            </div>

            <div className="flex items-center h-full">
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1.5 px-3 h-full text-sm font-medium text-foreground hover:bg-muted/50 transition-colors">
                  {projectName}
                  <ChevronDown size={12} className="text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 rounded-[4px]">
                  <div className="px-2 py-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Switch project</p>
                  </div>
                  {projects.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => navigate(`/project/${p.id}`)}
                      className="rounded-[3px] flex items-center justify-between"
                    >
                      <span className="truncate">{p.name}</span>
                      {p.id === projectId && <Check size={14} className="text-primary shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                  {projects.length > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem onClick={() => navigate("/projects")} className="rounded-[3px]">
                    <FolderOpen size={14} className="mr-2" />
                    All projects
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Current app + engine + switcher */}
            <div className="flex items-center h-full border-l border-border/60 ml-1 pl-1">
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1.5 px-3 h-full text-sm text-foreground hover:bg-muted/50 transition-colors">
                  {(() => {
                    const current = apps.find((a) => a.id === activeAppId);
                    const plat = (current?.platform || "android").toLowerCase();
                    const platSrc = PLATFORM_ICONS[plat];
                    return platSrc ? (
                      <img src={platSrc} alt={plat} className="h-3.5 w-3.5" />
                    ) : (
                      <Smartphone size={13} className="text-muted-foreground" />
                    );
                  })()}
                  <span className="truncate max-w-[140px]">
                    {apps.find((a) => a.id === activeAppId)?.nickname || "No app yet"}
                  </span>
                  {selectedEngine && (() => {
                    const engineSrc = ENGINE_ICONS[selectedEngine.toLowerCase()];
                    return (
                      <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-[3px] bg-muted text-muted-foreground uppercase tracking-wider font-medium">
                        {engineSrc && <img src={engineSrc} alt="" className="h-3 w-3" />}
                        {selectedEngine}
                      </span>
                    );
                  })()}
                  <ChevronDown size={12} className="text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 rounded-[4px]">
                  <div className="px-2 py-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Switch app</p>
                  </div>
                  {apps.length === 0 && (
                    <div className="px-2 py-2 text-xs text-muted-foreground">No apps registered yet.</div>
                  )}
                  {apps.map((a) => {
                    const plat = (a.platform || "android").toLowerCase();
                    const platSrc = PLATFORM_ICONS[plat];
                    return (
                      <DropdownMenuItem
                        key={a.id}
                        onClick={() => selectApp(a.id)}
                        className="rounded-[3px] flex items-center justify-between"
                      >
                        <span className="truncate flex items-center gap-2">
                          {platSrc ? <img src={platSrc} alt="" className="h-3.5 w-3.5" /> : <Smartphone size={12} className="text-muted-foreground" />}
                          {a.nickname}
                          <span className="text-[10px] text-muted-foreground uppercase">{a.platform}</span>
                        </span>
                        {a.id === activeAppId && <Check size={14} className="text-primary shrink-0" />}
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowAddApp(true)} className="rounded-[3px]">
                    <Plus size={14} className="mr-2" />
                    Add application
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                onClick={() => setShowAddApp(true)}
                title="Add application"
                className="flex items-center gap-1.5 px-2.5 h-full text-xs text-primary hover:bg-muted/50 transition-colors"
              >
                <Plus size={13} />
                <span className="hidden md:inline">Add app</span>
              </button>
            </div>
          </>
        )}

        {isMobile && (
          <span className="text-sm font-medium text-foreground truncate max-w-[140px]">{projectName}</span>
        )}
      </div>

      <div className="ml-auto flex items-center h-full shrink-0">
        <button
          onClick={onAIOpen}
          className="flex items-center gap-1.5 px-3 h-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <Bot size={15} />
          <span className="hidden sm:inline text-xs">Agent</span>
        </button>

        {!isMobile && (
          <>
            <button className="flex items-center gap-1.5 px-3 h-full text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <MessageSquare size={14} />
              <span className="hidden sm:inline text-xs">Feedback</span>
            </button>

            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-1.5 px-3 h-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Search size={14} />
              <span className="hidden sm:inline text-xs text-muted-foreground">Search...</span>
              <kbd className="hidden sm:inline ml-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-[3px]">
                ⌘K
              </kbd>
            </button>

            <button className="flex items-center justify-center w-10 h-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <HelpCircle size={15} />
            </button>
          </>
        )}

        <button className="flex items-center justify-center w-10 h-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors relative">
          <Bell size={15} />
        </button>

        <button
          onClick={toggleTheme}
          className="flex items-center justify-center w-10 h-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center justify-center w-10 h-full hover:bg-muted/50 transition-colors">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} className="h-6 w-6 rounded-full" alt="" />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-medium">
                {initials}
              </div>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-[4px]">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium text-foreground truncate">
                {profile?.display_name || profile?.email}
              </p>
              {profile?.email && profile?.display_name && (
                <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="rounded-[3px]">
              <User size={14} className="mr-2" /> Account
            </DropdownMenuItem>
            <DropdownMenuItem className="rounded-[3px]">
              <Settings size={14} className="mr-2" /> Preferences
            </DropdownMenuItem>
            <DropdownMenuItem className="rounded-[3px]">
              <CreditCard size={14} className="mr-2" /> Billing
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="rounded-[3px]">
              <ExternalLink size={14} className="mr-2" /> Documentation
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive rounded-[3px]">
              <LogOut size={14} className="mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {showAddApp && projectId && (
        <AddAppDialog
          projectSlug={projectSlug}
          projectId={projectId}
          projectName={projectName}
          forced={false}
          existingPlatforms={apps.map((a) => a.platform)}
          onAppRegistered={() => loadApps()}
          onClose={() => setShowAddApp(false)}
        />
      )}

      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Run a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Shortcuts">
            <CommandItem onSelect={() => { onSectionChange?.("overview"); setSearchOpen(false); }}>
              <FolderOpen className="mr-2 h-4 w-4" /> Open project overview
              <kbd className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded">O then S</kbd>
            </CommandItem>
            <CommandItem onSelect={() => { setShowAddApp(true); setSearchOpen(false); }}>
              <Plus className="mr-2 h-4 w-4" /> Add application
              <kbd className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded">⇧N</kbd>
            </CommandItem>
            {/* Builds shortcut removed */}
            <CommandItem onSelect={() => { onSectionChange?.("plugins"); setSearchOpen(false); }}>
              <Filter className="mr-2 h-4 w-4" /> Manage plugins
              <kbd className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded">⇧P</kbd>
            </CommandItem>
            <CommandItem>
              <Keyboard className="mr-2 h-4 w-4" /> Show all keyboard shortcuts
              <kbd className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded">⇧?</kbd>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => { navigate("/projects"); setSearchOpen(false); }}>
              <Plus className="mr-2 h-4 w-4" /> Create…
            </CommandItem>
            <CommandItem onSelect={() => { onSectionChange?.("settings"); setSearchOpen(false); }}>
              <Building2 className="mr-2 h-4 w-4" /> Configure organization…
            </CommandItem>
            <CommandItem onSelect={() => { navigate("/projects"); setSearchOpen(false); }}>
              <KeyRound className="mr-2 h-4 w-4" /> Switch project…
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Projects">
            {projects.map((p) => (
              <CommandItem key={p.id} onSelect={() => { navigate(`/project/${p.id}`); setSearchOpen(false); }}>
                <FolderOpen className="mr-2 h-4 w-4" /> {p.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </header>
  );
};

export default DashboardNavbar;

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  PlusCircle,
  Hammer,
  Hexagon,
  Sparkles,
  MoreHorizontal,
  BarChart3,
  LogOut,
  Bell,
  Home,
  Layers3,
  X,
  Settings,
  HelpCircle,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  FolderOpen,
  Clock,
  Sun,
  Moon,
} from "lucide-react";
import NativeBridgeLogo from "./NativeBridgeLogo";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/useTheme";

interface XSidebarProps {
  activeItem: string;
  onItemClick: (item: string) => void;
}

const navItems = [
  { id: "create", icon: PlusCircle, label: "Create", isCreate: true },
  { id: "home", icon: Home, label: "Home" },
  { id: "builds", icon: Hammer, label: "Builds" },
  { id: "analytics", icon: BarChart3, label: "Analytics" },
  { id: "plugins", icon: Hexagon, label: "Plugins" },
  { id: "agent", icon: Sparkles, label: "Agent" },
];

const recentProjects = [
  { name: "EarlyMarket", color: "hsl(152, 76%, 48%)" },
  { name: "SK Sure Wins", color: "hsl(217, 91%, 60%)" },
  { name: "Portfolio Site", color: "hsl(38, 92%, 50%)" },
];

const XSidebar = ({ activeItem, onItemClick }: XSidebarProps) => {
  const navigate = useNavigate();
  const { theme, toggle: toggleTheme } = useTheme();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initials, setInitials] = useState("D");
  const [expanded, setExpanded] = useState(true);
  const [showMorePopover, setShowMorePopover] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfilePopover, setShowProfilePopover] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", session.user.id)
        .maybeSingle();
      if (profile) {
        setAvatarUrl(profile.avatar_url || null);
        const name = profile.display_name || session.user.email?.split("@")[0] || "D";
        setInitials(name.charAt(0).toUpperCase());
      } else {
        const meta = session.user.user_metadata;
        const name = meta?.full_name || meta?.name || session.user.email?.split("@")[0] || "D";
        setInitials(name.charAt(0).toUpperCase());
        setAvatarUrl(meta?.avatar_url || null);
      }
    };
    loadProfile();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-popover]")) {
        setShowMorePopover(false);
        setShowNotifications(false);
        setShowProfilePopover(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return (
    <div className="flex h-screen sticky top-0">
      {/* ── Icon Strip ── */}
      <div className="w-[72px] flex flex-col items-center py-4 bg-background">
        <div className="mb-1 flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 cursor-pointer hover:bg-primary/20 transition-colors">
          <NativeBridgeLogo size={22} />
        </div>
        <span className="text-[9px] font-semibold text-muted-foreground tracking-wide mb-4 select-none">NativeBridge</span>

        <nav className="flex flex-col items-center gap-0.5 w-full flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.id;
            return (
              <button key={item.id} onClick={() => onItemClick(item.id)} className="canva-nav-item group">
                <div className={`canva-nav-icon ${isActive ? "canva-nav-icon-active" : ""} ${item.isCreate ? "canva-nav-icon-create" : ""} ${item.isCreate && isActive ? "canva-nav-icon-create" : ""}`}>
                  <Icon size={20} strokeWidth={isActive ? 2.2 : 1.5} />
                </div>
                <span className={`text-[10px] leading-tight mt-0.5 ${isActive ? "font-semibold text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* More popover */}
          <div className="relative" data-popover>
            <button onClick={(e) => { e.stopPropagation(); setShowMorePopover(!showMorePopover); setShowNotifications(false); setShowProfilePopover(false); }} className="canva-nav-item group">
              <div className="canva-nav-icon"><MoreHorizontal size={20} strokeWidth={1.5} /></div>
              <span className="text-[10px] leading-tight mt-0.5 text-muted-foreground group-hover:text-foreground">More</span>
            </button>

            {showMorePopover && (
              <div className="absolute left-[72px] bottom-0 z-50 w-48 bg-card border border-border rounded-xl shadow-xl py-1.5 animate-fade-in">
                {[
                  { icon: Settings, label: "Settings", id: "settings" },
                  { icon: HelpCircle, label: "Help & Support", id: "help" },
                  { icon: FileText, label: "Documentation", id: "docs" },
                ].map((item) => (
                  <button key={item.id} onClick={() => { setShowMorePopover(false); if (item.id === "docs") navigate("/docs"); else onItemClick(item.id); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-foreground hover:bg-muted/60 transition-colors">
                    <item.icon size={16} strokeWidth={1.5} className="text-muted-foreground" /> {item.label}
                  </button>
                ))}
                <div className="h-px bg-border my-1" />
                <button onClick={async () => { setShowMorePopover(false); await supabase.auth.signOut(); navigate("/auth"); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors">
                  <LogOut size={16} strokeWidth={1.5} /> Log out
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* Bottom: theme toggle, notifications, avatar */}
        <div className="flex flex-col items-center gap-2 mt-auto">
          {/* Theme toggle */}
          <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-muted transition-colors" title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
            {theme === "dark" ? <Sun size={18} className="text-muted-foreground" /> : <Moon size={18} className="text-muted-foreground" />}
          </button>

          {/* Notifications */}
          <div className="relative" data-popover>
            <button onClick={(e) => { e.stopPropagation(); setShowNotifications(!showNotifications); setShowMorePopover(false); setShowProfilePopover(false); }} className="canva-nav-item">
              <div className="relative">
                <Bell size={20} strokeWidth={1.5} className="text-muted-foreground" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-destructive border-2 border-background" />
              </div>
            </button>
            {showNotifications && (
              <div className="absolute left-[72px] bottom-0 z-50 w-72 bg-card border border-border rounded-xl shadow-xl animate-fade-in">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                  <span className="text-sm font-semibold text-foreground">Notifications</span>
                  <button onClick={() => setShowNotifications(false)} className="p-0.5 rounded hover:bg-muted"><X size={14} className="text-muted-foreground" /></button>
                </div>
                <div className="py-8 text-center">
                  <Bell size={24} className="text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No notifications yet</p>
                </div>
              </div>
            )}
          </div>

          {/* Avatar with profile popover */}
          <div className="relative" data-popover>
            <button onClick={(e) => { e.stopPropagation(); setShowProfilePopover(!showProfilePopover); setShowMorePopover(false); setShowNotifications(false); }} className="mt-1">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-transparent hover:ring-primary/40 transition-all" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary hover:bg-primary/30 transition-colors">{initials}</div>
              )}
            </button>
            {showProfilePopover && (
              <div className="absolute left-[72px] bottom-0 z-50 w-48 bg-card border border-border rounded-xl shadow-xl py-1.5 animate-fade-in">
                <button onClick={() => { setShowProfilePopover(false); onItemClick("profile"); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-foreground hover:bg-muted/60 transition-colors">
                  <Settings size={16} strokeWidth={1.5} className="text-muted-foreground" /> Profile
                </button>
                <div className="h-px bg-border my-1" />
                <button onClick={async () => { setShowProfilePopover(false); await supabase.auth.signOut(); navigate("/auth"); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors">
                  <LogOut size={16} strokeWidth={1.5} /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Expanded Panel ── */}
      {expanded && (
        <div className="w-[220px] bg-card border-r border-border flex flex-col h-full animate-fade-in">
          <div className="flex items-center justify-between px-3 h-12 border-b border-border/50">
            <span className="text-sm font-medium text-foreground">Projects</span>
            <button onClick={() => setExpanded(false)} className="p-1 rounded-md hover:bg-muted transition-colors" title="Collapse panel">
              <PanelLeftClose size={16} className="text-muted-foreground" />
            </button>
          </div>

          <div className="px-3 py-2 space-y-0.5">
            {[
              { icon: FolderOpen, label: "All projects" },
              { icon: Clock, label: "Recent" },
              { icon: Layers3, label: "Templates" },
            ].map((item, i) => (
              <button key={i}
                className={`flex items-center gap-2.5 w-full px-2 py-2 rounded-lg text-sm transition-colors ${i === 0 ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}>
                <item.icon size={16} strokeWidth={1.5} /> {item.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Recent</span>
            </div>
            <div className="space-y-0.5">
              {recentProjects.map((project, i) => (
                <button key={i} className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors">
                  <div className="w-5 h-5 rounded flex-shrink-0" style={{ backgroundColor: project.color }} />
                  <span className="truncate text-left">{project.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border/50 px-3 py-2">
            <button className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors">
              <Layers3 size={16} strokeWidth={1.5} /> Trash
            </button>
          </div>
        </div>
      )}

      {!expanded && (
        <button onClick={() => setExpanded(true)}
          className="absolute left-[72px] top-4 z-30 p-1.5 rounded-md bg-card border border-border hover:bg-muted shadow-sm transition-colors" title="Expand panel">
          <PanelLeftOpen size={14} className="text-muted-foreground" />
        </button>
      )}
    </div>
  );
};

export default XSidebar;

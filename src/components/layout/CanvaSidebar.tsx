import { useState } from "react";
import {
  Plus,
  Home,
  FolderOpen,
  Layers3,
  Hexagon,
  Sparkles,
  Workflow,
  MoreHorizontal,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import NativeBridgeLogo from "./NativeBridgeLogo";

interface CanvaSidebarProps {
  activeItem: string;
  onItemClick: (item: string) => void;
  onCreateClick: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const navItems = [
  { id: "home", icon: Home, label: "Home" },
  { id: "projects", icon: FolderOpen, label: "Projects" },
  { id: "templates", icon: Layers3, label: "Templates" },
  { id: "plugins", icon: Hexagon, label: "Plugins" },
  { id: "assets", icon: Sparkles, label: "Assets" },
  { id: "builds", icon: Workflow, label: "Builds" },
];

const recentProjects = [
  { name: "My React App", color: "hsl(217, 91%, 60%)" },
  { name: "E-commerce PWA", color: "hsl(142, 76%, 45%)" },
  { name: "Dashboard App", color: "hsl(38, 92%, 50%)" },
  { name: "Portfolio Site", color: "hsl(0, 72%, 51%)" },
];

const CanvaSidebar = ({
  activeItem,
  onItemClick,
  onCreateClick,
  collapsed,
  onToggleCollapse,
}: CanvaSidebarProps) => {
  return (
    <div
      className={`flex flex-col bg-card border-r border-border h-full transition-all duration-300 ${
        collapsed ? "w-[68px]" : "w-[240px]"
      }`}
    >
      {/* Logo area */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border/50">
        <NativeBridgeLogo size={26} />
        {!collapsed && (
          <span className="text-[15px] font-medium tracking-tight text-foreground whitespace-nowrap">
            NativeBridge
          </span>
        )}
      </div>

      {/* Create button */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={onCreateClick}
          className={`flex items-center gap-2.5 rounded-xl bg-primary text-primary-foreground font-medium transition-all duration-200 hover:bg-primary/90 active:scale-[0.97] ${
            collapsed
              ? "w-10 h-10 justify-center mx-auto"
              : "w-full px-4 py-2.5 text-sm"
          }`}
        >
          <Plus size={18} strokeWidth={2.5} />
          {!collapsed && <span>Create</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onItemClick(item.id)}
              className={`flex items-center gap-3 w-full rounded-lg transition-all duration-150 ${
                collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"
              } ${
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={20} strokeWidth={1.6} />
              {!collapsed && (
                <span className="text-sm whitespace-nowrap">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Recent projects - only when expanded */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Recent
            </span>
            <button className="text-xs text-primary hover:underline">
              See all
            </button>
          </div>
          <div className="space-y-0.5">
            {recentProjects.map((project, i) => (
              <button
                key={i}
                className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
              >
                <div
                  className="w-5 h-5 rounded flex-shrink-0"
                  style={{ backgroundColor: project.color }}
                />
                <span className="truncate text-left">{project.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom section */}
      <div className="border-t border-border/50 px-2 py-2 space-y-0.5">
        <button
          className={`flex items-center gap-3 w-full rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors ${
            collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"
          }`}
          title="More"
        >
          <MoreHorizontal size={20} strokeWidth={1.6} />
          {!collapsed && <span className="text-sm">More</span>}
        </button>
        <button
          className={`flex items-center gap-3 w-full rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors ${
            collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"
          }`}
          title="Trash"
        >
          <Trash2 size={20} strokeWidth={1.6} />
          {!collapsed && <span className="text-sm">Trash</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <div className="border-t border-border/50 px-2 py-2">
        <button
          onClick={onToggleCollapse}
          className={`flex items-center gap-3 w-full rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors ${
            collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"
          }`}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen size={20} strokeWidth={1.6} />
          ) : (
            <>
              <PanelLeftClose size={20} strokeWidth={1.6} />
              <span className="text-sm">Collapse</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CanvaSidebar;

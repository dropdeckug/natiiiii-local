import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Package,
  Shield,
  Settings,
  KeyRound,
  Globe,
  ScrollText,
  HardDrive,
  Code2,
  LifeBuoy,
  ExternalLink,
  Paintbrush,
  SlidersHorizontal,
  Terminal,
  Smartphone,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

const navItems = [
  { id: "overview", label: "Project Overview", icon: LayoutDashboard },
  { id: "code", label: "Code", icon: Code2 },
  { id: "plugins", label: "Plugins & Permissions", icon: Shield },
  { id: "appearance", label: "Appearance", icon: Paintbrush },
  { id: "config", label: "Configuration", icon: Settings },
  { id: "signing", label: "Signing", icon: KeyRound },
  { id: "networking", label: "Networking", icon: Globe },
  { id: "logs", label: "Logs", icon: ScrollText },
  { id: "storage", label: "Storage", icon: HardDrive },
  { id: "settings", label: "Settings", icon: SlidersHorizontal },
];


const bottomItems = [
  { id: "support", label: "Support", icon: LifeBuoy },
  { id: "docs", label: "Documentation", icon: ExternalLink },
];

interface IconSidebarNavProps {
  active: string;
  onSelect: (id: string) => void;
  /** When true, sidebar is pinned-open and reserves layout space. */
  pinned?: boolean;
  onPinToggle?: () => void;
  /** Force the expanded look (labels visible). Parent decides via width + overflow. */
  forceExpanded?: boolean;
  /** Section ids that cannot be opened yet (e.g. before an app is registered). */
  disabledIds?: string[];
}

const PIN_KEY = "nb.sidebar.pinned";

const IconSidebarNav = ({ active, onSelect, pinned, onPinToggle, forceExpanded, disabledIds = [] }: IconSidebarNavProps) => {
  const expanded = pinned || forceExpanded;
  const disabled = new Set(disabledIds);
  return (
    <nav className={`flex h-full flex-col bg-card ${expanded ? "w-[220px]" : "w-[50px]"}`}>
      <div className={`flex-1 flex flex-col py-2 gap-0.5 overflow-y-auto overflow-x-hidden ${expanded ? "px-2" : "px-1.5"}`}>
        {navItems.map((item) => {
          const isActive = active === item.id;
          const isDisabled = disabled.has(item.id);
          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && onSelect(item.id)}
              disabled={isDisabled}
              title={isDisabled ? `${item.label} — add an app first` : item.label}
              className={`flex h-8 w-full items-center rounded-[4px] text-[13px] transition-colors whitespace-nowrap ${
                expanded ? "gap-2.5 px-2.5 justify-start" : "justify-center px-0"
              } ${
                isDisabled
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : isActive
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              <item.icon size={16} strokeWidth={isActive ? 2 : 1.5} className="shrink-0" />
              {expanded && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </div>

      <div className={`border-t border-border py-2 space-y-0.5 ${expanded ? "px-2" : "px-1.5"}`}>
        {bottomItems.map((item) => (
          <button
            key={item.id}
            title={item.label}
            className={`flex h-8 w-full items-center rounded-[4px] text-[13px] text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors whitespace-nowrap ${
              expanded ? "gap-2.5 px-2.5 justify-start" : "justify-center px-0"
            }`}
          >
            <item.icon size={15} strokeWidth={1.5} className="shrink-0" />
            {expanded && <span className="truncate">{item.label}</span>}
          </button>
        ))}

        {onPinToggle && (
          <button
            onClick={onPinToggle}
            title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
            className={`flex h-8 w-full items-center rounded-[4px] text-[13px] text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors whitespace-nowrap mt-1 ${
              expanded ? "gap-2.5 px-2.5 justify-start" : "justify-center px-0"
            }`}
          >
            {pinned ? <PanelLeftClose size={15} className="shrink-0" /> : <PanelLeftOpen size={15} className="shrink-0" />}
            {expanded && <span className="truncate">{pinned ? "Unpin sidebar" : "Pin sidebar"}</span>}
          </button>
        )}
      </div>
    </nav>
  );
};

export function useSidebarPin() {
  const [pinned, setPinned] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(PIN_KEY) === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PIN_KEY, pinned ? "1" : "0");
  }, [pinned]);
  return { pinned, toggle: () => setPinned((p) => !p) };
}

export default IconSidebarNav;

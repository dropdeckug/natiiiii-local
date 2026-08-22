import {
  Layers3,
  Fingerprint,
  Workflow,
  Sparkles,
  LayoutGrid,
  Rocket,
  Settings2,
  Hexagon,
  Plus,
} from "lucide-react";

interface IconSidebarProps {
  activeItem: string;
  onItemClick: (item: string) => void;
  onCreateApp?: () => void;
}

const navigationItems = [
  { id: "projects", icon: Layers3, label: "Projects" },
  { id: "converter", icon: Fingerprint, label: "Converter" },
  { id: "plugins", icon: Hexagon, label: "Plugins" },
  { id: "builds", icon: Workflow, label: "Builds" },
  { id: "assets", icon: Sparkles, label: "Assets" },
  { id: "templates", icon: LayoutGrid, label: "Templates" },
  { id: "deploy", icon: Rocket, label: "Deploy" },
];

const IconSidebar = ({ activeItem, onItemClick, onCreateApp }: IconSidebarProps) => {
  return (
    <div className="w-14 bg-sidebar-iconbar rounded-lg flex flex-col items-center py-3 gap-1">
      {/* Create App button */}
      <button
        onClick={onCreateApp}
        className="icon-button mb-2 bg-primary/15 hover:bg-primary/25 text-primary"
        title="Create App"
      >
        <Plus size={20} strokeWidth={2} />
      </button>

      <div className="w-7 h-px bg-border mb-1" />

      {navigationItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeItem === item.id;
        
        return (
          <button
            key={item.id}
            onClick={() => onItemClick(item.id)}
            className={`icon-button ${isActive ? "icon-button-active" : ""}`}
            title={item.label}
          >
            <Icon size={20} strokeWidth={1.5} />
          </button>
        );
      })}
      
      <div className="flex-1" />
      
      <button className="icon-button" title="Settings">
        <Settings2 size={20} strokeWidth={1.5} />
      </button>
    </div>
  );
};

export default IconSidebar;

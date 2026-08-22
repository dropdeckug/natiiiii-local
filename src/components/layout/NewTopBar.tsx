import { Plus, BarChart3, Share2, Settings, User } from "lucide-react";
import NativeBridgeLogo from "./NativeBridgeLogo";

interface NewTopBarProps {
  onCreateProject?: () => void;
}

const NewTopBar = ({ onCreateProject }: NewTopBarProps) => {
  return (
    <div className="h-14 flex items-center justify-between px-4 bg-[hsl(220,13%,10%)]">
      {/* Left: Logo + Title */}
      <div className="flex items-center gap-3">
        <NativeBridgeLogo size={28} />
        <span className="text-[15px] font-medium tracking-tight text-foreground">NativeBridge</span>
        <span className="text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">beta</span>
      </div>

      {/* Center: Project actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onCreateProject}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary/15 text-primary text-sm font-medium hover:bg-primary/25 transition-colors"
        >
          <Plus size={15} />
          Create project
        </button>
      </div>

      {/* Right: Actions + Avatar */}
      <div className="flex items-center gap-1">
        <button className="icon-button w-9 h-9" title="Analytics">
          <BarChart3 size={18} />
        </button>
        <button className="icon-button w-9 h-9" title="Share">
          <Share2 size={18} />
        </button>
        <button className="icon-button w-9 h-9" title="Settings">
          <Settings size={18} />
        </button>
        <div className="ml-2 w-8 h-8 rounded-full border border-primary/30 bg-gradient-to-br from-primary/85 to-muted backdrop-blur-md flex items-center justify-center">
          <User size={14} className="text-primary-foreground" />
        </div>
      </div>
    </div>
  );
};

export default NewTopBar;

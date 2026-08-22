import {
  Search,
  Plus,
  ChevronDown,
  Play,
  Copy,
  HardDrive,
  Check,
} from "lucide-react";

const TopBar = () => {
  return (
    <div className="h-12 bg-sidebar-iconbar border-b border-border flex items-center justify-between px-4">
      {/* Left Section */}
      <div className="flex items-center gap-1">
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-muted transition-colors">
          <Search size={16} className="text-muted-foreground" />
          <span className="text-sm">Commands</span>
        </button>
        
        <div className="h-5 w-px bg-border mx-1" />
        
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-muted transition-colors">
          <Plus size={16} className="text-muted-foreground" />
          <span className="text-sm">Code</span>
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>
        
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-muted transition-colors">
          <Plus size={16} className="text-muted-foreground" />
          <span className="text-sm">Config</span>
        </button>
        
        <div className="h-5 w-px bg-border mx-1" />
        
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/50 hover:bg-muted transition-colors">
          <Play size={16} className="text-success" />
          <span className="text-sm">Build all</span>
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>
        
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-muted transition-colors">
          <Copy size={16} className="text-muted-foreground" />
          <span className="text-sm">Export to Repo</span>
        </button>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Check size={14} className="text-success" />
          <span className="text-muted-foreground">RAM</span>
          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-success rounded-full" />
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <HardDrive size={14} className="text-muted-foreground" />
          <span className="text-muted-foreground">Disk</span>
          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full w-1/4 bg-primary rounded-full" />
          </div>
        </div>
        
        <ChevronDown size={16} className="text-muted-foreground" />
      </div>
    </div>
  );
};

export default TopBar;

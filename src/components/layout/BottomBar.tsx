import {
  Braces,
  Terminal,
  ArrowUp,
  CircleDot,
} from "lucide-react";

const BottomBar = () => {
  return (
    <div className="h-8 bg-sidebar-iconbar border-t border-border flex items-center justify-between px-4">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Braces size={14} />
          <span>Variables</span>
        </button>
        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Terminal size={14} />
          <span>Terminal</span>
        </button>
      </div>

      {/* Center */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <button className="w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors">
          <ArrowUp size={16} className="text-primary-foreground" />
        </button>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CircleDot size={14} className="text-success" />
        <span>Android 14</span>
      </div>
    </div>
  );
};

export default BottomBar;

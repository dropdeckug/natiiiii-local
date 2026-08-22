import {
  Smartphone,
  Eye,
  Code2,
  Puzzle,
  KeyRound,
  Rocket,
  History,
  Palette,
  StickyNote,
  X,
  ToggleRight,
} from "lucide-react";

interface StudioPanelProps {
  onClose?: () => void;
  onToolClick?: (tool: string) => void;
}

const studioTools = [
  { id: "build", icon: Smartphone, label: "Build APK", description: "Generate debug/release APK", color: "text-primary" },
  { id: "preview", icon: Eye, label: "Live Preview", description: "Preview in device frame", color: "text-success" },
  { id: "analysis", icon: Code2, label: "Code Analysis", description: "Scan for mobile issues", color: "text-info" },
  { id: "plugins", icon: Puzzle, label: "Plugin Manager", description: "Add native capabilities", color: "text-warning" },
  { id: "signing", icon: KeyRound, label: "Signing Config", description: "Keystore & certificates", color: "text-[hsl(280,60%,65%)]" },
  { id: "deploy", icon: Rocket, label: "Deploy", description: "Publish to stores", color: "text-[hsl(340,70%,60%)]" },
  { id: "history", icon: History, label: "Build History", description: "Past builds & artifacts", color: "text-muted-foreground" },
  { id: "assets", icon: Palette, label: "Asset Generator", description: "Icons, splashes, screenshots", color: "text-[hsl(30,80%,55%)]" },
];

const StudioPanel = ({ onClose, onToolClick }: StudioPanelProps) => {
  return (
    <div className="w-full sm:w-[260px] sm:min-w-[220px] bg-card rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <ToggleRight size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium">Studio</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="icon-button w-7 h-7">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Tool Grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="grid grid-cols-2 gap-2">
          {studioTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => onToolClick?.(tool.id)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border/40 bg-muted/15 hover:bg-muted/40 hover:border-primary/30 transition-all text-center group"
              >
                <div className={`w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center group-hover:bg-muted/60 transition-colors`}>
                  <Icon size={16} className={tool.color} />
                </div>
                <span className="text-[11px] font-medium text-foreground leading-tight">{tool.label}</span>
                <span className="text-[9px] text-muted-foreground leading-tight">{tool.description}</span>
              </button>
            );
          })}
        </div>

        {/* Output area */}
        <div className="mt-4 px-2">
          <p className="text-[10px] text-muted-foreground/60 text-center">Studio output will be saved here</p>
        </div>
      </div>

      {/* Add note button */}
      <div className="px-3 pb-3">
        <button className="flex items-center justify-center gap-1.5 w-full py-2 rounded-full border border-border/50 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
          <StickyNote size={12} />
          Add note
        </button>
      </div>
    </div>
  );
};

export default StudioPanel;

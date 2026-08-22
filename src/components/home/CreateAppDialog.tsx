import { useState } from "react";
import { X, Search, ChevronRight, Sparkles, Zap } from "lucide-react";
import androidIcon from "@/assets/platforms/android.svg";
import appleIcon from "@/assets/platforms/apple.svg";
import windowsIcon from "@/assets/platforms/windows.svg";
import linuxIcon from "@/assets/platforms/linux.svg";
import webIcon from "@/assets/platforms/web.svg";
import macosIcon from "@/assets/platforms/macos.svg";

interface CreateAppDialogProps {
  open: boolean;
  onClose: () => void;
  onStartWizard: (platform: string) => void;
}

const platforms = [
  { id: "for-you", label: "For you", icon: Sparkles, isLucide: true },
  { id: "android", label: "Android", iconSrc: androidIcon },
  { id: "ios", label: "iOS", iconSrc: appleIcon },
  { id: "windows", label: "Windows", iconSrc: windowsIcon, comingSoon: true },
  { id: "macos", label: "macOS", iconSrc: macosIcon, comingSoon: true },
  { id: "linux", label: "Linux", iconSrc: linuxIcon, comingSoon: true },
  { id: "web", label: "Web (PWA)", iconSrc: webIcon, comingSoon: true },
];

interface QuickAction {
  label: string;
  description: string;
  badge?: string;
}

const quickActions: QuickAction[] = [
  { label: "Capacitor Build", description: "Full native with plugins", badge: "Popular" },
  { label: "WebView Wrapper", description: "Wrap any website" },
  { label: "TWA (Trusted Web)", description: "Chrome-powered PWA wrapper" },
  { label: "Ionic Build", description: "Ionic + Capacitor", badge: "New" },
];

interface CreateTemplate {
  id: string;
  title: string;
  subtitle: string;
  gradient: string;
  platform: string;
}

const createTemplates: CreateTemplate[] = [
  { id: "blank-android", title: "Blank Android App", subtitle: "Start from scratch", gradient: "from-[#3DDC84]/20 to-[#3DDC84]/5", platform: "android" },
  { id: "url-android", title: "URL → Android APK", subtitle: "Convert any website", gradient: "from-primary/20 to-primary/5", platform: "android" },
  { id: "react-android", title: "React → Android", subtitle: "Upload React project", gradient: "from-[#61DAFB]/20 to-[#61DAFB]/5", platform: "android" },
  { id: "blank-ios", title: "iOS App (Soon)", subtitle: "Coming soon", gradient: "from-white/10 to-white/5", platform: "ios" },
];

const CreateAppDialog = ({ open, onClose, onStartWizard }: CreateAppDialogProps) => {
  const [activePlatform, setActivePlatform] = useState("for-you");
  const [searchQuery, setSearchQuery] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl h-[85vh] max-h-[700px] bg-card rounded-2xl border border-border shadow-2xl flex overflow-hidden animate-scale-in">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-muted/80 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={16} />
        </button>

        {/* Left sidebar */}
        <div className="w-[200px] border-r border-border/50 flex flex-col py-4 flex-shrink-0">
          <h2 className="text-lg font-semibold text-foreground px-5 mb-4">
            Create an app
          </h2>

          {/* Search */}
          <div className="px-3 mb-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="What to create?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-muted/60 border-none text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
          </div>

          {/* Platform list */}
          <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
            {platforms.map((platform) => {
              const isActive = activePlatform === platform.id;
              return (
                <button
                  key={platform.id}
                  onClick={() => setActivePlatform(platform.id)}
                  className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-all ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  {platform.isLucide ? (
                    <Sparkles size={18} strokeWidth={1.6} />
                  ) : (
                    <img src={platform.iconSrc} alt={platform.label} className="w-[18px] h-[18px]" />
                  )}
                  <span className="whitespace-nowrap">{platform.label}</span>
                  {platform.comingSoon && (
                    <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      Soon
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto py-4 px-6">
          {/* Quick actions */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Quick actions
            </h3>
            <div className="flex gap-3 flex-wrap">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => onStartWizard("android")}
                  className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl bg-muted/40 border border-border/50 hover:border-primary/30 hover:bg-muted/60 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <Zap size={18} className="text-primary" />
                  </div>
                  <span className="text-xs font-medium text-foreground whitespace-nowrap">
                    {action.label}
                  </span>
                  {action.badge && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
                      {action.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Create new section */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Create new
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {createTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => onStartWizard(template.platform)}
                  className={`flex flex-col gap-2 p-4 rounded-xl bg-gradient-to-br ${template.gradient} border border-border/50 hover:border-primary/30 transition-all group text-left`}
                >
                  <div className="w-full aspect-[16/10] rounded-lg bg-card/60 flex items-center justify-center">
                    <img
                      src={template.platform === "android" ? androidIcon : appleIcon}
                      alt={template.platform}
                      className="w-8 h-8 opacity-40 group-hover:opacity-60 transition-opacity"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{template.title}</p>
                    <p className="text-xs text-muted-foreground">{template.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Templates section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Templates for you
              </h3>
              <button className="text-xs text-primary hover:underline flex items-center gap-0.5">
                See all <ChevronRight size={12} />
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { name: "E-commerce App", desc: "Full shopping experience" },
                { name: "Social Media App", desc: "Feed, chat, profiles" },
                { name: "Dashboard App", desc: "Analytics & charts" },
                { name: "Blog App", desc: "Content management" },
              ].map((tmpl, i) => (
                <button
                  key={i}
                  className="flex flex-col gap-2 p-3 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all text-left"
                >
                  <div className="w-full aspect-[4/3] rounded-lg bg-gradient-to-br from-muted to-muted/50" />
                  <div>
                    <p className="text-xs font-medium text-foreground">{tmpl.name}</p>
                    <p className="text-[10px] text-muted-foreground">{tmpl.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateAppDialog;

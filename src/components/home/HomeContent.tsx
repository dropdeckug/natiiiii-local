import { useState, useEffect } from "react";
import { Search, Settings2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import androidIcon from "@/assets/platforms/android.svg";
import appleIcon from "@/assets/platforms/apple.svg";
import windowsIcon from "@/assets/platforms/windows.svg";
import linuxIcon from "@/assets/platforms/linux.svg";
import webIcon from "@/assets/platforms/web.svg";

interface HomeContentProps {
  onCreateClick: () => void;
}

const categories = [
  { id: "android", label: "Android", icon: androidIcon, color: "#3DDC84" },
  { id: "ios", label: "iOS", icon: appleIcon, color: "#FFFFFF" },
  { id: "windows", label: "Windows", icon: windowsIcon, color: "#0078D4" },
  { id: "linux", label: "Linux", icon: linuxIcon, color: "#FCC624" },
  { id: "web", label: "Web App", icon: webIcon, color: "#4285F4" },
];

const recentCards = [
  { id: 1, name: "My React App", platform: "Android", time: "Edited 1 hour ago", color: "#3DDC84" },
  { id: 2, name: "E-commerce PWA", platform: "iOS", time: "Edited 2 hours ago", color: "#FFFFFF" },
  { id: 3, name: "Dashboard", platform: "Web", time: "Edited 5 hours ago", color: "#4285F4" },
  { id: 4, name: "Portfolio Site", platform: "Android", time: "Edited 1 day ago", color: "#3DDC84" },
  { id: 5, name: "Chat App", platform: "iOS", time: "Edited 2 days ago", color: "#FFFFFF" },
  { id: 6, name: "Admin Panel", platform: "Web", time: "Edited 3 days ago", color: "#4285F4" },
];

const HomeContent = ({ onCreateClick }: HomeContentProps) => {
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Hero gradient banner */}
      <div className="relative px-8 pt-12 pb-10 bg-gradient-to-br from-primary/20 via-accent/10 to-[hsl(var(--success))]/10 rounded-b-3xl mx-4 mt-2">
        <h1 className="text-2xl md:text-3xl font-medium text-center text-foreground mb-6">
          What will you build today?
        </h1>

        {/* Tab pills */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <button className="px-4 py-1.5 rounded-full bg-card border border-border text-sm font-medium text-foreground flex items-center gap-1.5">
            📱 Your apps
          </button>
          <button className="px-4 py-1.5 rounded-full text-sm text-muted-foreground hover:bg-card/50 transition-colors flex items-center gap-1.5">
            📂 Templates
          </button>
        </div>

        {/* Search bar */}
        <div className="max-w-xl mx-auto relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Search apps, templates, and uploads"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-12 py-3 rounded-full bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all"
          />
          <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground">
            <Settings2 size={16} />
          </button>
        </div>
      </div>

      {/* Platform categories row */}
      <div className="px-8 mt-8">
        <div className="flex items-start justify-center gap-6 md:gap-10 flex-wrap">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <Skeleton className="w-14 h-14 rounded-2xl" />
                  <Skeleton className="w-12 h-3 rounded" />
                </div>
              ))
            : categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={onCreateClick}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center group-hover:border-primary/40 group-hover:shadow-lg group-hover:shadow-primary/5 transition-all duration-200 group-active:scale-95">
                    <img src={cat.icon} alt={cat.label} className="w-7 h-7" />
                  </div>
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                    {cat.label}
                  </span>
                </button>
              ))}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-2">
          Build native
        </p>
      </div>

      {/* Recents section */}
      <div className="px-8 mt-10 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-foreground">Recents</h2>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:bg-muted/60 transition-colors">
              Owner ▾
            </button>
            <button className="px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:bg-muted/60 transition-colors">
              Any type ▾
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="w-full aspect-[4/3] rounded-xl" />
                  <Skeleton className="w-3/4 h-3 rounded" />
                  <Skeleton className="w-1/2 h-2.5 rounded" />
                </div>
              ))
            : recentCards.map((card) => (
                <button
                  key={card.id}
                  className="flex flex-col gap-2 group text-left"
                >
                  <div className="w-full aspect-[4/3] rounded-xl bg-card border border-border flex items-center justify-center group-hover:border-primary/30 group-hover:shadow-lg group-hover:shadow-primary/5 transition-all duration-200">
                    <div
                      className="w-10 h-10 rounded-lg opacity-60"
                      style={{ backgroundColor: card.color }}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground truncate">
                      {card.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {card.platform} · {card.time}
                    </p>
                  </div>
                </button>
              ))}
        </div>
      </div>
    </div>
  );
};

export default HomeContent;

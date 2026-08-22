import { useState } from "react";
import { Plus, Zap, Smartphone, Globe, Package, ArrowRight, MoreHorizontal, Heart, MessageSquare, Share, BarChart3 } from "lucide-react";
import androidIcon from "@/assets/platforms/android.svg";
import appleIcon from "@/assets/platforms/apple.svg";

interface XFeedProps {
  onCreateClick: () => void;
}

const tabs = ["For you", "Following", "Builds"];

const feedItems = [
  {
    id: 1,
    user: "NativeBridge",
    handle: "@nativebridge",
    time: "2h",
    content: "🚀 Convert your React app to Android APK in minutes. Upload your source, configure plugins, and build!",
    likes: 42,
    replies: 12,
    shares: 8,
    views: "1.2K",
  },
  {
    id: 2,
    user: "My React App",
    handle: "@myreactapp",
    time: "5h",
    content: "Build completed successfully ✅\nPlatform: Android\nEngine: Capacitor\nSize: 12.4 MB",
    likes: 18,
    replies: 3,
    shares: 2,
    views: "456",
    isProject: true,
    platform: "android",
  },
  {
    id: 3,
    user: "E-commerce PWA",
    handle: "@ecommerce_pwa",
    time: "1d",
    content: "WebView wrapper build started 🔨\nURL: https://myshop.com\nPlugins: Camera, Geolocation, Push Notifications",
    likes: 7,
    replies: 1,
    shares: 0,
    views: "128",
    isProject: true,
    platform: "android",
  },
  {
    id: 4,
    user: "Forge AI",
    handle: "@forge_ai",
    time: "3h",
    content: "💡 Pro tip: Use Capacitor plugins to access native device features like Camera, GPS, and Push Notifications in your web app.",
    likes: 89,
    replies: 24,
    shares: 31,
    views: "4.5K",
  },
];

const XFeed = ({ onCreateClick }: XFeedProps) => {
  const [activeTab, setActiveTab] = useState("For you");

  return (
    <div className="min-h-screen border-x border-border max-w-[600px] w-full">
      {/* Header with tabs */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-border">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-4 text-[15px] font-medium text-center hover:bg-muted/50 transition-colors relative"
            >
              <span className={activeTab === tab ? "text-foreground font-bold" : "text-muted-foreground"}>
                {tab}
              </span>
              {activeTab === tab && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Create prompt */}
      <div className="px-4 py-4 border-b border-border flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-[hsl(var(--success))] flex items-center justify-center flex-shrink-0 mt-1">
          <Smartphone size={18} className="text-primary-foreground" />
        </div>
        <div className="flex-1">
          <button
            onClick={onCreateClick}
            className="text-xl text-muted-foreground text-left w-full py-2"
          >
            What are you building?
          </button>
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="flex items-center gap-1">
              <button className="p-2 rounded-full hover:bg-primary/10 text-primary transition-colors">
                <Globe size={20} />
              </button>
              <button className="p-2 rounded-full hover:bg-primary/10 text-primary transition-colors">
                <Package size={20} />
              </button>
              <button className="p-2 rounded-full hover:bg-primary/10 text-primary transition-colors">
                <Zap size={20} />
              </button>
            </div>
            <button
              onClick={onCreateClick}
              className="px-5 py-1.5 rounded-full bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
            >
              Create
            </button>
          </div>
        </div>
      </div>

      {/* Feed items */}
      {feedItems.map((item) => (
        <div key={item.id} className="px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              {item.isProject ? (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <img
                    src={item.platform === "android" ? androidIcon : appleIcon}
                    alt=""
                    className="w-5 h-5"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Zap size={18} className="text-primary" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[15px] text-foreground truncate">{item.user}</span>
                <span className="text-muted-foreground text-[15px] truncate">{item.handle}</span>
                <span className="text-muted-foreground text-[15px]">·</span>
                <span className="text-muted-foreground text-[15px]">{item.time}</span>
                <div className="ml-auto">
                  <MoreHorizontal size={18} className="text-muted-foreground" />
                </div>
              </div>
              <p className="text-[15px] text-foreground whitespace-pre-line mt-0.5 leading-relaxed">
                {item.content}
              </p>
              {/* Actions */}
              <div className="flex items-center justify-between mt-3 max-w-[425px]">
                <button className="flex items-center gap-1.5 text-muted-foreground hover:text-primary group transition-colors">
                  <div className="p-2 rounded-full group-hover:bg-primary/10 transition-colors">
                    <MessageSquare size={16} />
                  </div>
                  <span className="text-[13px]">{item.replies}</span>
                </button>
                <button className="flex items-center gap-1.5 text-muted-foreground hover:text-[hsl(var(--success))] group transition-colors">
                  <div className="p-2 rounded-full group-hover:bg-[hsl(var(--success))]/10 transition-colors">
                    <Share size={16} />
                  </div>
                  <span className="text-[13px]">{item.shares}</span>
                </button>
                <button className="flex items-center gap-1.5 text-muted-foreground hover:text-[hsl(0,80%,60%)] group transition-colors">
                  <div className="p-2 rounded-full group-hover:bg-[hsl(0,80%,60%)]/10 transition-colors">
                    <Heart size={16} />
                  </div>
                  <span className="text-[13px]">{item.likes}</span>
                </button>
                <button className="flex items-center gap-1.5 text-muted-foreground hover:text-primary group transition-colors">
                  <div className="p-2 rounded-full group-hover:bg-primary/10 transition-colors">
                    <BarChart3 size={16} />
                  </div>
                  <span className="text-[13px]">{item.views}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Show more */}
      <div className="py-6 text-center">
        <button className="text-primary text-[15px] hover:underline">
          Show more
        </button>
      </div>

      {/* Bottom padding for mobile nav */}
      <div className="h-16 md:hidden" />
    </div>
  );
};

export default XFeed;

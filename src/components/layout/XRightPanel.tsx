import { Search } from "lucide-react";

const trendingItems = [
  { category: "Technology", topic: "Capacitor", posts: "2.5K posts" },
  { category: "Development", topic: "React Native", posts: "15.2K posts" },
  { category: "Trending", topic: "#WebToNative", posts: "890 posts" },
  { category: "Technology", topic: "Android Studio", posts: "5.1K posts" },
  { category: "Development", topic: "PWA", posts: "3.8K posts" },
];

const suggestedUsers = [
  { name: "Capacitor Team", handle: "@capacitorjs", avatar: "⚡" },
  { name: "Ionic Framework", handle: "@ionicframework", avatar: "💎" },
  { name: "Android Dev", handle: "@AndroidDev", avatar: "🤖" },
];

const XRightPanel = () => {
  return (
    <div className="w-[350px] pl-7 py-2 h-screen sticky top-0 overflow-y-auto hidden lg:block">
      {/* Search */}
      <div className="relative mb-3 sticky top-0 bg-background py-1 z-10">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search"
          className="x-search-input"
        />
      </div>

      {/* Trending */}
      <div className="x-card mb-4">
        <h2 className="text-xl font-bold text-foreground px-4 pt-3 pb-2">
          What's happening
        </h2>
        {trendingItems.map((item, i) => (
          <div key={i} className="x-trend-item">
            <p className="text-[13px] text-muted-foreground">{item.category}</p>
            <p className="text-[15px] font-bold text-foreground">{item.topic}</p>
            <p className="text-[13px] text-muted-foreground">{item.posts}</p>
          </div>
        ))}
        <button className="px-4 py-3 text-primary text-[15px] hover:bg-muted/30 w-full text-left transition-colors">
          Show more
        </button>
      </div>

      {/* Who to follow */}
      <div className="x-card mb-4">
        <h2 className="text-xl font-bold text-foreground px-4 pt-3 pb-2">
          Who to follow
        </h2>
        {suggestedUsers.map((user, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg flex-shrink-0">
              {user.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-foreground truncate">{user.name}</p>
              <p className="text-[13px] text-muted-foreground truncate">{user.handle}</p>
            </div>
            <button className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity flex-shrink-0">
              Follow
            </button>
          </div>
        ))}
        <button className="px-4 py-3 text-primary text-[15px] hover:bg-muted/30 w-full text-left transition-colors">
          Show more
        </button>
      </div>

      {/* Footer links */}
      <div className="px-4 pb-6">
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          Terms of Service · Privacy Policy · Cookie Policy · Accessibility · Ads info · More ···  © 2026 NativeBridge
        </p>
      </div>
    </div>
  );
};

export default XRightPanel;

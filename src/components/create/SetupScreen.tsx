import { useEffect } from "react";
import { Loader2 } from "lucide-react";

interface SetupScreenProps {
  platform: string;
  onComplete: () => void;
}

const SetupScreen = ({ platform, onComplete }: SetupScreenProps) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="max-w-md mx-auto text-center py-16">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
        <Loader2 size={36} className="text-primary animate-spin" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">
        Setting up your environment
      </h2>
      <p className="text-sm text-muted-foreground">
        Preparing {platform === "android" ? "Android" : platform} build tools…
      </p>
      <div className="mt-8 flex justify-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-primary animate-pulse"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>
    </div>
  );
};

export default SetupScreen;

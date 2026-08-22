import capacitorIcon from "@/assets/icons/capacitor.svg";
import ionicIcon from "@/assets/icons/ionic.svg";
import chromeIcon from "@/assets/icons/chrome.svg";
import webviewIcon from "@/assets/icons/webview.svg";
import androidIcon from "@/assets/platforms/android.svg";
import appleIcon from "@/assets/platforms/apple.svg";
import linuxIcon from "@/assets/platforms/linux.svg";
import windowsIcon from "@/assets/platforms/windows.svg";
import webIcon from "@/assets/platforms/web.svg";

const highlights = [
  {
    title: "Zero-config builds",
    description: "Upload your web app source code and get a native APK. No Android Studio, no Gradle, no JDK setup required.",
  },
  {
    title: "Cloud-powered pipeline",
    description: "Builds run on cloud infrastructure with GitHub Actions. Fast, reliable, and always up-to-date with the latest SDK versions.",
  },
  {
    title: "Enterprise-grade signing",
    description: "Generate debug APKs instantly or configure release signing with your own keystore for Google Play submissions.",
  },
];

const tools = [
  { name: "Capacitor", icon: capacitorIcon },
  { name: "Ionic", icon: ionicIcon },
  { name: "WebView", icon: webviewIcon },
  { name: "Chrome TWA", icon: chromeIcon },
  { name: "Android", icon: androidIcon },
  { name: "iOS", icon: appleIcon },
  { name: "Windows", icon: windowsIcon },
  { name: "Linux", icon: linuxIcon },
  { name: "Web", icon: webIcon },
];

const Features = () => {
  return (
    <section className="py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-foreground text-3xl sm:text-4xl font-bold text-center mb-3">
          All the tools you need and a few more you'll love.
        </h2>
        <p className="text-muted-foreground text-base text-center mb-16 max-w-lg mx-auto">
          Everything to go from web app to native mobile app, without changing your stack.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-20">
          {highlights.map((h) => (
            <div key={h.title} className="text-center">
              <h3 className="text-foreground text-lg font-semibold mb-3">{h.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">{h.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <h3 className="text-foreground text-lg font-semibold mb-10">NativeBridge supports:</h3>
          <div className="flex flex-wrap justify-center gap-8 sm:gap-10">
            {tools.map((tool) => (
              <div key={tool.name} className="flex flex-col items-center gap-2.5 w-16">
                <div className="w-12 h-12 flex items-center justify-center">
                  <img src={tool.icon} alt={tool.name} className="w-10 h-10" />
                </div>
                <span className="text-muted-foreground text-xs font-medium">{tool.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;

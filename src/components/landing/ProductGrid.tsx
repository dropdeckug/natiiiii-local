import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { productItems } from "@/data/marketing";

/* ── Minimal UI illustrations (token-driven, no raster assets) ───────── */

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="relative h-40 w-full overflow-hidden rounded-lg border border-border/70 bg-background/60">
    {children}
  </div>
);

const AndroidIllustration = () => (
  <Frame>
    <div className="absolute inset-x-6 top-6 space-y-2">
      {["app-release.apk", "app-release.aab", "mapping.txt"].map((f, i) => (
        <div key={f} className="flex items-center justify-between rounded-md border border-border/70 bg-card px-3 py-2">
          <span className="font-mono text-[11px] text-foreground">{f}</span>
          <span className={`text-[10px] ${i === 2 ? "text-muted-foreground" : "text-primary"}`}>
            {i === 2 ? "12 KB" : "signed"}
          </span>
        </div>
      ))}
    </div>
    <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent" />
  </Frame>
);

const IosIllustration = () => (
  <Frame>
    <div className="absolute left-1/2 top-6 h-40 w-24 -translate-x-1/2 rounded-[1.2rem] border border-border bg-card p-2">
      <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-border" />
      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-[4px] bg-primary/20" style={{ opacity: 1 - i * 0.07 }} />
        ))}
      </div>
    </div>
  </Frame>
);

const DesktopIllustration = () => (
  <Frame>
    <div className="absolute inset-6 grid grid-cols-3 gap-2">
      {["exe", "dmg", "AppImage"].map((k) => (
        <div key={k} className="flex flex-col items-center justify-center gap-2 rounded-md border border-border/70 bg-card py-4">
          <div className="h-6 w-6 rounded-md bg-primary/25" />
          <span className="font-mono text-[10px] text-muted-foreground">.{k}</span>
        </div>
      ))}
    </div>
  </Frame>
);

const PluginIllustration = () => (
  <Frame>
    <div className="absolute inset-x-6 top-5 space-y-1.5">
      {["@capacitor/camera", "@capawesome/file-picker", "@capacitor/push", "@capawesome/badge"].map((p, i) => (
        <div key={p} className="flex items-center gap-2 rounded-md border border-border/70 bg-card px-2.5 py-1.5">
          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-primary/20 text-primary">
            {i < 2 && <Check size={10} />}
          </span>
          <span className="truncate font-mono text-[10.5px] text-muted-foreground">{p}</span>
        </div>
      ))}
    </div>
  </Frame>
);

const SigningIllustration = () => (
  <Frame>
    <div className="absolute inset-6 rounded-md border border-border/70 bg-card p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">SHA-256</p>
      <p className="mt-2 break-all font-mono text-[10px] leading-relaxed text-primary">
        9F:2C:AB:71:04:E8:5D:33:B0:6A:12:77:CE:44:90:1F
      </p>
      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">upload key</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">reused</span>
      </div>
    </div>
  </Frame>
);

const AgentIllustration = () => (
  <Frame>
    <div className="absolute inset-x-6 top-5 space-y-2 font-mono text-[10.5px]">
      {[
        ["read", "android/app/build.gradle"],
        ["patch", "MainActivity.java"],
        ["write", "capacitor.config.json"],
        ["build", "green"],
      ].map(([verb, target]) => (
        <div key={target} className="flex items-center gap-2">
          <span className="w-11 shrink-0 text-primary">{verb}</span>
          <span className="truncate text-muted-foreground">{target}</span>
        </div>
      ))}
    </div>
    <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />
  </Frame>
);

const illustrations = [
  AndroidIllustration,
  IosIllustration,
  DesktopIllustration,
  PluginIllustration,
  SigningIllustration,
  AgentIllustration,
];

const highlights: string[][] = [
  ["APK + AAB in one run", "Exact-ratio icon generation", "Cached Gradle runners"],
  ["Managed macOS runners", "Provisioning + certificates", "TestFlight-ready IPA"],
  ["Windows, macOS, Linux", "AppImage · DEB · RPM", "Electron configured for you"],
  ["Capacitor + Capawesome", "Entry points auto-detected", "Permissions written for you"],
  ["Captured on first build", "Fingerprints always visible", "Reused on every rebuild"],
  ["Multi-file native edits", "Grounded in official docs", "Loops until the build passes"],
];

const ProductGrid = () => (
  <section className="px-6 py-24">
    <div className="mx-auto max-w-7xl">
      <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Everything you need to ship native
      </h2>
      <p className="mt-3 max-w-xl text-base text-muted-foreground">
        Each product is a fully managed piece of the pipeline. Use one, or let them work together on the
        same project source.
      </p>

      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {productItems.map((item, i) => {
          const Illustration = illustrations[i];
          return (
            <Link
              key={item.slug}
              to={item.to}
              className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <div className="mb-5 flex items-center gap-2.5">
                <item.icon size={18} className="text-primary" />
                <h3 className="text-base font-medium text-foreground">{item.label}</h3>
              </div>

              <Illustration />

              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{item.desc}.</p>

              <ul className="mt-4 space-y-2">
                {highlights[i].map((h) => (
                  <li key={h} className="flex items-start gap-2 text-[13px] text-muted-foreground">
                    <Check size={14} className="mt-0.5 shrink-0 text-primary" />
                    {h}
                  </li>
                ))}
              </ul>

              <span className="mt-5 inline-flex items-center gap-1 text-[13px] font-medium text-primary">
                Learn more
                <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  </section>
);

export default ProductGrid;

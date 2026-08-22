import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { AppleIcon } from "@/components/pricing/BrandIcon";
import { PricingCards, SUPPORTED, RenderIcon } from "@/components/pricing/PricingTiers";

const Pricing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-10 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-normal tracking-tight">
            Try NativeForge for 14 days
          </h1>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            One platform to package, sign, and ship every build target — from Android APK to notarized macOS DMG.
          </p>
        </div>
      </section>

      {/* Supported targets bar */}
      <section className="px-6">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-t-2xl bg-muted text-foreground px-6 py-4 flex flex-wrap items-center justify-between gap-4 border border-border border-b-0">
            <span className="text-sm text-muted-foreground">Supported build targets</span>
            <div className="flex items-center gap-5 flex-wrap">
              {SUPPORTED.map((p) => (
                <div key={p.label} className="flex items-center gap-2" title={p.label}>
                  <RenderIcon icon={p} size={22} />
                  <span className="text-[13px] text-muted-foreground hidden sm:inline">{p.label}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Annual</span>
              <span className="text-primary">(Save 20% with one-year commitment)</span>
              <div className="relative w-9 h-5 rounded-full bg-primary">
                <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-primary-foreground" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto rounded-b-2xl bg-muted p-4 border border-border border-t-0">
          <PricingCards />
        </div>

        <div className="max-w-3xl mx-auto mt-12 text-center space-y-3">
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            Extra credits available anytime at <span className="text-foreground">$0.40 / credit</span> — no expiry.
            Credits are only consumed when a build actually runs; cancelled builds refund unused credits automatically.
          </p>
          <p className="text-muted-foreground text-[12px] leading-relaxed flex items-center justify-center gap-2 flex-wrap">
            <AppleIcon size={14} className="opacity-70" />
            iOS and macOS builds require an Apple Developer account ($99/year) purchased separately from Apple.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Pricing;

import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";

const proof = ["Android APK + AAB", "iOS IPA", "Windows · macOS · Linux"];

const Hero = () => {
  return (
    <section className="relative flex min-h-[86vh] items-center overflow-hidden px-6 pt-24">
      {/* Soft token-based ambience — no photography */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]"
      />

      <div className="relative mx-auto w-full max-w-7xl">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-[60px]">

            Turn your web app into a{" "}
            <span className="gradient-text">native app</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Upload your source or connect a repo. We ground the project, wire the plugins, capture your
            signing keys and hand back store-ready artifacts — in minutes, not weeks.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-bold text-primary-foreground transition-all hover:brightness-110"
            >
              Start building free
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/docs"
              className="inline-flex items-center gap-2 rounded-full border border-border px-7 py-3 text-sm font-medium text-foreground transition-all hover:bg-muted/60"
            >
              Read the docs
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {proof.map((p) => (
              <li key={p} className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Check size={14} className="text-primary" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default Hero;

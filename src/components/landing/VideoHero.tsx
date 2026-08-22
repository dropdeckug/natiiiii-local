import { useEffect, useRef, useState } from "react";
import videoAsset from "@/assets/prompt_builder_particles.mp4.asset.json";

const PHRASES = [
  "Turn code into apps",
  "Ship native in minutes",
  "Powered by AI",
  "Build. Sign. Deploy.",
];

const VideoHero = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [inView, setInView] = useState(false);

  // Force body/html to black while section is in view
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio > 0.35),
      { threshold: [0, 0.35, 0.6, 1] }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    const prevBody = document.body.style.backgroundColor;
    const prevHtml = document.documentElement.style.backgroundColor;
    document.body.style.backgroundColor = "#000";
    document.documentElement.style.backgroundColor = "#000";
    return () => {
      document.body.style.backgroundColor = prevBody;
      document.documentElement.style.backgroundColor = prevHtml;
    };
  }, [inView]);

  // Cycle phrases
  useEffect(() => {
    const t = setInterval(() => setPhraseIdx((i) => (i + 1) % PHRASES.length), 3200);
    return () => clearInterval(t);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-full min-h-screen overflow-hidden bg-black text-white flex items-center justify-center"
    >
      <video
        className="absolute inset-0 w-full h-full object-cover opacity-70"
        src={videoAsset.url}
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/80 pointer-events-none" />

      <div className="relative z-10 text-center px-6 max-w-5xl">
        <p className="text-white/60 text-sm tracking-[0.3em] uppercase mb-6">
          NativeBridge
        </p>
        <h2 className="font-bold tracking-tight text-5xl sm:text-7xl lg:text-8xl leading-[1.05]">
          <span className="block text-white/90">Every idea</span>
          <span
            key={phraseIdx}
            className="block bg-gradient-to-r from-white via-white/80 to-white/40 bg-clip-text text-transparent animate-fade-in"
          >
            {PHRASES[phraseIdx]}
          </span>
        </h2>
        <p className="mt-8 text-white/70 text-lg max-w-xl mx-auto">
          From web repo to signed APK — one prompt, one platform, zero DevOps.
        </p>
      </div>
    </section>
  );
};

export default VideoHero;

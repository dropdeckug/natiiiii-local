import { Github, MessageCircle, Twitter } from "lucide-react";

interface Testimonial {
  name: string;
  handle: string;
  text: string;
}

const testimonials: Testimonial[] = [
  { name: "Amara Osei", handle: "@amaracodes", text: "Uploaded a plain HTML site, got a signed APK and AAB back in six minutes. No Android Studio anywhere near my laptop." },
  { name: "Devon Reyes", handle: "@dvnbuilds", text: "The signing vault alone is worth it. Keys captured on build one, reused forever — store updates just work." },
  { name: "Lina Kovač", handle: "@linakvc", text: "Enabled three Capawesome plugins and the agent wired the manifest, Gradle and permissions without me touching Java." },
  { name: "Tobi Adeyemi", handle: "@tobiships", text: "Our agency runs eleven client apps here. One dashboard, isolated keys per project. Massive." },
  { name: "Priya Nair", handle: "@priyanair.dev", text: "Icon generation matched every Android density exactly. First time my launcher icon wasn't squashed." },
  { name: "Marc Dubois", handle: "@marcdbs", text: "iOS and Android artifacts from the same source of truth. I stopped maintaining two repos." },
  { name: "Sara Lindqvist", handle: "@saralnd", text: "Build logs are phase-by-phase and readable. When something breaks I know exactly which step failed." },
  { name: "Kwame Boateng", handle: "@kwamebt", text: "The repair loop fixed a Gradle version conflict on its own and re-ran the build. I watched it happen." },
  { name: "Elena Rossi", handle: "@elenarossi", text: "Desktop packaging as a bonus — AppImage, DEB and RPM from the same project. Didn't expect that." },
  { name: "Jonas Weber", handle: "@jonasw", text: "Cloned a repo, hit build, downloaded the AAB, uploaded to Play Console. That was the whole workflow." },
  { name: "Nadia Haddad", handle: "@nadiahdd", text: "Teaching a mobile class with this. Students ship real devices builds without installing 12 GB of tooling." },
  { name: "Ryan Cole", handle: "@rycole", text: "Plugin search with copyable snippets saved me an afternoon of docs archaeology." },
];

const Card = ({ t }: { t: Testimonial }) => (
  <figure className="mx-2 w-[300px] shrink-0 rounded-xl border border-border bg-card p-5 sm:w-[340px]">
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
        {t.name.split(" ").map((n) => n[0]).join("")}
      </div>
      <figcaption className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{t.name}</p>
        <p className="truncate text-xs text-muted-foreground">{t.handle}</p>
      </figcaption>
      <Twitter size={15} className="ml-auto shrink-0 text-muted-foreground" />
    </div>
    <blockquote className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">{t.text}</blockquote>
  </figure>
);

const Row = ({ items, reverse, duration }: { items: Testimonial[]; reverse?: boolean; duration: number }) => (
  <div className="flex w-max" style={{ animation: `nf-marquee ${duration}s linear infinite${reverse ? " reverse" : ""}` }}>
    {[...items, ...items].map((t, i) => (
      <Card key={`${t.handle}-${i}`} t={t} />
    ))}
  </div>
);

const Community = () => {
  const rows = [testimonials.slice(0, 4), testimonials.slice(4, 8), testimonials.slice(8, 12)];

  return (
    <section className="overflow-hidden py-24">
      <div className="mx-auto max-w-7xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Join the community</h2>
        <p className="mx-auto mt-3 max-w-lg text-base text-muted-foreground">
          Discover what our community has to say about their NativeForge experience.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <Github size={15} /> GitHub discussions
          </a>
          <a
            href="https://discord.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <MessageCircle size={15} /> Discord
          </a>
        </div>
      </div>

      <div className="relative mt-12 space-y-4 nf-marquee-mask">
        <Row items={rows[0]} duration={46} />
        <Row items={rows[1]} duration={58} reverse />
        <Row items={rows[2]} duration={52} />
      </div>
    </section>
  );
};

export default Community;

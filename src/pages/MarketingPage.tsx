import { Link, useParams } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import NotFound from "@/pages/NotFound";
import { marketingPages } from "@/data/marketing";

/** Generic marketing page driven by src/data/marketing.ts */
const MarketingPage = () => {
  const { slug = "" } = useParams();
  const content = marketingPages[slug];

  if (!content) return <NotFound />;

  const Icon = content.icon;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <header className="relative overflow-hidden px-6 pb-16 pt-36">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/3 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]"
        />
        <div className="relative mx-auto max-w-4xl">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">{content.eyebrow}</p>
          <div className="mt-4 flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-card text-primary">
              <Icon size={22} />
            </span>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{content.title}</h1>
          </div>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">{content.subtitle}</p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-bold text-primary-foreground transition-all hover:brightness-110"
            >
              Start building free
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/docs"
              className="inline-flex items-center rounded-full border border-border px-7 py-3 text-sm font-medium text-foreground transition-all hover:bg-muted/60"
            >
              Read the docs
            </Link>
          </div>
        </div>
      </header>

      <section className="px-6 pb-24">
        <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-3">
          {content.bullets.map((b) => (
            <article key={b.title} className="rounded-xl border border-border bg-card p-6">
              <Check size={16} className="text-primary" />
              <h2 className="mt-4 text-base font-medium text-foreground">{b.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.desc}</p>
            </article>
          ))}
        </div>

        <div className="mx-auto mt-16 max-w-4xl rounded-2xl border border-border bg-card p-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Ready when you are</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Create a project, point it at your source, and run your first build in minutes.
          </p>
          <Link
            to="/auth"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-bold text-primary-foreground transition-all hover:brightness-110"
          >
            Create a project
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default MarketingPage;

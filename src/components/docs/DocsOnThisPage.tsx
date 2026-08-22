import { useEffect, useState, useRef } from "react";

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface DocsOnThisPageProps {
  contentRef: React.RefObject<HTMLDivElement>;
}

const DocsOnThisPage = ({ contentRef }: DocsOnThisPageProps) => {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState("");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const updateHeadings = () => {
      const els = container.querySelectorAll("h2[id], h3[id]");
      const h: Heading[] = [];
      els.forEach((el) => {
        h.push({
          id: el.id,
          text: el.textContent || "",
          level: el.tagName === "H2" ? 2 : 3,
        });
      });
      setHeadings(h);
    };

    updateHeadings();

    // MutationObserver for dynamic content
    const mo = new MutationObserver(updateHeadings);
    mo.observe(container, { childList: true, subtree: true });

    return () => mo.disconnect();
  }, [contentRef]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container || headings.length === 0) return;

    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          // Pick the topmost visible heading
          const sorted = visible.sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          );
          setActiveId(sorted[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observerRef.current!.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [headings, contentRef]);

  if (headings.length === 0) return null;

  return (
    <aside className="w-[200px] shrink-0 hidden xl:block sticky top-14 h-[calc(100vh-56px)] overflow-y-auto">
      <div className="py-6 px-4">
        <p className="text-[11px] text-[#555] font-semibold uppercase tracking-wider mb-3">
          On this page
        </p>
        <div className="space-y-0.5">
          {headings.map((h) => (
            <button
              key={h.id}
              onClick={() => {
                const el = document.getElementById(h.id);
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={`block w-full text-left text-[12px] py-1 transition-colors border-l-2 ${
                h.level === 3 ? "pl-5" : "pl-3"
              } ${
                activeId === h.id
                  ? "border-emerald-400 text-emerald-400 font-medium"
                  : "border-transparent text-[#666] hover:text-[#aaa] hover:border-[#444]"
              }`}
            >
              {h.text}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default DocsOnThisPage;

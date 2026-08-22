import { useRef, useState, useCallback, useEffect } from "react";
import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsOnThisPage from "@/components/docs/DocsOnThisPage";
import DocsContent from "@/components/docs/DocsContent";

const Docs = () => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState("what-is-nativebridge");

  const handleNavigate = useCallback((id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Scroll-spy to update activeSection on scroll
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          const sorted = visible.sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          );
          setActiveSection(sorted[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    const headings = container.querySelectorAll("[id]");
    headings.forEach((el) => {
      if (el.tagName === "H2" || el.tagName === "H3" || el.tagName === "SECTION" || el.tagName === "DIV") {
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white">
      <DocsNavbar onNavigate={handleNavigate} />

      <div className="flex pt-14">
        <DocsSidebar activeSection={activeSection} onNavigate={handleNavigate} />

        <main className="flex-1 flex min-w-0">
          <DocsContent ref={contentRef} />
          <DocsOnThisPage contentRef={contentRef} />
        </main>
      </div>
    </div>
  );
};

export default Docs;

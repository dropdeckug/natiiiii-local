import { Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Menu, X, Search } from "lucide-react";
import NativeBridgeLogo from "@/components/layout/NativeBridgeLogo";

interface DropdownItem {
  label: string;
  desc: string;
  href: string;
}

interface NavDropdown {
  label: string;
  items: DropdownItem[];
}

const dropdowns: NavDropdown[] = [
  {
    label: "Product",
    items: [
      { label: "Build Engines", desc: "Capacitor, WebView, TWA, Electron", href: "#engines" },
      { label: "Native Plugins", desc: "Camera, GPS, Push, Biometrics & more", href: "#plugins" },
      { label: "AI Assistant", desc: "ForgeAI build intelligence", href: "#ai-assistant" },
      { label: "Build Pipeline", desc: "Automated CI/CD for mobile apps", href: "#build-tools" },
    ],
  },
  {
    label: "Guides",
    items: [
      { label: "Quick Start", desc: "Build your first APK in 5 minutes", href: "#quick-start" },
      { label: "GitHub Integration", desc: "Connect repos & auto-build", href: "#github-integration" },
      { label: "App Signing", desc: "Keystores & Play Store deployment", href: "#signing" },
      { label: "Project Structure", desc: "Generated file tree walkthrough", href: "#project-structure" },
    ],
  },
  {
    label: "Reference",
    items: [
      { label: "SDK Versions", desc: "Android SDK & Gradle version matrix", href: "#sdk-reference" },
      { label: "Plugin API", desc: "All plugin permissions & configs", href: "#plugins" },
      { label: "Build Config", desc: "Gradle, AGP, JDK configuration", href: "#build-config" },
      { label: "FAQ", desc: "Common questions answered", href: "#faq" },
    ],
  },
];

interface DocsNavbarProps {
  onNavigate: (id: string) => void;
}

const DocsNavbar = ({ onNavigate }: DocsNavbarProps) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const handleMouseEnter = (label: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpenDropdown(label);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = window.setTimeout(() => setOpenDropdown(null), 200);
  };

  const handleNavClick = (href: string) => {
    const id = href.replace("#", "");
    onNavigate(id);
    setOpenDropdown(null);
    setMobileOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#111]/95 backdrop-blur-md border-b border-[#222]">
      <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <NativeBridgeLogo size={26} />
          <span className="text-white text-base font-semibold tracking-tight">NativeBridge</span>
          <span className="text-[#555] text-xs font-medium ml-1">Docs</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-1">
          {dropdowns.map((dd) => (
            <div
              key={dd.label}
              className="relative"
              onMouseEnter={() => handleMouseEnter(dd.label)}
              onMouseLeave={handleMouseLeave}
            >
              <button className="flex items-center gap-1 px-3 py-2 text-[13px] text-[#999] hover:text-white transition-colors rounded-md hover:bg-[#1a1a1a]">
                {dd.label}
                <ChevronDown size={14} className={`transition-transform ${openDropdown === dd.label ? "rotate-180" : ""}`} />
              </button>

              {openDropdown === dd.label && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-[#161616] border border-[#2a2a2a] rounded-xl shadow-2xl p-2 animate-in fade-in slide-in-from-top-1 duration-150">
                  {dd.items.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => handleNavClick(item.href)}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[#1f1f1f] transition-colors group"
                    >
                      <div className="text-[13px] text-white font-medium group-hover:text-emerald-400 transition-colors">{item.label}</div>
                      <div className="text-[11px] text-[#666] mt-0.5">{item.desc}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <Link to="/" className="text-[13px] text-[#888] hover:text-white transition-colors hidden lg:block">Home</Link>
          <Link to="/pricing" className="text-[13px] text-[#888] hover:text-white transition-colors hidden lg:block">Pricing</Link>
          <Link
            to="/auth"
            className="bg-emerald-500 text-black text-[13px] font-semibold px-4 py-1.5 rounded-lg hover:bg-emerald-400 transition-colors hidden sm:block"
          >
            Get started
          </Link>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden text-white p-1.5">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-[#111] border-t border-[#222] px-6 py-4 space-y-3 max-h-[80vh] overflow-y-auto">
          {dropdowns.map((dd) => (
            <div key={dd.label}>
              <p className="text-xs text-[#555] font-semibold uppercase tracking-wider mb-2">{dd.label}</p>
              {dd.items.map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleNavClick(item.href)}
                  className="block w-full text-left px-3 py-2 text-sm text-[#ccc] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
          <div className="border-t border-[#222] pt-3 flex flex-col gap-2">
            <Link to="/" className="text-sm text-[#888] hover:text-white">Home</Link>
            <Link to="/pricing" className="text-sm text-[#888] hover:text-white">Pricing</Link>
            <Link to="/auth" className="bg-emerald-500 text-black text-sm font-semibold px-4 py-2 rounded-lg text-center">Get started</Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default DocsNavbar;

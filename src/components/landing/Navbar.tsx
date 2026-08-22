import { Link } from "react-router-dom";
import { Menu, X, ChevronDown, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import NativeBridgeLogo from "@/components/layout/NativeBridgeLogo";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { productItems, solutionItems, developerItems, type NavItem } from "@/data/marketing";

const MenuGrid = ({
  items,
  footer,
}: {
  items: NavItem[];
  footer: { label: string; to: string };
}) => (
  <div className="w-[min(92vw,620px)] p-2">
    <ul className="grid gap-1 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.slug}>
          <Link
            to={item.to}
            className="group flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted"
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-primary transition-colors group-hover:border-primary/40">
              <item.icon size={17} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{item.label}</span>
              <span className="block text-xs leading-snug text-muted-foreground">{item.desc}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
    <Link
      to={footer.to}
      className="mt-2 flex items-center justify-between rounded-lg border-t border-border px-3 pt-3 text-xs font-medium text-primary hover:underline"
    >
      {footer.label}
      <ArrowRight size={13} />
    </Link>
  </div>
);

const menus = [
  { label: "Product", items: productItems, footer: { label: "See everything we build", to: "/product/android-builds" } },
  { label: "Solutions", items: solutionItems, footer: { label: "Find your use case", to: "/solutions/startups" } },
  { label: "Developers", items: developerItems, footer: { label: "Read the documentation", to: "/docs" } },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || mobileOpen
          ? "bg-background/70 backdrop-blur-xl border-b border-border/60"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <NativeBridgeLogo size={30} />
          <span className="text-foreground text-lg font-bold tracking-tight">NativeForge</span>
        </Link>

        {/* Desktop nav */}
        <NavigationMenu className="hidden lg:flex">
          <NavigationMenuList className="gap-1">
            {menus.map((m) => (
              <NavigationMenuItem key={m.label}>
                <NavigationMenuTrigger className="bg-transparent text-sm font-medium text-muted-foreground hover:text-foreground data-[state=open]:text-foreground">
                  {m.label}
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <MenuGrid items={m.items} footer={m.footer} />
                </NavigationMenuContent>
              </NavigationMenuItem>
            ))}
            <NavigationMenuItem>
              <Link
                to="/pricing"
                className="inline-flex h-9 items-center px-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Pricing
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link
                to="/docs"
                className="inline-flex h-9 items-center px-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Docs
              </Link>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        <div className="flex items-center gap-3">
          <Link
            to="/auth"
            className="text-muted-foreground text-sm font-medium hover:text-foreground transition-colors hidden sm:block"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            className="bg-primary text-primary-foreground text-sm font-semibold px-5 py-2 rounded-full hover:brightness-110 transition-all hidden sm:block"
          >
            Start building
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden text-foreground p-2"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-border/60 bg-background/95 backdrop-blur-xl px-4 pb-8 pt-3">
          {menus.map((m) => {
            const open = openGroup === m.label;
            return (
              <div key={m.label} className="border-b border-border/50">
                <button
                  onClick={() => setOpenGroup(open ? null : m.label)}
                  className="flex w-full items-center justify-between py-3 text-sm font-medium text-foreground"
                  aria-expanded={open}
                >
                  {m.label}
                  <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open && (
                  <ul className="pb-3 space-y-1">
                    {m.items.map((item) => (
                      <li key={item.slug}>
                        <Link
                          to={item.to}
                          onClick={() => setMobileOpen(false)}
                          className="flex items-start gap-3 rounded-lg p-2.5 hover:bg-muted"
                        >
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-primary">
                            <item.icon size={15} />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm text-foreground">{item.label}</span>
                            <span className="block text-xs text-muted-foreground">{item.desc}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          <Link to="/pricing" onClick={() => setMobileOpen(false)} className="block border-b border-border/50 py-3 text-sm font-medium text-foreground">
            Pricing
          </Link>
          <Link to="/about" onClick={() => setMobileOpen(false)} className="block border-b border-border/50 py-3 text-sm font-medium text-foreground">
            About
          </Link>

          <div className="flex flex-col gap-3 pt-5">
            <Link to="/auth" onClick={() => setMobileOpen(false)} className="text-center text-sm font-medium text-primary">
              Sign in
            </Link>
            <Link
              to="/auth"
              onClick={() => setMobileOpen(false)}
              className="bg-primary text-primary-foreground text-sm font-semibold px-6 py-2.5 rounded-full text-center hover:brightness-110 transition-all"
            >
              Start building
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;

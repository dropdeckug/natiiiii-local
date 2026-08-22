import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { AppleIcon, MacOSIcon } from "@/components/pricing/BrandIcon";

import androidIcon from "@/assets/platforms/android.svg";
import windowsIcon from "@/assets/platforms/windows.svg";
import linuxIcon from "@/assets/platforms/ubuntu.svg";
import webIcon from "@/assets/platforms/web.svg";
import capacitorIcon from "@/assets/icons/capacitor.svg";
import chromeIcon from "@/assets/icons/chrome.svg";
import electronIcon from "@/assets/icons/electron.svg";
import pwaIcon from "@/assets/icons/pwa.svg";

type IconKind = "img" | "apple" | "macos";
export interface IconRef {
  kind: IconKind;
  src?: string;
  label: string;
}

export const ICO = {
  android:   { kind: "img" as const,   src: androidIcon,   label: "Android" },
  apple:     { kind: "apple" as const, label: "iOS" },
  macos:     { kind: "macos" as const, label: "macOS" },
  windows:   { kind: "img" as const,   src: windowsIcon,   label: "Windows" },
  linux:     { kind: "img" as const,   src: linuxIcon,     label: "Linux" },
  chrome:    { kind: "img" as const,   src: chromeIcon,    label: "TWA" },
  capacitor: { kind: "img" as const,   src: capacitorIcon, label: "Capacitor" },
  electron:  { kind: "img" as const,   src: electronIcon,  label: "Electron" },
  pwa:       { kind: "img" as const,   src: pwaIcon,       label: "PWA" },
  web:       { kind: "img" as const,   src: webIcon,       label: "Web" },
};

export const SUPPORTED: IconRef[] = [
  ICO.android, ICO.apple, ICO.macos, ICO.windows, ICO.linux,
  ICO.chrome, ICO.capacitor, ICO.electron, ICO.pwa,
];

export const RenderIcon = ({ icon, size = 20, className = "" }: { icon: IconRef; size?: number; className?: string }) => {
  if (icon.kind === "apple") return <AppleIcon size={size} className={`text-foreground ${className}`} />;
  if (icon.kind === "macos") return <MacOSIcon size={size} className={`text-foreground ${className}`} />;
  return <img src={icon.src} alt={icon.label} style={{ width: size, height: size }} className={className} />;
};

export interface Feature {
  icon?: IconRef;
  title: string;
  desc?: string;
}

export interface Tier {
  name: string;
  price: string;
  strike?: string;
  suffix: string;
  credits: string;
  cta: string;
  ctaHref: string;
  highlight?: boolean;
  intro: string;
  features: Feature[];
}

export const TIERS: Tier[] = [
  {
    name: "Free",
    price: "$0",
    suffix: "/mo forever",
    credits: "3 credits / month",
    cta: "Start building free",
    ctaHref: "/auth",
    intro: "Free includes:",
    features: [
      { icon: ICO.android,   title: "Android APK builds", desc: "3 signed Capacitor APK builds per month" },
      { icon: ICO.chrome,    title: "Trusted Web Activity", desc: "Wrap your live URL into an Android app" },
      { icon: ICO.pwa,       title: "Browser + PWA preview", desc: "Instant preview before every build" },
      { title: "Build verification" },
      { title: "Community support" },
    ],
  },
  {
    name: "Starter",
    price: "$19",
    strike: "$24",
    suffix: "/user/month",
    credits: "20 credits / month · rollover up to 40",
    cta: "Start a trial",
    ctaHref: "/auth",
    intro: "All of Free and:",
    features: [
      { icon: ICO.apple,     title: "iOS IPA builds", desc: "Signed IPAs on shared macOS runners" },
      { icon: ICO.macos,     title: "macOS shared runners", desc: "Apple silicon build pool included" },
      { icon: ICO.capacitor, title: "Full signing vault", desc: "Android + iOS keystores & certificates" },
      { icon: ICO.web,       title: "Appetize streaming", desc: "20 min/month of live device preview" },
      { title: "Email support within 24 hours" },
    ],
  },
  {
    name: "Pro",
    price: "$49",
    strike: "$59",
    suffix: "/user/month",
    credits: "50 credits / month · rollover up to 100",
    cta: "Start a trial",
    ctaHref: "/auth",
    highlight: true,
    intro: "All of Starter and:",
    features: [
      { icon: ICO.windows,   title: "Windows EXE builds", desc: "Signed NSIS installer on Windows runners" },
      { icon: ICO.macos,     title: "macOS DMG builds", desc: "Notarizable DMG artifacts" },
      { icon: ICO.linux,     title: "Linux AppImage / DEB / RPM", desc: "One build, three package formats" },
      { icon: ICO.electron,  title: "Full Electron pipeline", desc: "Every desktop OS covered end-to-end" },
      { title: "Priority build queue" },
      { title: "ForgeAI full agent access" },
    ],
  },
  {
    name: "Enterprise",
    price: "Let's talk",
    suffix: "",
    credits: "Unlimited credits · dedicated runners",
    cta: "Contact sales",
    ctaHref: "/#contact",
    intro: "All features mentioned and:",
    features: [
      { icon: ICO.linux,     title: "Dedicated runner pools", desc: "No shared queues on any OS" },
      { icon: ICO.capacitor, title: "Custom AI plugin registry", desc: "Ship your own private plugins" },
      { title: "SSO — SAML + OIDC" },
      { title: "Audit logs & compliance" },
      { title: "White-label builds" },
      { title: "99.9% uptime SLA" },
    ],
  },
];

interface PricingCardsProps {
  /** Show fewer feature rows per card (used on the landing page preview). */
  compact?: boolean;
}

/** Shared pricing card grid — used by /pricing and the landing page. */
export const PricingCards = ({ compact = false }: PricingCardsProps) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    {TIERS.map((t) => {
      const features = compact ? t.features.slice(0, 4) : t.features;
      return (
        <div
          key={t.name}
          className={`relative rounded-2xl bg-card text-card-foreground p-8 flex flex-col ${
            t.highlight
              ? "ring-2 ring-primary shadow-lg lg:-mt-4 pt-12"
              : "border border-border"
          }`}
        >
          {t.highlight && (
            <span className="absolute top-5 left-8 text-[11px] font-medium uppercase tracking-wider text-primary">
              Most popular
            </span>
          )}
          <h3 className="text-[26px] font-normal">{t.name}</h3>

          {t.strike && (
            <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-[12px] w-fit">
              20% off for 12 months
            </div>
          )}

          <div className="mt-4 flex items-baseline gap-2 flex-wrap">
            <span className="text-[32px] font-normal leading-none">{t.price}</span>
            {t.strike && <span className="text-muted-foreground line-through text-[15px]">{t.strike}</span>}
          </div>
          {t.suffix && <div className="mt-1 text-[13px] text-muted-foreground">{t.suffix}</div>}
          <div className="mt-1 text-[12px] text-primary">{t.credits}</div>

          <Link
            to={t.ctaHref}
            className={`mt-5 text-center text-[14px] font-medium py-2.5 rounded-full transition ${
              t.highlight
                ? "bg-primary text-primary-foreground hover:brightness-110"
                : "border border-border text-primary hover:bg-muted"
            }`}
          >
            {t.cta}
          </Link>

          <div className="mt-6 text-[14px] font-medium">{t.intro}</div>

          <ul className="mt-4 space-y-4 flex-1">
            {features.map((f) => (
              <li key={f.title} className="flex items-start gap-3">
                <div className="shrink-0 w-6 h-6 flex items-center justify-center">
                  {f.icon ? <RenderIcon icon={f.icon} size={20} /> : <Check size={18} className="text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] leading-snug">{f.title}</div>
                  {f.desc && <div className="text-[12px] text-muted-foreground leading-snug mt-0.5">{f.desc}</div>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      );
    })}
  </div>
);

export default PricingCards;

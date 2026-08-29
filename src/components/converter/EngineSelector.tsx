import { useState } from "react";
import webviewIcon from "@/assets/icons/webview.svg";
import capacitorIcon from "@/assets/icons/capacitor.svg";
import ionicIcon from "@/assets/icons/ionic.svg";
import chromeIcon from "@/assets/icons/chrome.svg";
import electronIcon from "@/assets/icons/electron.png";
import tauriIcon from "@/assets/icons/tauri.svg";

export type EngineType = "webview" | "capacitor" | "ionic" | "twa" | "electron" | "tauri";

interface Engine {
  id: EngineType;
  name: string;
  icon: string;
  tagline: string;
  bestFor: string;
  pros: string[];
  cons: string[];
}

const engines: Engine[] = [
  {
    id: "webview",
    name: "WebView",
    icon: webviewIcon,
    tagline: "Wrap any URL instantly",
    bestFor: "Quick URL-to-app, no source code needed",
    pros: ["Zero code changes", "Fastest build", "Smallest APK"],
    cons: ["Limited native APIs", "Depends on system WebView"],
  },
  {
    id: "capacitor",
    name: "Capacitor",
    icon: capacitorIcon,
    tagline: "Full native bridge",
    bestFor: "React, Vue, Angular with native API access",
    pros: ["Full native APIs", "Industry standard", "Large plugin ecosystem"],
    cons: ["Requires source code", "Larger APK size"],
  },
  {
    id: "ionic",
    name: "Ionic + Capacitor",
    icon: ionicIcon,
    tagline: "Native UI components",
    bestFor: "Apps needing native-feeling UI",
    pros: ["Native UI components", "Full native APIs", "Cross-platform"],
    cons: ["Largest APK", "Adds Ionic dependency"],
  },
  {
    id: "twa",
    name: "TWA",
    icon: chromeIcon,
    tagline: "Chrome-powered PWA",
    bestFor: "PWAs with Lighthouse score 90+",
    pros: ["Best performance", "Chrome rendering", "Smallest footprint"],
    cons: ["Requires valid PWA", "Chrome dependency"],
  },
  {
    id: "electron",
    name: "Electron",
    icon: electronIcon,
    tagline: "Desktop apps for Win/Mac/Linux",
    bestFor: "Desktop apps from web projects",
    pros: ["Cross-platform desktop", "Full Node.js access", "Native menus & tray"],
    cons: ["Large binary size", "Higher memory usage"],
  },
  {
    id: "tauri",
    name: "Tauri",
    icon: tauriIcon,
    tagline: "Lightweight Rust desktop app",
    bestFor: "Small, fast cross-platform apps",
    pros: ["Extremely small binary", "Low memory footprint", "Rust security"],
    cons: ["Rust dependencies", "Different webviews per OS"],
  },
];

interface EngineSelectorProps {
  selected: EngineType;
  onSelect: (engine: EngineType) => void;
}

const EngineSelector = ({ selected, onSelect }: EngineSelectorProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {engines.map((engine) => {
        const isActive = selected === engine.id;

        return (
          <button
            key={engine.id}
            onClick={() => onSelect(engine.id)}
            className={`relative p-4 rounded-lg border text-left transition-all duration-200 ${
              isActive
                ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center p-1.5 ${
                  isActive ? "bg-primary/20" : "bg-muted"
                }`}
              >
                <img src={engine.icon} alt={engine.name} className="w-full h-full object-contain" />
              </div>
              <span className="font-medium text-sm text-foreground">{engine.name}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{engine.tagline}</p>
            {isActive && (
              <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default EngineSelector;

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FloatingInput } from "@/components/ui/floating-input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, ExternalLink, Loader2, Check, Copy, ArrowRight, Info } from "lucide-react";
import SyntaxHighlighter from "@/components/ui/syntax-highlighter";
import androidIcon from "@/assets/platforms/android.svg";
import appleIcon from "@/assets/platforms/apple.svg";
import webIcon from "@/assets/platforms/web.svg";
import windowsIcon from "@/assets/platforms/windows.svg";
import macosIcon from "@/assets/platforms/macos.svg";
import linuxIcon from "@/assets/platforms/linux.svg";
import flutterIcon from "@/assets/platforms/flutter.svg";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

type Platform = "android" | "ios" | "web" | "desktop" | "flutter";

const platformOptions: { id: Platform; label: string; icon: string }[] = [
  { id: "android", label: "Android", icon: androidIcon },
  { id: "ios", label: "iOS", icon: appleIcon },
  { id: "web", label: "Web", icon: webIcon },
  { id: "desktop", label: "Desktop", icon: windowsIcon },
  { id: "flutter", label: "Flutter", icon: flutterIcon },
];

interface Props {
  projectSlug: string;
  projectId: string;
  projectName: string;
  forced: boolean;
  existingPlatforms?: string[];
  onAppRegistered: () => void;
  onClose: () => void;
}

export default function AddAppDialog({ projectSlug, projectName, forced, existingPlatforms = [], onAppRegistered, onClose }: Props) {
  const takenPlatforms = new Set(existingPlatforms.map((p) => p.toLowerCase()));
  const availablePlatformOptions = platformOptions.filter((p) => !takenPlatforms.has(p.id));
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [registered, setRegistered] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // platform fields
  const [nickname, setNickname] = useState("");
  const [packageName, setPackageName] = useState("");
  const [sha1, setSha1] = useState("");
  const [minSdk, setMinSdk] = useState("23");
  const [bundleId, setBundleId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [origins, setOrigins] = useState("");
  const [hostingDomain, setHostingDomain] = useState("");
  const [targetOS, setTargetOS] = useState<string[]>(["windows", "macos", "linux"]);
  const [updateUrl, setUpdateUrl] = useState("");
  const [appId, setAppId] = useState("");

  // Streamlined: Register → Add SDK → Done
  const steps = [
    { n: 1, label: "Register app" },
    { n: 2, label: "Add SDK" },
    { n: 3, label: "Done" },
  ];

  async function register() {
    if (!platform || !nickname.trim()) {
      toast.error("Add a nickname for this app");
      return;
    }
    if (takenPlatforms.has(platform)) {
      toast.error(`A ${platform} app already exists for this project`);
      return;
    }
    setSubmitting(true);
    try {
      const config: Record<string, any> = {};
      if (platform === "android") Object.assign(config, { packageName, sha1: sha1 || null, minSdk });
      if (platform === "ios") Object.assign(config, { bundleId, teamId });
      if (platform === "web") Object.assign(config, { origins: origins.split(",").map((s) => s.trim()).filter(Boolean), hostingDomain });
      if (platform === "desktop") Object.assign(config, { appId, targetOS, updateUrl });
      if (platform === "flutter") Object.assign(config, { bundleId, packageName });

      const { data, error } = await supabase.functions.invoke("register-app", {
        body: { projectSlug, nickname, platform, config },
      });
      if (error) throw error;
      setRegistered(data);
      setActiveStep(2);
      onAppRegistered();
    } catch (err: any) {
      toast.error(err.message || "Failed to register app");
    } finally {
      setSubmitting(false);
    }
  }

  const platformLabel = platformOptions.find((p) => p.id === platform)?.label;

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !forced) onClose(); }}>
      <DialogContent
        className="max-w-3xl p-0 gap-0 border-border bg-background [&>button]:hidden overflow-hidden"
        onInteractOutside={(e) => forced && e.preventDefault()}
        onEscapeKeyDown={(e) => forced && e.preventDefault()}
      >
        <div className="flex items-center justify-between px-6 pt-6">
          <div className="flex items-center gap-3">
            {!forced && (
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X size={18} /></button>
            )}
            <div>
              <h2 className="text-lg font-medium">
                {platform ? `Add NativeBridge to your ${platformLabel} app` : "Add an app to get started"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">{projectName}</p>
            </div>
          </div>
          <a href="/docs" target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">Docs <ExternalLink size={11} /></a>
        </div>

        <div className="px-6 py-6">
          {!platform ? (
            // PLATFORM PICKER — pill row, no card chrome
            <div className="flex flex-wrap items-center justify-center gap-6 py-6">
              {availablePlatformOptions.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">
                    Every supported platform has already been added to this project.
                  </p>
                </div>
              ) : availablePlatformOptions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  className="group flex flex-col items-center gap-3 px-4 py-3 rounded-2xl transition-all hover:bg-muted/40 hover:scale-105 duration-200"
                >
                  <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-gradient-to-br from-muted/60 to-muted/20 ring-1 ring-border/50 group-hover:ring-primary/40 transition-all">
                    <img src={p.icon} alt={p.label} className="w-9 h-9" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">{p.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="relative pl-10">
              <div className="absolute left-3 top-3 bottom-3 w-px bg-border" />
              {steps.map((s) => {
                const isActive = activeStep === s.n;
                const isDone = activeStep > s.n;
                return (
                  <div key={s.n} className="relative mb-4">
                    <div className={`absolute -left-10 top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all duration-300 ${isActive ? "bg-primary text-primary-foreground scale-110" : isDone ? "bg-primary/30 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {isDone ? <Check size={12} className="animate-in zoom-in-50 duration-300" /> : s.n}
                    </div>
                    <button
                      onClick={() => (isDone || isActive) && setActiveStep(s.n)}
                      className={`text-sm transition-colors ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}
                    >
                      {s.label}
                    </button>

                    {isActive && (
                      <div
                        key={`panel-${s.n}`}
                        className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300"
                      >
                        {s.n === 1 && (
                          <>
                            <FloatingInput
                              label={`App nickname — e.g. "My ${platformLabel} App"`}
                              value={nickname}
                              onChange={(e) => setNickname(e.target.value)}
                            />

                            {platform === "android" && (
                              <>
                                <FloatingInput
                                  label="Android package name (com.company.appname)"
                                  value={packageName}
                                  onChange={(e) => setPackageName(e.target.value.toLowerCase())}
                                  className="font-mono"
                                />
                                <FloatingInput
                                  label="SHA-1 / SHA-256 fingerprint (optional)"
                                  value={sha1}
                                  onChange={(e) => setSha1(e.target.value)}
                                  className="font-mono"
                                  hint={
                                    <>
                                      <Info size={10} className="inline mr-1" />
                                      Needed for Google Sign-In, Maps & App Links. You can{" "}
                                      <a href="/docs/android-signing" target="_blank" className="underline">generate one yourself</a>,
                                      or skip this — we can generate one for you later in the Signing tab.
                                    </>
                                  }
                                />
                                <FloatingInput
                                  label="Minimum Android SDK"
                                  value={minSdk}
                                  onChange={(e) => setMinSdk(e.target.value)}
                                  type="number"
                                  hint={
                                    <>
                                      Lowest Android version your app supports. 23 = Android 6.0 (covers ~99% of active devices).{" "}
                                      <a href="/docs/android-min-sdk" target="_blank" className="underline">Learn more</a>.
                                    </>
                                  }
                                />
                              </>
                            )}
                            {platform === "ios" && (
                              <>
                                <FloatingInput label="Apple Bundle ID (com.yourcompany.appname)" value={bundleId} onChange={(e) => setBundleId(e.target.value)} className="font-mono" />
                                <FloatingInput label="Apple Team ID (ABCDE12345)" value={teamId} onChange={(e) => setTeamId(e.target.value)} className="font-mono" />
                              </>
                            )}
                            {platform === "web" && (
                              <>
                                <FloatingInput label="Allowed origins (comma separated)" value={origins} onChange={(e) => setOrigins(e.target.value)} />
                                <FloatingInput label="Hosting domain (app.com)" value={hostingDomain} onChange={(e) => setHostingDomain(e.target.value)} />
                              </>
                            )}
                            {platform === "desktop" && (
                              <>
                                <FloatingInput label="Application ID (com.yourcompany.desktop)" value={appId} onChange={(e) => setAppId(e.target.value)} className="font-mono" />
                                <div>
                                  <label className="text-xs text-muted-foreground mb-2 block">Target operating systems</label>
                                  <div className="flex gap-2">
                                    {[{ id: "windows", label: "Windows", icon: windowsIcon }, { id: "macos", label: "macOS", icon: macosIcon }, { id: "linux", label: "Linux", icon: linuxIcon }].map((o) => {
                                      const on = targetOS.includes(o.id);
                                      return (
                                        <button key={o.id} onClick={() => setTargetOS((prev) => on ? prev.filter((x) => x !== o.id) : [...prev, o.id])} className={`flex items-center gap-2 px-3 h-9 rounded-full border text-xs transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
                                          <img src={o.icon} alt="" className="w-3.5 h-3.5" />{o.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                <FloatingInput label="Auto-update server URL (optional)" value={updateUrl} onChange={(e) => setUpdateUrl(e.target.value)} />
                              </>
                            )}
                            {platform === "flutter" && (
                              <>
                                <FloatingInput label="iOS Bundle ID" value={bundleId} onChange={(e) => setBundleId(e.target.value)} className="font-mono" />
                                <FloatingInput label="Android package name" value={packageName} onChange={(e) => setPackageName(e.target.value.toLowerCase())} className="font-mono" />
                              </>
                            )}

                            <div className="flex justify-between items-center pt-2">
                              <button onClick={() => setPlatform(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Change platform</button>
                              <Button onClick={register} disabled={submitting} className="rounded-full h-10 px-6">
                                {submitting && <Loader2 size={14} className="animate-spin mr-1.5" />}
                                Register app
                              </Button>
                            </div>
                          </>
                        )}

                        {s.n === 2 && registered && (
                          <>
                            <p className="text-sm">Install the SDK and initialize it with your access token.</p>
                            <SyntaxHighlighter
                              language="typescript"
                              code={`// 1. Install
npm i @nativebridge/sdk

// 2. Initialize once at app start-up
import { init } from "@nativebridge/sdk";

init({
  projectId: "${projectSlug}",
  appId: "${registered.appIdSlug}",
  accessToken: "${registered.accessToken}",
});`}
                            />
                            <div className="flex items-start gap-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-3 py-2">
                              <Info size={12} className="text-yellow-600 mt-0.5 shrink-0" />
                              <p className="text-[11px] text-yellow-700 dark:text-yellow-400">
                                This access token is shown once. Store it in an environment variable, never in client-side source.
                              </p>
                            </div>
                            <div className="flex justify-end">
                              <Button onClick={() => setActiveStep(3)} className="rounded-full">Next <ArrowRight size={14} className="ml-1.5" /></Button>
                            </div>
                          </>
                        )}

                        {s.n === 3 && registered && (
                          <>
                            <p className="text-sm">Your app is registered. Scoped REST endpoint:</p>
                            <SyntaxHighlighter
                              language="bash"
                              code={`# All routes require: Authorization: Bearer <accessToken>
curl ${SUPABASE_URL}/functions/v1/project-api${registered.scopedEndpoint} \\
  -H "Authorization: Bearer ${registered.accessToken}"`}
                            />
                            <p className="text-[11px] text-muted-foreground">
                              This is what your apps call at runtime to read config, rotate tokens and fetch project state.
                              Opening it in a browser returns 401 because it requires the bearer header — use the SDK or curl.
                            </p>
                            <div className="flex justify-end">
                              <Button onClick={onClose} className="rounded-full"><Check size={14} className="mr-1.5" /> Done</Button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

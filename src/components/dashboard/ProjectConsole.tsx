import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AddAppDialog from "@/components/projects/AddAppDialog";
import { X, Plus, Sparkles, ExternalLink } from "lucide-react";
import androidIcon from "@/assets/platforms/android.svg";
import appleIcon from "@/assets/platforms/apple.svg";
import webIcon from "@/assets/platforms/web.svg";
import windowsIcon from "@/assets/platforms/windows.svg";
import macosIcon from "@/assets/platforms/macos.svg";
import linuxIcon from "@/assets/platforms/linux.svg";

interface ProjectConsoleProps {
  projectId: string;
  projectName: string;
  projectSlug: string;
  existingPlatforms?: string[];
  onAppRegistered?: () => void;
}

const platformChoices = [
  { id: "android", label: "Android", icon: androidIcon },
  { id: "ios", label: "iOS", icon: appleIcon },
  { id: "web", label: "Web (PWA)", icon: webIcon },
  { id: "desktop", label: "Windows", icon: windowsIcon },
  { id: "macos", label: "macOS", icon: macosIcon },
  { id: "linux", label: "Linux", icon: linuxIcon },
];

const nextSteps = [
  { title: "Tell us about your app", body: "Describe your app and NativeBridge AI will suggest the engine and plugins to get you started." },
  { title: "Add a build target", body: "Register an Android or iOS app so the pipeline knows what to produce." },
  { title: "Connect your source", body: "Upload a ZIP or point us at a repository — we detect your framework automatically." },
  { title: "Configure signing", body: "Generate or upload a keystore so release artifacts are installable." },
  { title: "Set app appearance", body: "Upload one icon and we patch every mipmap and drawable folder for you." },
  { title: "Ship your first build", body: "Run the pipeline and download a production-ready APK or AAB." },
];

const ProjectConsole = ({ projectId, projectName, projectSlug, existingPlatforms = [], onAppRegistered }: ProjectConsoleProps) => {
  const [firstName, setFirstName] = useState("there");
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      const raw =
        (u?.user_metadata?.full_name as string) ||
        (u?.user_metadata?.name as string) ||
        (u?.user_metadata?.user_name as string) ||
        u?.email?.split("@")[0] ||
        "there";
      setFirstName(raw.split(" ")[0]);
    })();
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[900px] mx-auto px-8 py-12">
        <h2 className="text-2xl font-semibold text-foreground tracking-tight">{projectName}</h2>

        {/* Add app row */}
        <div className="mt-5 flex items-center gap-3 min-h-[48px]">
          {!expanded ? (
            <button
              onClick={() => setExpanded(true)}
              className="flex items-center gap-2 h-10 px-4 rounded-full border border-border bg-card text-sm text-foreground hover:border-primary/40 transition-colors"
            >
              <Plus size={15} /> Add app
            </button>
          ) : (
            <>
              <button
                onClick={() => setExpanded(false)}
                aria-label="Close platform picker"
                className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
              >
                <X size={16} />
              </button>
              <div className="flex items-center gap-2.5 flex-wrap animate-fade-in">
                {platformChoices.map((p) => {
                  const taken = existingPlatforms.map((x) => x.toLowerCase()).includes(p.id);
                  return (
                    <button
                      key={p.id}
                      title={p.label}
                      disabled={taken}
                      onClick={() => setDialogOpen(true)}
                      className={`h-10 w-10 rounded-full border flex items-center justify-center transition-all ${
                        taken
                          ? "border-border opacity-40 cursor-not-allowed"
                          : "border-primary/50 hover:bg-primary/10 hover:scale-105"
                      }`}
                    >
                      <img src={p.icon} alt={p.label} className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
              <span className="text-sm text-muted-foreground ml-1">Select a platform</span>
            </>
          )}
        </div>

        {/* Greeting */}
        <div className="mt-10">
          <h1 className="text-4xl font-normal text-primary tracking-tight">Hello, {firstName}</h1>
          <p className="text-2xl text-foreground/80 mt-1">Welcome to your NativeBridge project!</p>
          <p className="text-sm text-muted-foreground mt-4 max-w-md">
            NativeBridge AI can suggest engines, plugins and fixes for your app.
          </p>
        </div>

        {/* Next steps */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-foreground">Next steps with NativeBridge AI</h3>
            <a href="/docs" className="text-xs text-primary hover:underline flex items-center gap-1">
              View docs <ExternalLink size={11} />
            </a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {nextSteps.map((s, i) => (
              <button
                key={s.title}
                onClick={() => i === 1 && setDialogOpen(true)}
                className={`text-left rounded-[8px] border bg-card p-4 flex gap-3 transition-colors ${
                  i === 0 ? "border-primary" : "border-border hover:border-foreground/20"
                }`}
              >
                <Sparkles size={16} className="text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-medium text-foreground">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.body}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {dialogOpen && (
        <AddAppDialog
          projectSlug={projectSlug}
          projectId={projectId}
          projectName={projectName}
          forced={false}
          existingPlatforms={existingPlatforms}
          onAppRegistered={() => {
            setDialogOpen(false);
            setExpanded(false);
            onAppRegistered?.();
          }}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
};

export default ProjectConsole;

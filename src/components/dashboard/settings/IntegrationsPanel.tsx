import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Github, Sparkles, Cloud, ExternalLink, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SettingsHeader, Tabs } from "./primitives";

interface IntegrationDef {
  id: string;
  name: string;
  official?: boolean;
  description: string;
  icon: React.ElementType;
}

const INTEGRATIONS: IntegrationDef[] = [
  { id: "github", name: "GitHub", official: true, description: "Connect a repository so builds run from your source, create branches and push AI edits.", icon: Github },
  { id: "lovable", name: "Lovable AI", official: true, description: "Use Lovable AI to wire plugins, patch native code and repair failing builds.", icon: Sparkles },
  { id: "cloud", name: "Cloud Storage", description: "Store APK/AAB artifacts, keystores and build logs in managed storage.", icon: Cloud },
];

const IntegrationsPanel = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");
  const [repo, setRepo] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const { data } = await supabase.from("projects").select("source_url, source_type").eq("id", projectId).maybeSingle();
      if (data?.source_url?.includes("github.com")) setRepo(data.source_url);
    })();
  }, [projectId]);

  const installed = INTEGRATIONS.filter((i) => (i.id === "github" ? !!repo : i.id === "lovable"));
  const active = INTEGRATIONS.find((i) => i.id === selected);

  if (active) {
    const Icon = active.icon;
    const isInstalled = installed.some((i) => i.id === active.id);
    return (
      <div className="max-w-4xl pb-16">
        <button onClick={() => setSelected(null)} className="mb-6 text-[13px] text-muted-foreground hover:text-foreground">
          Integrations / <span className="text-foreground">{active.name}</span>
        </button>

        <div className="flex items-start gap-4 mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-md border border-border bg-card">
            <Icon size={22} className="text-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-normal text-foreground">{active.name}</h1>
              {active.official && (
                <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Official</span>
              )}
              {isInstalled && (
                <span className="rounded bg-[hsl(var(--success))]/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[hsl(var(--success))]">Installed</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{active.description}</p>
          </div>
        </div>

        <Tabs
          tabs={[{ id: "overview", label: "Overview" }, { id: "settings", label: "Settings" }, { id: "docs", label: "Docs" }]}
          active={tab}
          onChange={setTab}
        />

        {tab === "overview" && (
          <div className="rounded-md border border-border bg-card/40 divide-y divide-border">
            <div className="grid grid-cols-2 gap-3 px-5 py-4">
              <p className="text-sm text-foreground">Status</p>
              <p className="text-[13px] text-muted-foreground">{isInstalled ? "Connected" : "Not connected"}</p>
            </div>
            {active.id === "github" && (
              <div className="grid grid-cols-2 gap-3 px-5 py-4">
                <p className="text-sm text-foreground">Repository</p>
                <p className="text-[13px] text-muted-foreground break-all">{repo ?? "No repository connected"}</p>
              </div>
            )}
            {active.id === "lovable" && (
              <div className="grid grid-cols-2 gap-3 px-5 py-4">
                <p className="text-sm text-foreground">Model gateway</p>
                <p className="text-[13px] text-muted-foreground">Google Gemini via the AI gateway</p>
              </div>
            )}
          </div>
        )}

        {tab === "settings" && (
          <div className="rounded-md border border-border bg-card/40 px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">{isInstalled ? "Manage connection" : "Connect this integration"}</p>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                {active.id === "github"
                  ? "Choose the repository builds are cloned from and pushed back to."
                  : "Configure how this integration is used during builds."}
              </p>
            </div>
            <Button size="sm" variant={isInstalled ? "outline" : "default"}>
              {isInstalled ? "Manage" : "Connect"}
            </Button>
          </div>
        )}

        {tab === "docs" && (
          <div className="rounded-md border border-border bg-card/40 px-5 py-4 text-[13px] text-muted-foreground">
            Documentation for {active.name} lives in the docs section.
            <a href="/docs" className="ml-1 inline-flex items-center gap-1 text-foreground hover:underline">
              Open docs <ExternalLink size={11} />
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl pb-16">
      <SettingsHeader title="Integrations" description="Connect external services to your project" />
      <div className="space-y-4">
        {INTEGRATIONS.map((i) => {
          const Icon = i.icon;
          const isInstalled = installed.some((x) => x.id === i.id);
          return (
            <div key={i.id} className="rounded-md border border-border bg-card/40 p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                  <Icon size={20} className="text-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-normal text-foreground">{i.name}</h3>
                    {isInstalled && <Check size={13} className="text-[hsl(var(--success))]" />}
                  </div>
                  <p className="text-[13px] text-muted-foreground mt-1">{i.description}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => { setSelected(i.id); setTab("overview"); }}>
                  {isInstalled ? "Configure" : "View"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IntegrationsPanel;

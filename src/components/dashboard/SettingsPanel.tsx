import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ModelIcon from "@/components/ai/ModelIcon";
import GeneralSettings from "@/components/dashboard/settings/GeneralSettings";
import InfrastructurePanel from "@/components/dashboard/settings/InfrastructurePanel";
import IntegrationsPanel from "@/components/dashboard/settings/IntegrationsPanel";
import ApiKeysSettings from "@/components/dashboard/settings/ApiKeysSettings";


interface SettingsPanelProps {
  activeItem: string;
}

// Models served by the Lovable AI gateway — the only gateway NativeBridge uses.
const MODELS: { id: string; name: string; provider: string; tag?: string; description: string }[] = [
  { id: "google/gemini-3.6-flash", name: "Gemini 3.6 Flash", provider: "Google", tag: "Default", description: "Latest Flash generation — strongest agentic tool use at Flash cost. Recommended for most builds." },
  { id: "google/gemini-3.5-flash", name: "Gemini 3.5 Flash", provider: "Google", description: "High-efficiency Gemini 3.5 — fast coding, reasoning and tool calling." },
  { id: "google/gemini-3.1-pro-preview", name: "Gemini 3.1 Pro (Preview)", provider: "Google", description: "Deepest Gemini reasoning — best for complex native wiring and hard repairs." },
  { id: "google/gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite", provider: "Google", description: "Cost-efficient — high-volume classification and extraction." },
  { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash (Preview)", provider: "Google", description: "Fast preview generation of Gemini Flash." },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "Google", description: "Stable reasoning model with a 1M-token context window." },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google", description: "Stable balanced choice — lower cost than Pro." },
  { id: "google/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", provider: "Google", description: "Cheapest, fastest Gemini for simple high-volume tasks." },
  { id: "openai/gpt-5.6-sol", name: "GPT-5.6 Sol", provider: "OpenAI", tag: "Flagship", description: "OpenAI's flagship — hardest reasoning, coding and agentic work." },
  { id: "openai/gpt-5.6-terra", name: "GPT-5.6 Terra", provider: "OpenAI", description: "Balanced GPT-5.6 for everyday build work at lower cost." },
  { id: "openai/gpt-5.6-luna", name: "GPT-5.6 Luna", provider: "OpenAI", description: "Fast, low-cost GPT-5.6 for simple or latency-sensitive tasks." },
  { id: "openai/gpt-5.5", name: "GPT-5.5", provider: "OpenAI", description: "Frontier model for the most complex coding and analysis." },
  { id: "openai/gpt-5.4", name: "GPT-5.4", provider: "OpenAI", description: "Affordable frontier model for coding and professional work." },
  { id: "openai/gpt-5.4-mini", name: "GPT-5.4 Mini", provider: "OpenAI", description: "Strong mini model for coding and high-volume workloads." },
  { id: "openai/gpt-5.4-nano", name: "GPT-5.4 Nano", provider: "OpenAI", description: "Fastest, lowest-cost GPT-5.4 for extraction and ranking." },
  { id: "openai/gpt-5.2", name: "GPT-5.2", provider: "OpenAI", description: "Strong reasoning and problem solving." },
  { id: "openai/gpt-5", name: "GPT-5", provider: "OpenAI", description: "Powerful all-rounder for accuracy and multimodal text+image tasks." },
  { id: "openai/gpt-5-mini", name: "GPT-5 Mini", provider: "OpenAI", description: "Lower-cost OpenAI model with strong general performance." },
  { id: "openai/gpt-5-nano", name: "GPT-5 Nano", provider: "OpenAI", description: "Fast, low-cost OpenAI model for simple, high-volume tasks." },
];

const AiModelsPanel = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const [selected, setSelected] = useState<string>("google/gemini-3.6-flash");


  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("preferred_ai_model")
        .eq("id", projectId)
        .maybeSingle();
      if (data?.preferred_ai_model) setSelected(data.preferred_ai_model);
      setLoading(false);
    })();
  }, [projectId]);

  const save = async (modelId: string) => {
    if (!projectId) return;
    setSelected(modelId);
    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({ preferred_ai_model: modelId })
      .eq("id", projectId);
    setSaving(false);
    if (error) toast.error("Failed to save model preference");
    else toast.success("AI model updated");
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles size={18} className="text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">AI Wiring Model</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose which model the AI uses to wire plugins, fix build errors and patch native code. All models route through the Lovable AI gateway.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading…</div>
      ) : (
        <div className="space-y-2">
          {MODELS.map((m) => {
            const isSelected = selected === m.id;
            return (
              <button
                key={m.id}
                onClick={() => save(m.id)}
                disabled={saving}
                className={`w-full text-left rounded-lg border p-4 transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                    isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                  }`}>
                    {isSelected && <Check size={12} className="text-primary-foreground" strokeWidth={3} />}
                  </div>
                  <div className="w-8 h-8 rounded-md border border-border bg-background flex items-center justify-center shrink-0">
                    <ModelIcon modelId={m.id} size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{m.name}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-1.5 py-0.5 rounded bg-muted/50">{m.provider}</span>
                      {m.tag && (
                        <span className="text-[10px] uppercase tracking-wider text-primary px-1.5 py-0.5 rounded bg-primary/10">{m.tag}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{m.description}</p>
                  </div>
                </div>

              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const PlaceholderPage = ({ title, description }: { title: string; description: string }) => (
  <div className="max-w-3xl">
    <h2 className="text-lg font-semibold text-foreground">{title}</h2>
    <p className="text-sm text-muted-foreground mt-1">{description}</p>
    <div className="mt-6 rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
      Coming soon.
    </div>
  </div>
);

const SettingsPanel = ({ activeItem }: SettingsPanelProps) => {
  return (
    <div className="p-8 h-full overflow-y-auto">
      {activeItem === "general" && <GeneralSettings />}
      {activeItem === "infrastructure" && <InfrastructurePanel />}
      {activeItem === "integrations" && <IntegrationsPanel />}
      {["api-keys", "oauth-apps", "mcp-server", "webhooks"].includes(activeItem) && (
        <ApiKeysSettings initialTab={activeItem} />
      )}
      {activeItem === "ai-models" && <AiModelsPanel />}
      {activeItem === "build" && <PlaceholderPage title="Build Settings" description="Default build flavor, signing mode, output options." />}
      {activeItem === "notifications" && <PlaceholderPage title="Notifications" description="Email and webhook notifications for build events." />}
      {!["general", "infrastructure", "integrations", "api-keys", "oauth-apps", "mcp-server", "webhooks", "ai-models", "build", "notifications"].includes(activeItem) && (
        <GeneralSettings />
      )}
    </div>
  );
};

export default SettingsPanel;

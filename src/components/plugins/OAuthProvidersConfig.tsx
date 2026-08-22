import { useMemo, useState } from "react";
import { CheckCircle2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  OAUTH_PROVIDERS,
  OAUTH_ENABLED_PROVIDERS_KEY,
  oauthFieldsFor,
} from "@/lib/plugins/oauthProviders";
import { savePluginSecret, type PluginSecret } from "@/lib/pluginSecretsService";

interface Props {
  pluginId: string;
  projectId: string;
  savedSecrets: PluginSecret[];
  onSaved: () => void;
}

const ProviderField = ({
  label, placeholder, description, initial, onSave,
}: {
  label: string; placeholder?: string; description?: string; initial: string;
  onSave: (value: string) => Promise<void>;
}) => {
  const [value, setValue] = useState(initial);
  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        {label} {initial && <CheckCircle2 size={11} className="text-primary" />}
      </Label>
      <Input
        value={value}
        placeholder={placeholder}
        className="h-8 text-xs bg-background font-mono"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => { if (value.trim() && value !== initial) void onSave(value.trim()); }}
        onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) void onSave(value.trim()); }}
      />
      {description && <p className="text-[10px] text-muted-foreground">{description}</p>}
    </div>
  );
};

const OAuthProvidersConfig = ({ pluginId, projectId, savedSecrets, onSaved }: Props) => {
  const savedList = useMemo(() => {
    const raw = savedSecrets.find(
      (s) => s.plugin_id === pluginId && s.secret_key === OAUTH_ENABLED_PROVIDERS_KEY,
    )?.secret_value;
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [savedSecrets, pluginId]);

  const [selected, setSelected] = useState<string[]>(savedList);
  const [open, setOpen] = useState<string | null>(savedList[0] ?? null);

  const persistSelection = async (next: string[]) => {
    setSelected(next);
    const ok = await savePluginSecret(projectId, pluginId, OAUTH_ENABLED_PROVIDERS_KEY, next.join(","));
    if (ok) onSaved();
    else toast.error("Could not save provider selection");
  };

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((p) => p !== id) : [...selected, id];
    void persistSelection(next);
    setOpen(next.includes(id) ? id : null);
  };

  const valueOf = (key: string) =>
    savedSecrets.find((s) => s.plugin_id === pluginId && s.secret_key === key)?.secret_value || "";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <KeyRound size={14} /> Sign-in providers
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pick the providers your app supports. Each opens an in-app browser and redirects back into the app —
          <code className="mx-1 text-foreground">@capacitor/browser</code> and
          <code className="mx-1 text-foreground">@capacitor/app</code> are installed automatically.
        </p>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
        {OAUTH_PROVIDERS.map((p) => {
          const active = selected.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              title={p.name}
              onClick={() => toggle(p.id)}
              className={`relative flex flex-col items-center gap-1.5 rounded-[4px] border p-2.5 transition-colors ${
                active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <img src={p.icon} alt={p.name} className="w-5 h-5 opacity-80 dark:invert" />
              <span className="text-[10px] text-muted-foreground truncate max-w-full">{p.name}</span>
              {active && <CheckCircle2 size={11} className="absolute top-1 right-1 text-primary" />}
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <div className="space-y-2">
          {selected.map((id) => {
            const provider = OAUTH_PROVIDERS.find((p) => p.id === id);
            if (!provider) return null;
            const fields = oauthFieldsFor(provider);
            const expanded = open === id;
            return (
              <div key={id} className="rounded-[4px] border border-border">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left"
                >
                  <img src={provider.icon} alt="" className="w-4 h-4 opacity-80 dark:invert" />
                  <span className="text-sm font-medium text-foreground">{provider.name}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {fields.every((f) => !f.required || valueOf(f.key)) ? "Configured" : "Needs credentials"}
                  </span>
                </button>
                {expanded && (
                  <div className="px-3 pb-3 space-y-2.5 border-t border-border pt-3">
                    {provider.notes && <p className="text-[11px] text-muted-foreground">{provider.notes}</p>}
                    {fields.map((f) => (
                      <ProviderField
                        key={f.key}
                        label={f.label}
                        placeholder={f.placeholder}
                        description={f.description}
                        initial={valueOf(f.key)}
                        onSave={async (v) => {
                          const ok = await savePluginSecret(projectId, pluginId, f.key, v);
                          if (ok) { toast.success(`${f.label} saved`); onSaved(); }
                          else toast.error("Could not save credential");
                        }}
                      />
                    ))}
                    {provider.authorizationUrl && (
                      <p className="text-[10px] text-muted-foreground font-mono break-all">
                        authorizationUrl: {provider.authorizationUrl}
                      </p>
                    )}
                    {provider.scopes && (
                      <p className="text-[10px] text-muted-foreground font-mono">scopes: {provider.scopes}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OAuthProvidersConfig;

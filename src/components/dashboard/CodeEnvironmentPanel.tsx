import { useState } from "react";
import { Plus, Trash2, Eye, EyeOff, Save, Variable } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

interface EnvVar {
  key: string;
  value: string;
  hidden: boolean;
}

const DEFAULT_VARS: EnvVar[] = [
  { key: "VITE_SUPABASE_URL", value: "https://placeholder.supabase.co", hidden: false },
  { key: "VITE_SUPABASE_PUBLISHABLE_KEY", value: "placeholder", hidden: true },
  { key: "VITE_SUPABASE_ANON_KEY", value: "placeholder", hidden: true },
  { key: "VITE_SUPABASE_PROJECT_ID", value: "placeholder", hidden: false },
  { key: "CI", value: "true", hidden: false },
];

const CodeEnvironmentPanel = () => {
  const [vars, setVars] = useState<EnvVar[]>(DEFAULT_VARS);

  const addVar = () => {
    setVars([...vars, { key: "", value: "", hidden: false }]);
  };

  const removeVar = (index: number) => {
    setVars(vars.filter((_, i) => i !== index));
  };

  const updateVar = (index: number, field: "key" | "value", val: string) => {
    const updated = [...vars];
    updated[index] = { ...updated[index], [field]: val };
    setVars(updated);
  };

  const toggleHidden = (index: number) => {
    const updated = [...vars];
    updated[index] = { ...updated[index], hidden: !updated[index].hidden };
    setVars(updated);
  };

  const handleSave = () => {
    const validVars = vars.filter((v) => v.key.trim());
    setVars(validVars);
    toast({ title: "Environment variables saved", description: `${validVars.length} variables will be injected into CI builds.` });
  };

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Environment Variables</h2>
          <p className="text-sm text-muted-foreground">These variables are injected as <code className="text-[11px] px-1 py-0.5 bg-muted rounded font-mono">env:</code> entries in your CI workflow.</p>
        </div>
        <Button onClick={handleSave} size="sm" className="gap-1.5">
          <Save size={14} /> Save
        </Button>
      </div>

      <div className="space-y-2">
        {vars.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              placeholder="KEY"
              value={v.key}
              onChange={(e) => updateVar(i, "key", e.target.value)}
              className="font-mono text-sm flex-[2] bg-card"
            />
            <div className="relative flex-[3]">
              <Input
                placeholder="value"
                type={v.hidden ? "password" : "text"}
                value={v.value}
                onChange={(e) => updateVar(i, "value", e.target.value)}
                className="font-mono text-sm bg-card pr-9"
              />
              <button onClick={() => toggleHidden(i)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {v.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button onClick={() => removeVar(i)} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <Button onClick={addVar} variant="outline" size="sm" className="gap-1.5">
        <Plus size={14} /> Add Variable
      </Button>

      <div className="rounded-[4px] border border-border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">
          <Variable size={12} className="inline mr-1" />
          Variables are available during the build process. Sensitive values (API keys, tokens) are masked in build logs.
        </p>
      </div>
    </div>
  );
};

export default CodeEnvironmentPanel;

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SettingsHeader, SectionTitle, SettingsCard, SettingsRow } from "./primitives";

interface AppRow {
  id: string;
  nickname: string;
  display_name: string | null;
  platform: string;
  engine: string | null;
  package_id: string | null;
  package_name: string | null;
  version_name: string | null;
  version_code: number | null;
  min_sdk: number | null;
  target_sdk: number | null;
  webdir: string | null;
  build_output_dir: string | null;
}

const CopyField = ({ value }: { value: string }) => (
  <div className="flex items-center gap-2">
    <Input readOnly value={value} className="h-8 font-mono text-[12px] bg-muted/30" />
    <Button
      variant="outline"
      size="sm"
      className="h-8 shrink-0 gap-1.5"
      onClick={() => { navigator.clipboard.writeText(value); toast.success("Copied"); }}
    >
      <Copy size={12} /> Copy
    </Button>
  </div>
);

const GeneralSettings = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [engine, setEngine] = useState("");
  const [apps, setApps] = useState<AppRow[]>([]);
  const [appIndex, setAppIndex] = useState(0);
  const app = apps[appIndex];

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const [{ data: project }, { data: appRows }] = await Promise.all([
        supabase.from("projects").select("name, description, project_id_slug, engine").eq("id", projectId).maybeSingle(),
        supabase
          .from("project_apps")
          .select("id, nickname, display_name, platform, engine, package_id, package_name, version_name, version_code, min_sdk, target_sdk, webdir, build_output_dir")
          .eq("project_id", projectId)
          .order("created_at", { ascending: true }),
      ]);
      if (project) {
        setName(project.name ?? "");
        setDescription(project.description ?? "");
        setSlug(project.project_id_slug ?? projectId);
        setEngine(project.engine ?? "capacitor");
      }
      setApps((appRows ?? []) as AppRow[]);
      setLoading(false);
    })();
  }, [projectId]);

  const patchApp = (patch: Partial<AppRow>) =>
    setApps((prev) => prev.map((a, i) => (i === appIndex ? { ...a, ...patch } : a)));

  const save = async () => {
    if (!projectId) return;
    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({ name, description, engine })
      .eq("id", projectId);
    let appError = null;
    if (app) {
      const { error: e } = await supabase
        .from("project_apps")
        .update({
          nickname: app.nickname,
          display_name: app.display_name,
          package_id: app.package_id,
          package_name: app.package_id ?? app.package_name,
          version_name: app.version_name,
          version_code: app.version_code,
          min_sdk: app.min_sdk,
          target_sdk: app.target_sdk,
          webdir: app.webdir,
          build_output_dir: app.build_output_dir,
        })
        .eq("id", app.id);
      appError = e;
    }
    setSaving(false);
    if (error || appError) toast.error("Failed to save settings");
    else toast.success("Settings saved");
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="max-w-3xl pb-16">
      <SettingsHeader title="Project Settings" description="General configuration, application identity, and build targets" />

      <SectionTitle>General settings</SectionTitle>
      <SettingsCard
        footer={<Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>}
      >
        <SettingsRow label="Project name" description="Displayed throughout the dashboard.">
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
        </SettingsRow>
        <SettingsRow label="Project ID" description="Reference used in APIs and URLs.">
          <CopyField value={slug} />
        </SettingsRow>
        <SettingsRow label="Description" description="Short summary of what this project builds.">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="text-sm" />
        </SettingsRow>
        <SettingsRow label="Runtime engine" description="Capacitor, Ionic, TWA, WebView or Electron.">
          <select
            value={engine}
            onChange={(e) => setEngine(e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {["capacitor", "ionic", "twa", "webview", "electron"].map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </SettingsRow>
      </SettingsCard>

      <div className="mt-10">
        <SectionTitle>Application</SectionTitle>
        {apps.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            No applications registered for this project yet.
          </div>
        ) : (
          <>
            {apps.length > 1 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {apps.map((a, i) => (
                  <button
                    key={a.id}
                    onClick={() => setAppIndex(i)}
                    className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
                      i === appIndex ? "border-foreground text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {a.nickname} · {a.platform}
                  </button>
                ))}
              </div>
            )}
            <SettingsCard
              footer={<Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>}
            >
              <SettingsRow label="Application name" description="Shown under the launcher icon.">
                <Input value={app?.display_name ?? app?.nickname ?? ""} onChange={(e) => patchApp({ display_name: e.target.value })} className="h-8" />
              </SettingsRow>
              <SettingsRow label="Package ID" description="Reverse-domain identifier, e.g. com.acme.app.">
                <Input value={app?.package_id ?? app?.package_name ?? ""} onChange={(e) => patchApp({ package_id: e.target.value })} className="h-8 font-mono text-[12px]" />
              </SettingsRow>
              <SettingsRow label="Platform" description="Target platform for this application.">
                <Input readOnly value={app?.platform ?? ""} className="h-8 bg-muted/30" />
              </SettingsRow>
              <SettingsRow label="Version name" description="Human readable version, e.g. 1.4.0.">
                <Input value={app?.version_name ?? ""} onChange={(e) => patchApp({ version_name: e.target.value })} className="h-8" />
              </SettingsRow>
              <SettingsRow label="Version code" description="Integer incremented on every store release.">
                <Input
                  type="number"
                  value={app?.version_code ?? ""}
                  onChange={(e) => patchApp({ version_code: e.target.value ? Number(e.target.value) : null })}
                  className="h-8"
                />
              </SettingsRow>
            </SettingsCard>
          </>
        )}
      </div>

      {app && (
        <div className="mt-10">
          <SectionTitle>SDK &amp; build targets</SectionTitle>
          <SettingsCard footer={<Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>}>
            <SettingsRow label="Minimum SDK" description="Lowest Android API level the app installs on.">
              <Input
                type="number"
                value={app.min_sdk ?? ""}
                onChange={(e) => patchApp({ min_sdk: e.target.value ? Number(e.target.value) : null })}
                className="h-8"
              />
            </SettingsRow>
            <SettingsRow label="Target SDK" description="API level the app is compiled and tested against.">
              <Input
                type="number"
                value={app.target_sdk ?? ""}
                onChange={(e) => patchApp({ target_sdk: e.target.value ? Number(e.target.value) : null })}
                className="h-8"
              />
            </SettingsRow>
            <SettingsRow label="Web directory" description="Folder Capacitor copies into the native shell.">
              <Input value={app.webdir ?? ""} onChange={(e) => patchApp({ webdir: e.target.value })} className="h-8 font-mono text-[12px]" />
            </SettingsRow>
            <SettingsRow label="Build output directory" description="Where the web build writes its bundle.">
              <Input value={app.build_output_dir ?? ""} onChange={(e) => patchApp({ build_output_dir: e.target.value })} className="h-8 font-mono text-[12px]" />
            </SettingsRow>
          </SettingsCard>
        </div>
      )}
    </div>
  );
};

export default GeneralSettings;

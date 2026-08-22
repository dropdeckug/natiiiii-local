import { useState, useEffect } from "react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import {
  KeyRound, Upload, Copy, Download, Check, Trash2, Shield, AlertTriangle,
  Plus, Eye, EyeOff, Loader2, RefreshCw, FileKey, Fingerprint, Terminal, ExternalLink, ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useParams } from "react-router-dom";
import { useBuildStore } from "@/stores/buildStore";

interface Keystore {
  id: string;
  key_alias: string;
  sha1: string | null;
  sha256: string | null;
  md5: string | null;
  signing_mode: string | null;
  is_active: boolean | null;
  keystore_path: string | null;
  created_at: string | null;
  store_password_encrypted: string | null;
  key_password_encrypted: string | null;
}

interface IOSSigningConfig {
  bundleId?: string;
  teamId?: string;
  certificatePassword?: string;
  p12Path?: string;
  p12Filename?: string;
  provisioningProfilePath?: string;
  provisioningProfileFilename?: string;
  exportMethod?: string;
  provisioningProfileName?: string;
  codeSignIdentity?: string;
  appStoreConnectIssuerId?: string;
  appStoreConnectKeyId?: string;
  appStoreConnectApiKeyPath?: string;
  appStoreConnectApiKeyFilename?: string;
  updatedAt?: string;
}

interface IOSAppRow {
  id: string;
  nickname: string;
  package_name: string | null;
  config: Record<string, unknown> | null;
}

const CopyField = ({ label, value, hint }: { label: string; value: string | null; hint?: string }) => {
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
        {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-[12px] font-mono text-foreground bg-muted px-3 py-2 rounded-[4px] break-all select-all">{value}</code>
        <button onClick={handleCopy} className="p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0">
          {copied ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
};

const PasswordField = ({ label, value }: { label: string; value: string | null }) => {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-[12px] font-mono text-foreground bg-muted px-3 py-2 rounded-[4px] break-all select-all">
          {visible ? value : "••••••••"}
        </code>
        <button onClick={() => setVisible(!visible)} className="p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0">
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        <button onClick={handleCopy} className="p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0">
          {copied ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
};

const SigningPanel = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const activePlatform = useBuildStore((s) => s.activePlatform);
  const isIosSigning = activePlatform === "ios";
  const [keystores, setKeystores] = useState<Keystore[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [iosLoading, setIosLoading] = useState(true);
  const [iosSaving, setIosSaving] = useState(false);
  const [iosApp, setIosApp] = useState<IOSAppRow | null>(null);
  const [iosConfig, setIosConfig] = useState<IOSSigningConfig>({ exportMethod: "app-store" });
  const [iosP12File, setIosP12File] = useState<File | null>(null);
  const [iosProfileFile, setIosProfileFile] = useState<File | null>(null);
  const [iosApiKeyFile, setIosApiKeyFile] = useState<File | null>(null);
  const [showIosPassword, setShowIosPassword] = useState(false);

  // Upload form
  const [keyAlias, setKeyAlias] = useState("release-key");
  const [storePassword, setStorePassword] = useState("");
  const [keyPassword, setKeyPassword] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showUploadPasswords, setShowUploadPasswords] = useState(false);

  // Generate form
  const [genAlias, setGenAlias] = useState("release-key");
  const [genStorePass, setGenStorePass] = useState("android");
  const [genKeyPass, setGenKeyPass] = useState("android");
  const [genOrg, setGenOrg] = useState("NativeBridge");
  const [showGenForm, setShowGenForm] = useState(false);

  // Android build config (version + SDK)
  interface AndroidAppRow { id: string; nickname: string; package_name: string | null; version_name: string | null; version_code: number | null; min_sdk: number | null; target_sdk: number | null; }
  const [androidApp, setAndroidApp] = useState<AndroidAppRow | null>(null);
  const [buildCfg, setBuildCfg] = useState({ versionName: "1.0.0", versionCode: 1, minSdk: 24, targetSdk: 36 });
  const [buildCfgSaving, setBuildCfgSaving] = useState(false);

  const fetchKeystores = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from("keystores")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("project_id", projectId || "")
      .order("created_at", { ascending: false });
    if (data) setKeystores(data as Keystore[]);
    setLoading(false);
  };

  const fetchIosSigning = async () => {
    if (!projectId) return;
    setIosLoading(true);
    const { data } = await supabase
      .from("project_apps")
      .select("id, nickname, package_name, config")
      .eq("project_id", projectId)
      .eq("platform", "ios")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const app = (data as IOSAppRow | null) || null;
    setIosApp(app);
    const config = (app?.config || {}) as Record<string, unknown>;
    const saved = (config.iosSigning || {}) as IOSSigningConfig;
    setIosConfig({
      exportMethod: "app-store",
      bundleId: (saved.bundleId || (config.bundleId as string) || app?.package_name || "") as string,
      teamId: (saved.teamId || (config.teamId as string) || "") as string,
      ...saved,
    });
    setIosP12File(null);
    setIosProfileFile(null);
    setIosApiKeyFile(null);
    setIosLoading(false);
  };

  useEffect(() => { fetchKeystores(); }, [projectId]);
  useEffect(() => { if (isIosSigning) fetchIosSigning(); }, [isIosSigning, projectId]);

  useEffect(() => {
    if (isIosSigning || !projectId) return;
    (async () => {
      const { data } = await supabase
        .from("project_apps")
        .select("id, nickname, package_name, version_name, version_code, min_sdk, target_sdk")
        .eq("project_id", projectId)
        .eq("platform", "android")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      const row = data as AndroidAppRow | null;
      if (row) {
        setAndroidApp(row);
        setBuildCfg({
          versionName: row.version_name || "1.0.0",
          versionCode: row.version_code ?? 1,
          minSdk: row.min_sdk ?? 24,
          targetSdk: row.target_sdk ?? 36,
        });
      }
    })();
  }, [isIosSigning, projectId]);

  const saveBuildCfg = async () => {
    if (!androidApp) { toast({ title: "No Android app registered", variant: "destructive" }); return; }
    if (!buildCfg.versionName.trim()) { toast({ title: "Version name required", variant: "destructive" }); return; }
    if (!Number.isInteger(buildCfg.versionCode) || buildCfg.versionCode < 1) { toast({ title: "Version code must be a positive integer", variant: "destructive" }); return; }
    if (buildCfg.minSdk < 21 || buildCfg.minSdk > buildCfg.targetSdk) { toast({ title: "minSdk must be ≥21 and ≤ targetSdk", variant: "destructive" }); return; }
    if (buildCfg.targetSdk < 30 || buildCfg.targetSdk > 36) { toast({ title: "targetSdk should be 30–36", variant: "destructive" }); return; }
    setBuildCfgSaving(true);
    try {
      const { error } = await supabase.from("project_apps").update({
        version_name: buildCfg.versionName.trim(),
        version_code: buildCfg.versionCode,
        min_sdk: buildCfg.minSdk,
        target_sdk: buildCfg.targetSdk,
      }).eq("id", androidApp.id);
      if (error) throw error;
      toast({ title: "Build configuration saved", description: "Applied on the next build." });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setBuildCfgSaving(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !keyAlias) return;
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const filePath = `${session.user.id}/${projectId}/${Date.now()}-${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage.from("keystores").upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      if (keystores.length > 0) {
        await supabase.from("keystores").update({ is_active: false }).eq("user_id", session.user.id).eq("project_id", projectId || "");
      }

      const { error: insertError } = await supabase.from("keystores").insert({
        user_id: session.user.id,
        project_id: projectId,
        key_alias: keyAlias,
        signing_mode: "release",
        keystore_path: filePath,
        is_active: true,
        store_password_encrypted: storePassword || null,
        key_password_encrypted: keyPassword || null,
      });
      if (insertError) throw insertError;

      toast({ title: "Keystore uploaded", description: "Your signing key has been securely stored and set as active." });
      setSelectedFile(null);
      setKeyAlias("release-key");
      setStorePassword("");
      setKeyPassword("");
      fetchKeystores();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("build-apk", {
        body: {
          action: "generate-keystore",
          keyAlias: genAlias,
          keystorePassword: genStorePass,
          keyPassword: genKeyPass,
          appName: genOrg,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      let keystorePath: string | null = null;
      let fingerprints: { sha1?: string; sha256?: string; md5?: string } = {};

      if (data?.keystoreBase64) {
        const archiveBinary = atob(data.keystoreBase64);
        const archiveBytes = new Uint8Array(archiveBinary.length);
        for (let i = 0; i < archiveBinary.length; i++) archiveBytes[i] = archiveBinary.charCodeAt(i);

        const keystoreZip = await JSZip.loadAsync(archiveBytes);
        const b64Entry = Object.keys(keystoreZip.files).find((name) => name.endsWith(".b64"));
        if (!b64Entry) throw new Error("Generated keystore archive was missing the keystore payload");

        const b64Content = (await keystoreZip.files[b64Entry].async("text")).trim();
        const keystoreBinary = atob(b64Content);
        const keystoreBytes = new Uint8Array(keystoreBinary.length);
        for (let i = 0; i < keystoreBinary.length; i++) keystoreBytes[i] = keystoreBinary.charCodeAt(i);

        const blob = new Blob([keystoreBytes], { type: "application/octet-stream" });

        keystorePath = `${session.user.id}/${projectId}/${Date.now()}-generated.jks`;
        const { error: uploadErr } = await supabase.storage.from("keystores").upload(keystorePath, blob);
        if (uploadErr) {
          console.warn("Keystore upload warning:", uploadErr);
          keystorePath = null;
        }
      }

      if (data?.fingerprints) {
        fingerprints = data.fingerprints;
      }

      if (keystores.length > 0) {
        await supabase.from("keystores").update({ is_active: false }).eq("user_id", session.user.id).eq("project_id", projectId || "");
      }

      const { error: insertError } = await supabase.from("keystores").insert({
        user_id: session.user.id,
        project_id: projectId,
        key_alias: genAlias,
        signing_mode: "release",
        is_active: true,
        keystore_path: keystorePath,
        store_password_encrypted: genStorePass,
        key_password_encrypted: genKeyPass,
        sha1: fingerprints.sha1 || null,
        sha256: fingerprints.sha256 || null,
        md5: fingerprints.md5 || null,
      });
      if (insertError) throw insertError;

      toast({
        title: keystorePath ? "Keystore generated & saved" : "Keystore config saved",
        description: keystorePath
          ? "Your release keystore has been generated via secure cloud runner and saved."
          : "Signing credentials saved. A keystore will be generated on next build.",
      });
      setShowGenForm(false);
      fetchKeystores();
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const setActive = async (ksId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("keystores").update({ is_active: false }).eq("user_id", session.user.id).eq("project_id", projectId || "");
    await supabase.from("keystores").update({ is_active: true }).eq("id", ksId);
    fetchKeystores();
    toast({ title: "Active keystore updated" });
  };

  const deleteKeystore = async (ks: Keystore) => {
    if (ks.signing_mode === "release" && ks.is_active) {
      const confirmed = window.confirm(
        "⚠️ Deleting a release keystore is irreversible.\nYou will NOT be able to update your app on Google Play without this key.\n\nAre you sure?"
      );
      if (!confirmed) return;
    }
    if (ks.keystore_path) {
      await supabase.storage.from("keystores").remove([ks.keystore_path]);
    }
    await supabase.from("keystores").delete().eq("id", ks.id);
    fetchKeystores();
    toast({ title: "Keystore deleted" });
  };

  const downloadKeystore = async (ks: Keystore) => {
    if (!ks.keystore_path) return;
    try {
      const { data: signedData } = await supabase.storage
        .from("keystores")
        .createSignedUrl(ks.keystore_path, 60 * 60);

      if (signedData?.signedUrl) {
        const a = document.createElement("a");
        a.href = signedData.signedUrl;
        a.download = ks.keystore_path.split("/").pop() || "keystore.jks";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      const { data } = await supabase.storage.from("keystores").download(ks.keystore_path);
      if (data) {
        const url = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = url;
        a.download = ks.keystore_path.split("/").pop() || "keystore.jks";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        toast({ title: "Download failed", description: "Could not download keystore file", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Download failed", description: err?.message || "Unknown error", variant: "destructive" });
    }
  };

  const uploadIosFile = async (sessionUserId: string, file: File, kind: "cert" | "profile" | "api-key") => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${sessionUserId}/${projectId}/ios/${kind}-${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from("keystores").upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  };

  const handleSaveIosSigning = async () => {
    if (!projectId || !iosApp) return;
    setIosSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      if (!iosConfig.bundleId?.trim()) throw new Error("Bundle ID is required");
      if (!iosConfig.teamId?.trim()) throw new Error("Apple Team ID is required");
      if (!iosConfig.certificatePassword?.trim()) throw new Error("Certificate password is required");

      let p12Path = iosConfig.p12Path;
      let provisioningProfilePath = iosConfig.provisioningProfilePath;
      let appStoreConnectApiKeyPath = iosConfig.appStoreConnectApiKeyPath;

      if (iosP12File) p12Path = await uploadIosFile(session.user.id, iosP12File, "cert");
      if (iosProfileFile) provisioningProfilePath = await uploadIosFile(session.user.id, iosProfileFile, "profile");
      if (iosApiKeyFile) appStoreConnectApiKeyPath = await uploadIosFile(session.user.id, iosApiKeyFile, "api-key");
      if (!p12Path) throw new Error("Upload a .p12 distribution certificate");
      if (!provisioningProfilePath) throw new Error("Upload a .mobileprovision profile");

      const currentConfig = (iosApp.config || {}) as Record<string, unknown>;
      const nextSigning: IOSSigningConfig = {
        ...iosConfig,
        bundleId: iosConfig.bundleId.trim(),
        teamId: iosConfig.teamId.trim(),
        certificatePassword: iosConfig.certificatePassword,
        p12Path,
        p12Filename: iosP12File?.name || iosConfig.p12Filename,
        provisioningProfilePath,
        provisioningProfileFilename: iosProfileFile?.name || iosConfig.provisioningProfileFilename,
        exportMethod: iosConfig.exportMethod || "app-store",
        appStoreConnectApiKeyPath,
        appStoreConnectApiKeyFilename: iosApiKeyFile?.name || iosConfig.appStoreConnectApiKeyFilename,
        updatedAt: new Date().toISOString(),
      };

      const nextAppConfig = { ...currentConfig, bundleId: nextSigning.bundleId, teamId: nextSigning.teamId, iosSigning: nextSigning } as any;

      const { error } = await supabase
        .from("project_apps")
        .update({
          package_name: nextSigning.bundleId,
          config: nextAppConfig,
        })
        .eq("id", iosApp.id);
      if (error) throw error;

      toast({ title: "iOS signing saved", description: "Release builds will use these saved Apple signing credentials." });
      fetchIosSigning();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setIosSaving(false);
    }
  };

  const downloadIosCredential = async (path: string, filename: string) => {
    try {
      const { data: signedData } = await supabase.storage.from("keystores").createSignedUrl(path, 60 * 60);
      if (!signedData?.signedUrl) throw new Error("Could not create secure download URL");
      const a = document.createElement("a");
      a.href = signedData.signedUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      toast({ title: "Download failed", description: err?.message || "Unknown error", variant: "destructive" });
    }
  };

  const activeKeystore = keystores.find(k => k.is_active);

  const copyKeytoolCommand = (ks: Keystore) => {
    const cmd = `keytool -exportcert -alias ${ks.key_alias} -keystore ${ks.keystore_path?.split("/").pop() || "release.jks"} -rfc > cert.pem`;
    navigator.clipboard.writeText(cmd);
    toast({ title: "Command copied", description: "Paste this in your terminal after downloading the .jks file." });
  };

  const copyKeytoolListCommand = (ks: Keystore) => {
    const cmd = `keytool -keystore ${ks.keystore_path?.split("/").pop() || "release.jks"} -list -v`;
    navigator.clipboard.writeText(cmd);
    toast({ title: "Command copied", description: "Run this to see all certificate details." });
  };

  if (isIosSigning) {
    const iosReady = Boolean(iosConfig.bundleId && iosConfig.teamId && iosConfig.certificatePassword && iosConfig.p12Path && iosConfig.provisioningProfilePath);

    return (
      <div className="p-6 space-y-6 max-w-3xl">
        <div>
          <h2 className="text-lg font-semibold text-foreground">iOS Signing & Certificates</h2>
          <p className="text-sm text-muted-foreground">Manage Apple distribution certificates, provisioning profiles, and App Store release settings.</p>
        </div>

        <div className="rounded-[4px] border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/5 p-4 space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Shield size={14} className="text-[hsl(var(--warning))]" />
            Apple signing requirements
          </div>
          <p className="text-xs text-muted-foreground">
            Release .ipa builds require a distribution .p12 certificate, its password, an App Store provisioning profile, Bundle ID, and Team ID. Simulator builds do not need these fields.
          </p>
        </div>

        {iosLoading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading iOS signing settings...
          </div>
        ) : !iosApp ? (
          <div className="rounded-[4px] border border-dashed border-border p-6 text-center">
            <FileKey size={24} className="text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No iOS application registered.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Add an iOS application from the top app switcher before configuring production signing.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`rounded-[4px] border ${iosReady ? "border-primary/40 bg-primary/5" : "border-border bg-card"} p-4 space-y-2`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileKey size={14} className={iosReady ? "text-primary" : "text-muted-foreground"} />
                  <span className="text-sm font-medium text-foreground">{iosApp.nickname}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${iosReady ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {iosReady ? "Ready for release" : "Missing fields"}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchIosSigning} className="gap-1 text-xs">
                  <RefreshCw size={12} /> Refresh
                </Button>
              </div>
              {iosConfig.updatedAt && (
                <p className="text-[11px] text-muted-foreground">Updated {new Date(iosConfig.updatedAt).toLocaleString()}</p>
              )}
            </div>

            <div className="rounded-[4px] border border-border bg-card p-4 space-y-4">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <KeyRound size={14} /> App identity
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Bundle ID</label>
                  <Input value={iosConfig.bundleId || ""} onChange={(e) => setIosConfig((s) => ({ ...s, bundleId: e.target.value }))} className="mt-1 bg-background font-mono" placeholder="com.company.app" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Apple Team ID</label>
                  <Input value={iosConfig.teamId || ""} onChange={(e) => setIosConfig((s) => ({ ...s, teamId: e.target.value.toUpperCase() }))} className="mt-1 bg-background font-mono" placeholder="ABCDE12345" />
                </div>
              </div>
            </div>

            <div className="rounded-[4px] border border-border bg-card p-4 space-y-4">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Upload size={14} /> Distribution certificate
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Certificate file (.p12)</label>
                  <Input type="file" accept=".p12" onChange={(e) => setIosP12File(e.target.files?.[0] || null)} className="mt-1 bg-background" />
                  {(iosP12File || iosConfig.p12Filename) && (
                    <p className="text-[11px] text-muted-foreground mt-1">{iosP12File?.name || iosConfig.p12Filename}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Certificate password</label>
                  <div className="relative mt-1">
                    <Input type={showIosPassword ? "text" : "password"} value={iosConfig.certificatePassword || ""} onChange={(e) => setIosConfig((s) => ({ ...s, certificatePassword: e.target.value }))} className="bg-background pr-8" placeholder=".p12 password" />
                    <button onClick={() => setShowIosPassword(!showIosPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showIosPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Code signing identity</label>
                  <Input value={iosConfig.codeSignIdentity || ""} onChange={(e) => setIosConfig((s) => ({ ...s, codeSignIdentity: e.target.value }))} className="mt-1 bg-background" placeholder="Apple Distribution" />
                </div>
              </div>
              {iosConfig.p12Path && (
                <Button variant="outline" size="sm" onClick={() => {
                  if (iosConfig.p12Path) downloadIosCredential(iosConfig.p12Path, iosConfig.p12Filename || "certificate.p12");
                }} className="gap-1.5 text-xs">
                  <Download size={12} /> Download saved .p12
                </Button>
              )}
            </div>

            <div className="rounded-[4px] border border-border bg-card p-4 space-y-4">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <FileKey size={14} /> Provisioning profile
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Profile file (.mobileprovision)</label>
                  <Input type="file" accept=".mobileprovision" onChange={(e) => setIosProfileFile(e.target.files?.[0] || null)} className="mt-1 bg-background" />
                  {(iosProfileFile || iosConfig.provisioningProfileFilename) && (
                    <p className="text-[11px] text-muted-foreground mt-1">{iosProfileFile?.name || iosConfig.provisioningProfileFilename}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Provisioning profile name</label>
                  <Input value={iosConfig.provisioningProfileName || ""} onChange={(e) => setIosConfig((s) => ({ ...s, provisioningProfileName: e.target.value }))} className="mt-1 bg-background" placeholder="App Store profile name" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Export method</label>
                  <select value={iosConfig.exportMethod || "app-store"} onChange={(e) => setIosConfig((s) => ({ ...s, exportMethod: e.target.value }))} className="mt-1 h-10 w-full rounded-[4px] border border-input bg-background px-3 text-sm text-foreground">
                    <option value="app-store">App Store</option>
                    <option value="ad-hoc">Ad Hoc</option>
                    <option value="enterprise">Enterprise</option>
                    <option value="development">Development</option>
                  </select>
                </div>
              </div>
              {iosConfig.provisioningProfilePath && (
                <Button variant="outline" size="sm" onClick={() => {
                  if (iosConfig.provisioningProfilePath) downloadIosCredential(iosConfig.provisioningProfilePath, iosConfig.provisioningProfileFilename || "profile.mobileprovision");
                }} className="gap-1.5 text-xs">
                  <Download size={12} /> Download saved profile
                </Button>
              )}
            </div>

            <div className="rounded-[4px] border border-border bg-card p-4 space-y-4">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <ExternalLink size={14} /> App Store Connect API (optional)
              </h3>
              <p className="text-xs text-muted-foreground">Save these now if you later want automated TestFlight or App Store upload after the .ipa is created.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Issuer ID</label>
                  <Input value={iosConfig.appStoreConnectIssuerId || ""} onChange={(e) => setIosConfig((s) => ({ ...s, appStoreConnectIssuerId: e.target.value }))} className="mt-1 bg-background font-mono" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Key ID</label>
                  <Input value={iosConfig.appStoreConnectKeyId || ""} onChange={(e) => setIosConfig((s) => ({ ...s, appStoreConnectKeyId: e.target.value }))} className="mt-1 bg-background font-mono" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-muted-foreground">API key file (.p8)</label>
                  <Input type="file" accept=".p8" onChange={(e) => setIosApiKeyFile(e.target.files?.[0] || null)} className="mt-1 bg-background" />
                  {(iosApiKeyFile || iosConfig.appStoreConnectApiKeyFilename) && (
                    <p className="text-[11px] text-muted-foreground mt-1">{iosApiKeyFile?.name || iosConfig.appStoreConnectApiKeyFilename}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-[4px] border border-border bg-muted/30 p-4 space-y-2">
              <p className="text-xs font-medium text-foreground flex items-center gap-1.5"><Terminal size={12} /> Build behavior</p>
              <div className="grid gap-1.5 text-[11px] text-muted-foreground">
                <p>Simulator builds ignore production signing and output a zipped .app for testing.</p>
                <p>App Store builds inject these saved credentials into the macOS runner as repository secrets, archive the app, export a signed .ipa, then save the artifact back to the platform.</p>
              </div>
            </div>

            <Button onClick={handleSaveIosSigning} disabled={iosSaving} className="gap-1.5">
              {iosSaving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              {iosSaving ? "Saving iOS signing..." : "Save iOS Signing"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Signing & Certificates</h2>
        <p className="text-sm text-muted-foreground">Manage your signing keys, SHA fingerprints, passwords, and release certificates.</p>
      </div>

      {/* Security warning */}
      <div className="rounded-[4px] border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/5 p-4 space-y-1">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Shield size={14} className="text-[hsl(var(--warning))]" />
          Signing Key Security
        </div>
        <p className="text-xs text-muted-foreground">
          Your signing key uniquely identifies your app on Google Play. Keep it safe — you cannot update your app without it.
        </p>
      </div>

      {/* Android build configuration */}
      {androidApp && (
        <div className="rounded-[4px] border border-border bg-card p-4 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-foreground">Build configuration</h3>
            <p className="text-xs text-muted-foreground">Applied to <code className="font-mono">android/app/build.gradle</code> on the next build.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Version name</label>
              <Input value={buildCfg.versionName} onChange={(e) => setBuildCfg({ ...buildCfg, versionName: e.target.value })} placeholder="1.0.0" className="mt-1 bg-background" />
              <p className="text-[10px] text-muted-foreground/70 mt-1">User-visible version (e.g. 1.0.3) shown in Play Store and Settings → Apps.</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Version code</label>
              <Input type="number" min={1} step={1} value={buildCfg.versionCode} onChange={(e) => setBuildCfg({ ...buildCfg, versionCode: parseInt(e.target.value || "1", 10) })} className="mt-1 bg-background" />
              <p className="text-[10px] text-muted-foreground/70 mt-1">Internal integer Play Store uses to compare updates. Must go up with every upload.</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Min SDK</label>
              <Input type="number" min={21} max={36} step={1} value={buildCfg.minSdk} onChange={(e) => setBuildCfg({ ...buildCfg, minSdk: parseInt(e.target.value || "24", 10) })} className="mt-1 bg-background" />
              <p className="text-[10px] text-muted-foreground/70 mt-1">Lowest Android version your app runs on. Lower = more devices, more compatibility work.</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Target SDK</label>
              <Input type="number" min={30} max={36} step={1} value={buildCfg.targetSdk} onChange={(e) => setBuildCfg({ ...buildCfg, targetSdk: parseInt(e.target.value || "36", 10) })} className="mt-1 bg-background" />
              <p className="text-[10px] text-muted-foreground/70 mt-1">Android version you tested against. Play Store requires this to stay recent.</p>
            </div>
          </div>
          <Button onClick={saveBuildCfg} disabled={buildCfgSaving} size="sm" className="gap-1.5">
            {buildCfgSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {buildCfgSaving ? "Saving…" : "Save build configuration"}
          </Button>
        </div>
      )}


      <Tabs defaultValue="signing-keys" className="w-full">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="signing-keys" className="gap-1.5 text-xs">
            <FileKey size={14} /> Signing Keys
          </TabsTrigger>
          <TabsTrigger value="sha-certificates" className="gap-1.5 text-xs">
            <Fingerprint size={14} /> SHA Certificates
          </TabsTrigger>
        </TabsList>

        {/* ═══ Tab 1: Signing Keys ═══ */}
        <TabsContent value="signing-keys" className="space-y-4 mt-4">
          {/* Generate new keystore */}
          <div className="rounded-[4px] border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Plus size={14} /> Generate New Keystore
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setShowGenForm(!showGenForm)} className="text-xs">
                {showGenForm ? "Cancel" : "Generate"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Generates a real .jks keystore via secure cloud runner (keytool). SHA fingerprints are extracted automatically.
            </p>
            {showGenForm && (
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Key Alias</label>
                    <Input value={genAlias} onChange={(e) => setGenAlias(e.target.value)} className="mt-1 bg-background" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Organization Name</label>
                    <Input value={genOrg} onChange={(e) => setGenOrg(e.target.value)} className="mt-1 bg-background" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Store Password</label>
                    <Input value={genStorePass} onChange={(e) => setGenStorePass(e.target.value)} className="mt-1 bg-background" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Key Password</label>
                    <Input value={genKeyPass} onChange={(e) => setGenKeyPass(e.target.value)} className="mt-1 bg-background" />
                  </div>
                </div>
                <Button onClick={handleGenerate} disabled={generating || !genAlias} size="sm" className="gap-1.5">
                  {generating ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                  {generating ? "Generating via cloud runner..." : "Generate Keystore"}
                </Button>
              </div>
            )}
          </div>

          {/* Upload existing keystore */}
          <div className="rounded-[4px] border border-border bg-card p-4 space-y-3">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Upload size={14} /> Upload Existing Keystore
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Keystore File (.jks / .keystore)</label>
                <Input
                  type="file"
                  accept=".jks,.keystore"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="mt-1 bg-background"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Key Alias</label>
                <Input value={keyAlias} onChange={(e) => setKeyAlias(e.target.value)} className="mt-1 bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Store Password</label>
                <div className="relative mt-1">
                  <Input
                    type={showUploadPasswords ? "text" : "password"}
                    value={storePassword}
                    onChange={(e) => setStorePassword(e.target.value)}
                    className="bg-background pr-8"
                    placeholder="Store password"
                  />
                  <button onClick={() => setShowUploadPasswords(!showUploadPasswords)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showUploadPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Key Password</label>
                <div className="relative mt-1">
                  <Input
                    type={showUploadPasswords ? "text" : "password"}
                    value={keyPassword}
                    onChange={(e) => setKeyPassword(e.target.value)}
                    className="bg-background pr-8"
                    placeholder="Key password"
                  />
                </div>
              </div>
            </div>
            <Button onClick={handleUpload} disabled={!selectedFile || !keyAlias || uploading} size="sm" className="gap-1.5">
              <Upload size={14} /> {uploading ? "Uploading..." : "Upload Keystore"}
            </Button>
          </div>

          {/* Keystore list */}
          {loading ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading keystores...
            </div>
          ) : keystores.length === 0 ? (
            <div className="rounded-[4px] border border-dashed border-border p-6 text-center">
              <Shield size={24} className="text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No keystores configured yet.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Generate or upload a keystore above to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <KeyRound size={14} /> Managed Keystores ({keystores.length})
                </h3>
                <Button variant="ghost" size="sm" onClick={fetchKeystores} className="gap-1 text-xs">
                  <RefreshCw size={12} /> Refresh
                </Button>
              </div>
              {keystores.map((ks) => (
                <div key={ks.id} className={`rounded-[4px] border ${ks.is_active ? "border-primary/50 bg-primary/5" : "border-border bg-card"} p-4 space-y-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <KeyRound size={14} className={ks.is_active ? "text-primary" : "text-muted-foreground"} />
                      <span className="text-sm font-medium text-foreground">{ks.key_alias}</span>
                      {ks.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Active</span>}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${ks.signing_mode === "release" ? "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]" : "bg-muted text-muted-foreground"}`}>
                        {ks.signing_mode || "debug"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {!ks.is_active && (
                        <Button variant="ghost" size="sm" onClick={() => setActive(ks.id)} className="text-xs h-7">Set Active</Button>
                      )}
                      {ks.keystore_path && (
                        <button onClick={() => downloadKeystore(ks)} className="p-1.5 text-muted-foreground hover:text-foreground" title="Download .jks file">
                          <Download size={14} />
                        </button>
                      )}
                      <button onClick={() => deleteKeystore(ks)} className="p-1.5 text-muted-foreground hover:text-destructive" title="Delete keystore">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Passwords */}
                  {(ks.store_password_encrypted || ks.key_password_encrypted) && (
                    <div className="space-y-2 border-t border-border pt-3">
                      <PasswordField label="Store Password" value={ks.store_password_encrypted} />
                      <PasswordField label="Key Password" value={ks.key_password_encrypted} />
                    </div>
                  )}

                  {ks.created_at && (
                    <p className="text-[11px] text-muted-foreground">Created {new Date(ks.created_at).toLocaleDateString()}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ Tab 2: SHA Certificates ═══ */}
        <TabsContent value="sha-certificates" className="space-y-4 mt-4">
          {loading ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading certificates...
            </div>
          ) : !activeKeystore ? (
            <div className="rounded-[4px] border border-dashed border-border p-6 text-center">
              <Fingerprint size={24} className="text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No active keystore</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Generate or upload a keystore in the Signing Keys tab first.</p>
            </div>
          ) : (
            <>
              {/* Active keystore info */}
              <div className="rounded-[4px] border border-primary/30 bg-primary/5 p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <KeyRound size={14} className="text-primary" />
                  <span className="text-sm font-medium text-foreground">{activeKeystore.key_alias}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Active</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${activeKeystore.signing_mode === "release" ? "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]" : "bg-muted text-muted-foreground"}`}>
                    {activeKeystore.signing_mode || "debug"}
                  </span>
                </div>
                {activeKeystore.created_at && (
                  <p className="text-[11px] text-muted-foreground">Created {new Date(activeKeystore.created_at).toLocaleDateString()}</p>
                )}
              </div>

              {/* Fingerprints */}
              {(activeKeystore.sha1 || activeKeystore.sha256 || activeKeystore.md5) ? (
                <div className="rounded-[4px] border border-border bg-card p-4 space-y-4">
                  <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Fingerprint size={14} /> Certificate Fingerprints
                  </h3>

                  <CopyField label="SHA-1" value={activeKeystore.sha1} hint="Firebase, Google Auth, Maps API" />
                  <CopyField label="SHA-256" value={activeKeystore.sha256} hint="App Links, Play App Signing" />
                  <CopyField label="MD5" value={activeKeystore.md5} hint="Legacy services" />

                  {/* Usage guide */}
                  <div className="rounded-[4px] bg-muted/50 p-3 space-y-2 border-t border-border mt-3">
                    <p className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
                      <ExternalLink size={12} /> Where to use these fingerprints
                    </p>
                    <div className="grid gap-1.5 text-[11px] text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <span className="text-foreground font-medium shrink-0">SHA-1:</span>
                        <span>Firebase Console, Google OAuth Client ID, Google Maps API key restrictions</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-foreground font-medium shrink-0">SHA-256:</span>
                        <span>Android App Links (Digital Asset Links), Play App Signing verification</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-foreground font-medium shrink-0">MD5:</span>
                        <span>Legacy API integrations (deprecated by most services)</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[4px] border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/5 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <AlertTriangle size={14} className="text-[hsl(var(--warning))]" />
                    Fingerprints Not Available
                  </div>
                  <p className="text-xs text-muted-foreground">
                    SHA fingerprints will be extracted automatically after the next successful build, or when you generate a new keystore.
                  </p>
                </div>
              )}

              {/* PEM Export / keytool commands */}
              <div className="rounded-[4px] border border-border bg-card p-4 space-y-3">
                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Terminal size={14} /> Export & Commands
                </h3>
                <p className="text-xs text-muted-foreground">
                  Use these commands locally after downloading your .jks file to export PEM certificates or view full details.
                </p>

                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Export PEM Certificate</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-[11px] font-mono text-foreground bg-muted px-3 py-2 rounded-[4px] break-all select-all">
                        keytool -exportcert -alias {activeKeystore.key_alias} -keystore {activeKeystore.keystore_path?.split("/").pop() || "release.jks"} -rfc &gt; cert.pem
                      </code>
                      <button onClick={() => copyKeytoolCommand(activeKeystore)} className="p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0">
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">View Full Certificate</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-[11px] font-mono text-foreground bg-muted px-3 py-2 rounded-[4px] break-all select-all">
                        keytool -keystore {activeKeystore.keystore_path?.split("/").pop() || "release.jks"} -list -v
                      </code>
                      <button onClick={() => copyKeytoolListCommand(activeKeystore)} className="p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0">
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Download JKS */}
                {activeKeystore.keystore_path && (
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button variant="outline" size="sm" onClick={() => downloadKeystore(activeKeystore)} className="gap-1.5 text-xs">
                      <Download size={12} /> Download .jks
                    </Button>
                  </div>
                )}
              </div>

              {/* Other keystores with fingerprints */}
              {keystores.filter(k => !k.is_active && (k.sha1 || k.sha256 || k.md5)).length > 0 && (
                <div className="rounded-[4px] border border-border bg-card p-4 space-y-3">
                  <h3 className="text-sm font-medium text-foreground">Other Keystores with Certificates</h3>
                  {keystores.filter(k => !k.is_active && (k.sha1 || k.sha256 || k.md5)).map((ks) => (
                    <div key={ks.id} className="rounded-[4px] border border-border p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <KeyRound size={12} className="text-muted-foreground" />
                        <span className="text-xs font-medium text-foreground">{ks.key_alias}</span>
                        <span className="text-[10px] text-muted-foreground">{ks.signing_mode}</span>
                      </div>
                      <CopyField label="SHA-1" value={ks.sha1} />
                      <CopyField label="SHA-256" value={ks.sha256} />
                      <CopyField label="MD5" value={ks.md5} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SigningPanel;

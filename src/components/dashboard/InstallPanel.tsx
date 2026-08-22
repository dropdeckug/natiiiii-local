/**
 * InstallPanel — Real ADB-over-WebUSB install (Android Studio-style).
 *
 * Uses @yume-chan/adb to:
 *  - Pair an Android device via WebUSB (Chrome/Edge/Opera on desktop).
 *  - Authenticate with the device using an RSA key cached in IndexedDB
 *    (the "Allow USB debugging" prompt only appears the first time).
 *  - Stream the latest APK artifact straight to `pm install` on the phone.
 *  - Optionally launch the freshly installed app via `monkey`.
 *
 * Falls back to a plain APK download for browsers without WebUSB.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Smartphone, CheckCircle2, Download, AlertTriangle, Usb, RefreshCw, Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import deviceImage from "@/assets/device-not-connected.png";

import { Adb, AdbDaemonTransport } from "@yume-chan/adb";
import { AdbDaemonWebUsbDeviceManager } from "@yume-chan/adb-daemon-webusb";
import AdbWebCredentialStore from "@yume-chan/adb-credential-web";
import { PackageManager } from "@yume-chan/android-bin";

interface PairedDevice {
  name: string;
  serial: string;
  model?: string;
  androidVersion?: string;
}

interface LatestArtifact {
  id: string;
  app_name: string;
  package_name: string;
  apk_url: string | null;
  created_at: string;
}

type Stage =
  | { kind: "idle" }
  | { kind: "connecting"; label: string }
  | { kind: "authorizing"; label: string }
  | { kind: "downloading"; label: string; pct?: number }
  | { kind: "installing"; label: string; pct?: number }
  | { kind: "launching"; label: string }
  | { kind: "done" }
  | { kind: "error"; message: string };

const credentialStore = new AdbWebCredentialStore("NativeBridge");

const InstallPanel = () => {
  const { id: projectId } = useParams<{ id: string }>();

  const [device, setDevice] = useState<PairedDevice | null>(null);
  const [adbReady, setAdbReady] = useState(false);
  const [artifact, setArtifact] = useState<LatestArtifact | null>(null);
  const [loadingArtifact, setLoadingArtifact] = useState(true);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [launchAfterInstall, setLaunchAfterInstall] = useState(true);
  const adbRef = useRef<Adb | null>(null);

  const webUsbSupported = typeof navigator !== "undefined" && "usb" in navigator;
  const manager = AdbDaemonWebUsbDeviceManager.BROWSER;

  /* ── Load latest artifact that actually has an APK ── */
  const loadArtifact = useCallback(async (opts?: { silent?: boolean }) => {
    if (!projectId) { setLoadingArtifact(false); return; }
    if (!opts?.silent) setLoadingArtifact(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoadingArtifact(false); return; }
    // Latest build with a non-null apk_url — a build row is written as "success"
    // before the artifact upload finishes, so filtering on status alone can
    // return a row whose apk_url is still null (install button stays disabled).
    const { data } = await supabase
      .from("builds")
      .select("id, app_name, package_name, apk_url, created_at")
      .eq("project_id", projectId)
      .eq("user_id", session.user.id)
      .not("apk_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) setArtifact(data as LatestArtifact);
    setLoadingArtifact(false);
  }, [projectId]);

  useEffect(() => { void loadArtifact(); }, [loadArtifact]);

  /* ── Keep the artifact fresh: realtime + focus + slow poll ── */
  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`install-builds-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "builds", filter: `project_id=eq.${projectId}` },
        () => { void loadArtifact({ silent: true }); })
      .subscribe();
    const onFocus = () => { void loadArtifact({ silent: true }); };
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => { void loadArtifact({ silent: true }); }, 20000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [projectId, loadArtifact]);

  /* ── Try to connect to any already-paired device on mount ── */
  useEffect(() => {
    if (!manager) return;
    (async () => {
      try {
        const devs = await manager.getDevices();
        if (devs.length > 0) await connectToDevice(devs[0], /* silent */ true);
      } catch { /* silent */ }
    })();
    return () => { void disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const disconnect = async () => {
    try { await adbRef.current?.close(); } catch { /* ignore */ }
    adbRef.current = null;
    setAdbReady(false);
  };

  const connectToDevice = useCallback(async (dev: any, silent = false) => {
    setStage({ kind: "connecting", label: `Opening ${dev.name || "device"}…` });
    try {
      const connection = await dev.connect();
      setStage({ kind: "authorizing", label: "Waiting for USB debugging authorization on phone…" });
      const transport = await AdbDaemonTransport.authenticate({
        serial: dev.serial,
        connection,
        credentialStore,
      });
      const adb = new Adb(transport);
      adbRef.current = adb;
      setAdbReady(true);

      // Probe basic device info
      let model: string | undefined;
      let release: string | undefined;
      try {
        model = (await adb.subprocess.noneProtocol.spawnWaitText("getprop ro.product.model")).trim();
        release = (await adb.subprocess.noneProtocol.spawnWaitText("getprop ro.build.version.release")).trim();
      } catch { /* ignore — non-fatal */ }

      setDevice({
        name: dev.name || model || "Android device",
        serial: dev.serial,
        model,
        androidVersion: release,
      });
      setStage({ kind: "idle" });
      if (!silent) toast.success(`Connected to ${model || dev.name || "device"}`);
    } catch (e: any) {
      const msg = e?.message || String(e);
      setStage({ kind: "error", message: msg });
      if (!silent) toast.error(`Connect failed: ${msg}`);
    }
  }, []);

  const requestDevice = async () => {
    if (!manager) {
      toast.error("WebUSB is not available. Use Chrome, Edge, or Opera on desktop.");
      return;
    }
    try {
      const dev = await manager.requestDevice();
      if (!dev) return;
      await disconnect();
      await connectToDevice(dev);
    } catch (e: any) {
      if (e?.name !== "NotFoundError") toast.error(e?.message || "Pair failed");
    }
  };

  // apk_url can be a storage path OR (for oversized artifacts) a GitHub run URL,
  // which is an HTML page — not installable.
  const apkPath = artifact?.apk_url ?? null;
  const isGithubRunUrl = Boolean(apkPath && /github\.com\//i.test(apkPath) && !/\.apk($|\?)/i.test(apkPath));
  const installableApk = Boolean(apkPath && !isGithubRunUrl);

  const canInstall = Boolean(device && adbReady && installableApk &&
    (stage.kind === "idle" || stage.kind === "done" || stage.kind === "error"));
  void canInstall;


  const startInstall = async () => {
    if (!device || !adbReady || !apkPath) {
      toast.error(!device ? "Pair a device first." : "No installable APK found for this project yet.");
      return;
    }
    if (isGithubRunUrl) {
      toast.error("This build's APK is too large to stream — download it from GitHub instead.");
      return;
    }
    const adb = adbRef.current;
    if (!adb) { toast.error("Device connection lost — pair the device again."); return; }

    try {
      setStage({ kind: "downloading", label: "Downloading APK…" });
      let blob: Blob;
      if (apkPath.startsWith("http")) {
        const res = await fetch(apkPath);
        if (!res.ok) throw new Error(`Failed to download APK (HTTP ${res.status})`);
        blob = await res.blob();
      } else {
        // Storage path → download through the SDK (authenticated, no CORS issues)
        const { data, error } = await supabase.storage.from("build-artifacts").download(apkPath);
        if (error || !data) throw new Error(error?.message || "Failed to download APK from storage");
        blob = data;
      }
      const size = blob.size;
      if (!size) throw new Error("Downloaded APK is empty");


      // 3. Stream-install via PackageManager
      setStage({ kind: "installing", label: `Installing ${formatBytes(size)} to device…` });
      const pm = new PackageManager(adb);

      // Wrap blob stream with progress tracking
      let pushed = 0;
      const tracking = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          pushed += chunk.byteLength;
          const pct = Math.min(99, Math.round((pushed / size) * 100));
          setStage({ kind: "installing", label: `Installing on device… ${pct}%`, pct });
          controller.enqueue(chunk);
        },
      });
      const stream = blob.stream().pipeThrough(tracking) as unknown as ReadableStream<Uint8Array>;

      await pm.installStream(size, stream as any);

      // 4. Optionally launch
      if (launchAfterInstall && artifact.package_name) {
        setStage({ kind: "launching", label: `Launching ${artifact.package_name}…` });
        try {
          await adb.subprocess.noneProtocol.spawnWaitText(
            `monkey -p ${artifact.package_name} -c android.intent.category.LAUNCHER 1`
          );
        } catch { /* non-fatal */ }
      }

      setStage({ kind: "done" });
      toast.success("App installed");
    } catch (e: any) {
      const msg = e?.message || String(e);
      setStage({ kind: "error", message: msg });
      toast.error(`Install failed: ${msg}`);
    }
  };

  /* ── Downloadable APK fallback ── */
  const downloadApk = async () => {
    if (!artifact?.apk_url) return;
    let url = artifact.apk_url;
    if (!url.startsWith("http")) {
      const { data } = await supabase.storage
        .from("build-artifacts")
        .createSignedUrl(url, 60 * 60);
      if (data?.signedUrl) url = data.signedUrl;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.app_name || "app"}.apk`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const busy = ["connecting", "authorizing", "downloading", "installing", "launching"].includes(stage.kind);

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <header>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Smartphone size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Install to phone</h1>
              <p className="text-sm text-muted-foreground">
                Real ADB install over USB — exactly how Android Studio does it.
              </p>
            </div>
          </div>
        </header>

        {/* Device status card */}
        <div
          className={`rounded-xl p-6 flex flex-col items-center text-center ${
            !device && !busy && stage.kind !== "done"
              ? "bg-transparent"
              : "border border-border bg-card/40"
          }`}
        >
          {!device && !busy && stage.kind !== "done" && (
            <>
              <img
                src={deviceImage}
                alt="Phone waiting for USB connection"
                className="w-56 h-auto mb-6 select-none drop-shadow-[0_10px_30px_hsl(var(--primary)/0.25)]"
                draggable={false}
                style={{ background: "transparent" }}
              />
              <h2 className="text-lg font-semibold text-foreground mb-1">No device connected</h2>
              <p className="text-sm text-muted-foreground max-w-sm mb-5">
                Plug your phone in via USB and tap <span className="text-foreground">Pair device</span> to grant access.
              </p>
              <Button
                onClick={requestDevice}
                disabled={!webUsbSupported}
                className="gap-2 h-11 px-6 rounded-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 hover:brightness-110 hover:shadow-primary/40 transition-all"
              >
                <Usb size={16} /> Pair device
              </Button>
              {!webUsbSupported && (
                <p className="text-[11px] text-[hsl(var(--warning))] mt-3 max-w-sm">
                  WebUSB isn't available here. Use Chrome, Edge, or Opera on desktop to install over USB.
                </p>
              )}
            </>
          )}


          {device && !busy && stage.kind !== "done" && (
            <>
              <div className="w-16 h-16 rounded-full bg-[hsl(var(--success))]/10 flex items-center justify-center mb-3">
                <Smartphone size={28} className="text-[hsl(var(--success))]" />
              </div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Connected</p>
              <h2 className="text-base font-semibold text-foreground">{device.model || device.name}</h2>
              <p className="text-xs text-muted-foreground">
                {device.androidVersion && <>Android {device.androidVersion} · </>}
                <span className="font-mono">{device.serial.slice(0, 16)}</span>
              </p>
              <button
                onClick={requestDevice}
                className="mt-2 text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <RefreshCw size={10} /> Switch device
              </button>
            </>
          )}

          {busy && (
            <div className="flex flex-col items-center py-6">
              <div className="relative w-32 h-32 flex items-center justify-center mb-5">
                <Loader2 size={128} className="animate-spin text-primary" strokeWidth={1.25} />
                <Smartphone size={36} className="absolute text-foreground/80" />
              </div>
              <p className="text-[11px] uppercase tracking-wider text-primary mb-1">{stage.kind}</p>
              <p className="text-sm font-medium text-foreground transition-all">
                {"label" in stage ? stage.label : ""}
              </p>
            </div>
          )}

          {stage.kind === "done" && (
            <div className="flex flex-col items-center py-6">
              <div className="w-20 h-20 rounded-full bg-[hsl(var(--success))]/10 flex items-center justify-center mb-3">
                <CheckCircle2 size={42} className="text-[hsl(var(--success))]" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Install complete</h2>
              <p className="text-xs text-muted-foreground max-w-sm">
                {launchAfterInstall ? "The app should be launching on your device now." : "Open the app from your home screen to launch it."}
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setStage({ kind: "idle" })}>
                Install again
              </Button>
            </div>
          )}

          {stage.kind === "error" && (
            <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-start gap-2 max-w-md">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span className="text-left">{stage.message}</span>
            </div>
          )}
        </div>

        {/* Artifact + install */}
        <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Latest build</p>
              {loadingArtifact ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Loader2 size={12} className="animate-spin" /> Looking up artifact…
                </div>
              ) : artifact?.apk_url ? (
                <div className="mt-0.5">
                  <p className="text-sm font-semibold text-foreground truncate">{artifact.app_name}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">{artifact.package_name}</p>
                  {isGithubRunUrl && (
                    <p className="text-[11px] text-[hsl(var(--warning))] mt-1">
                      APK was too large to store — download it from the GitHub run instead.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-0.5">
                  No build artifact yet — run a build first.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadArtifact()}
                className="gap-2"
                title="Check for the latest APK"
              >
                <RefreshCw size={14} /> Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={downloadApk} disabled={!artifact?.apk_url} className="gap-2">
                <Download size={14} /> Download APK
              </Button>
              <Button onClick={startInstall} disabled={busy || !installableApk || !device} className="gap-2">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                Install to device
              </Button>
            </div>

          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <Checkbox
              checked={launchAfterInstall}
              onCheckedChange={(v) => setLaunchAfterInstall(Boolean(v))}
            />
            Launch app after install
          </label>
        </div>

        {/* Tips */}
        <details className="rounded-lg border border-border bg-card/30 px-4 py-3 text-sm">
          <summary className="font-medium text-foreground cursor-pointer">
            How to enable USB debugging
          </summary>
          <ol className="mt-3 space-y-1.5 text-xs text-muted-foreground list-decimal pl-5">
            <li>Open <strong>Settings → About phone</strong> and tap <strong>Build number</strong> seven times to unlock Developer options.</li>
            <li>Go to <strong>Settings → System → Developer options</strong>.</li>
            <li>Enable <strong>USB debugging</strong>.</li>
            <li>Plug the phone into your computer with a USB cable, then accept the "Allow USB debugging?" prompt.</li>
            <li>Come back here and click <strong>Pair device</strong>.</li>
          </ol>
        </details>
      </div>
    </div>
  );
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default InstallPanel;

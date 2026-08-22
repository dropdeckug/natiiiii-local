import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useParams } from "react-router-dom";
import { Download, Package, FileArchive, Clock, CheckCircle2, XCircle, HardDrive, Loader2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface BuildArtifact {
  id: string;
  app_name: string;
  package_name: string;
  engine: string;
  status: string;
  apk_url: string | null;
  aab_url: string | null;
  created_at: string;
  completed_at: string | null;
}

const ArtifactsPanel = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const [builds, setBuilds] = useState<BuildArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("builds")
        .select("id, app_name, package_name, engine, status, apk_url, aab_url, created_at, completed_at")
        .eq("user_id", session.user.id)
        .eq("project_id", projectId || "")
        .order("created_at", { ascending: false });
      if (data) setBuilds(data as BuildArtifact[]);
      setLoading(false);
    })();
  }, [projectId]);

  const handleDownload = async (storedUrl: string, filename: string) => {
    setDownloading(filename);
    try {
      // Check if it's a storage path (userId/jobId/file) or a signed URL
      const isStoragePath = !storedUrl.startsWith("http");

      if (isStoragePath) {
        // Generate a fresh signed URL from the storage path
        const { data: signedData, error: signedErr } = await supabase.storage
          .from("build-artifacts")
          .createSignedUrl(storedUrl, 60 * 60); // 1 hour expiry

        if (signedErr || !signedData?.signedUrl) {
          // Fallback: try direct download
          const { data: dlData } = await supabase.storage.from("build-artifacts").download(storedUrl);
          if (dlData) {
            const blobUrl = URL.createObjectURL(dlData);
            triggerDownload(blobUrl, filename);
            URL.revokeObjectURL(blobUrl);
            return;
          }
          throw new Error("Could not generate download URL");
        }

        // Open the signed URL for download
        triggerDownload(signedData.signedUrl, filename);
      } else {
        // It's already a full URL (possibly expired signed URL) - try it first
        try {
          const resp = await fetch(storedUrl);
          if (resp.ok) {
            const blob = await resp.blob();
            const blobUrl = URL.createObjectURL(blob);
            triggerDownload(blobUrl, filename);
            URL.revokeObjectURL(blobUrl);
            return;
          }
        } catch {}

        // If the signed URL expired, try to extract the storage path and regenerate
        // Pattern: /object/sign/build-artifacts/userId/jobId/file?...
        const pathMatch = storedUrl.match(/build-artifacts\/(.+?)(?:\?|$)/);
        if (pathMatch) {
          const storagePath = decodeURIComponent(pathMatch[1]);
          const { data: signedData } = await supabase.storage
            .from("build-artifacts")
            .createSignedUrl(storagePath, 60 * 60);

          if (signedData?.signedUrl) {
            triggerDownload(signedData.signedUrl, filename);
            return;
          }
        }

        // Last resort: try direct download
        const { data: dlData } = await supabase.storage.from("build-artifacts").download(storedUrl);
        if (dlData) {
          const blobUrl = URL.createObjectURL(dlData);
          triggerDownload(blobUrl, filename);
          URL.revokeObjectURL(blobUrl);
          return;
        }

        toast({ title: "Download failed", description: "The artifact URL has expired. Please rebuild.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Download failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyPackage = async (packageName: string) => {
    await navigator.clipboard.writeText(packageName);
    toast({ title: "Package ID copied", description: packageName });
  };

  const buildsWithArtifacts = builds.filter((b) => b.apk_url || b.aab_url);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading artifacts...</div>;

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Artifacts & Downloads</h2>
        <p className="text-sm text-muted-foreground">Download your APK and AAB files from completed builds.</p>
      </div>

      {buildsWithArtifacts.length === 0 ? (
        <div className="rounded-[4px] border border-dashed border-border p-8 text-center">
          <HardDrive size={32} className="text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No build artifacts yet.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Completed builds with APK/AAB files will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {buildsWithArtifacts.map((build) => {
            const artifactBaseName = build.package_name || build.app_name.replace(/\s+/g, "_");
            const isIos = /ios/i.test(build.engine || "");
            const apkFilename = isIos ? `${artifactBaseName}.ipa` : `${artifactBaseName}.apk`;
            const aabFilename = `${artifactBaseName}.aab`;

            return (
              <div key={build.id} className="rounded-[4px] border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {build.status === "success" ? (
                      <CheckCircle2 size={14} className="text-primary" />
                    ) : (
                      <XCircle size={14} className="text-destructive" />
                    )}
                    <span className="text-sm font-medium text-foreground">{build.app_name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{build.engine}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock size={12} />
                    {new Date(build.created_at).toLocaleDateString()} {new Date(build.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>

                <button
                  onClick={() => copyPackage(build.package_name)}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-[4px] bg-muted px-2 py-1 text-xs text-muted-foreground font-mono hover:text-foreground transition-colors"
                  title="Copy package ID"
                >
                  <span className="truncate">{build.package_name}</span>
                  <Copy size={11} className="shrink-0" />
                </button>

                <div className="flex items-center gap-2">
                  {build.apk_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      disabled={downloading === apkFilename}
                      onClick={() => handleDownload(build.apk_url!, apkFilename)}
                    >
                      {downloading === apkFilename ? <Loader2 size={13} className="animate-spin" /> : <FileArchive size={13} />}
                      {isIos ? "Download IPA" : "Download APK"}
                    </Button>
                  )}
                  {!isIos && build.aab_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      disabled={downloading === aabFilename}
                      onClick={() => handleDownload(build.aab_url!, aabFilename)}
                    >
                      {downloading === aabFilename ? <Loader2 size={13} className="animate-spin" /> : <Package size={13} />}
                      Download AAB
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* All builds list */}
      {builds.length > 0 && builds.length !== buildsWithArtifacts.length && (
        <div className="mt-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">All Builds ({builds.length})</h3>
          <div className="rounded-[4px] border border-border divide-y divide-border">
            {builds.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${b.status === "success" ? "bg-primary" : b.status === "failed" ? "bg-destructive" : "bg-warning"}`} />
                  <span className="text-foreground">{b.app_name}</span>
                  <span className="hidden sm:inline text-xs text-muted-foreground font-mono">{b.package_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  {b.apk_url && <Download size={12} className="text-muted-foreground" />}
                  {b.aab_url && <Package size={12} className="text-muted-foreground" />}
                  <span className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ArtifactsPanel;

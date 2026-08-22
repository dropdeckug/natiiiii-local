/**
 * TOOL 10: Artifact Downloader
 * Downloads built APK from the edge function and converts to blob.
 */

import { supabase } from "@/integrations/supabase/client";

export interface ArtifactResult {
  blob: Blob;
  sizeMB: number;
  name: string;
}

export async function downloadArtifact(
  repoName: string,
  runId: number,
  edgeFunction: string = "build-apk"
): Promise<ArtifactResult> {
  const { data, error } = await supabase.functions.invoke(edgeFunction, {
    body: { action: "download", repoName, runId },
  });

  if (error) throw new Error(`Download failed: ${error.message}`);
  if (data?.error) throw new Error(data.error);
  if (!data?.artifactBase64) throw new Error("No artifact data in response");

  // Decode base64 to blob
  const binary = atob(data.artifactBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: "application/vnd.android.package-archive" });

  return {
    blob,
    sizeMB: Math.round(blob.size / (1024 * 1024) * 10) / 10,
    name: data.artifactName || "debug-apk",
  };
}

export async function cleanupRepo(repoName: string, edgeFunction: string = "build-apk"): Promise<boolean> {
  try {
    const { data } = await supabase.functions.invoke(edgeFunction, {
      body: { action: "delete-repo", repoName },
    });
    return data?.success === true;
  } catch {
    return false;
  }
}

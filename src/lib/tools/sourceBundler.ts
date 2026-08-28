/**
 * TOOL 6: Source Bundler
 * Packages project files into a ZIP archive for build workflows or storage.
 */

import JSZip from "jszip";
import type { ProjectFile } from "@/stores/projectStore";

export interface BundleResult {
  blob: Blob;
  sizeBytes: number;
  sizeKb: number;
  fileCount: number;
  manifest: string[];
}

/**
 * Recursively bundles project files into a ZIP Blob.
 */
export async function bundleSource(files: ProjectFile[]): Promise<BundleResult> {
  const zip = new JSZip();
  const manifest: string[] = [];

  const addFiles = (nodes: ProjectFile[]) => {
    for (const node of nodes) {
      if (node.type === "file") {
        manifest.push(node.path);
        if (node.isBinary && node.binaryContent) {
          zip.file(node.path, node.binaryContent);
        } else if (node.content !== undefined) {
          zip.file(node.path, node.content);
        }
      }
      if (node.children && node.children.length > 0) {
        addFiles(node.children);
      }
    }
  };

  addFiles(files);

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const sizeBytes = blob.size;
  const sizeKb = Math.round((sizeBytes / 1024) * 10) / 10;

  return {
    blob,
    sizeBytes,
    sizeKb,
    fileCount: manifest.length,
    manifest,
  };
}

/**
 * Generates log lines from bundle result.
 */
export function bundleResultToLogs(result: BundleResult): string[] {
  const logs: string[] = [];
  logs.push(`✓ Bundled ${result.fileCount} source files into ZIP archive`);
  logs.push(`  Archive size: ${result.sizeKb} KB (${result.sizeBytes} bytes)`);
  return logs;
}

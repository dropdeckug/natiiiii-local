/**
 * TOOL 14: Build Logger
 * Streams build events to both the Zustand store and Supabase in real-time.
 */

import { useBuildStore } from "@/stores/buildStore";
import { supabase } from "@/integrations/supabase/client";

export interface BuildLoggerOptions {
  jobId: string;
  persistInterval?: number; // ms between DB persists, default 5000
}

export class BuildLogger {
  private jobId: string;
  private lastPersist = 0;
  private persistInterval: number;

  constructor(options: BuildLoggerOptions) {
    this.jobId = options.jobId;
    this.persistInterval = options.persistInterval || 5000;
  }

  log(message: string) {
    useBuildStore.getState().appendLog(this.jobId, message);
    this.maybePersist();
  }

  logs(messages: string[]) {
    useBuildStore.getState().appendLogs(this.jobId, messages);
    this.maybePersist();
  }

  stage(label: string) {
    useBuildStore.getState().updateJob(this.jobId, { stage: label });
    this.maybePersist();
  }

  status(status: "queued" | "uploading" | "building" | "success" | "failure" | "timeout", extra?: Record<string, any>) {
    useBuildStore.getState().updateJob(this.jobId, { status, ...extra });
    this.forcePersist();
  }

  error(message: string) {
    useBuildStore.getState().updateJob(this.jobId, { error: message });
    this.forcePersist();
  }

  private maybePersist() {
    const now = Date.now();
    if (now - this.lastPersist > this.persistInterval) {
      this.forcePersist();
    }
  }

  async forcePersist() {
    this.lastPersist = Date.now();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const job = useBuildStore.getState().getJob(this.jobId);
      if (!job) return;

      const { data: existing } = await supabase
        .from("builds")
        .select("id")
        .eq("id", this.jobId)
        .maybeSingle();

      const payload = {
        status: job.status,
        stage: job.stage,
        logs: job.logs,
        error: job.error || null,
        repo_name: job.repoName || null,
        repo_url: job.repoUrl || null,
        completed_at: job.completedAt ? new Date(job.completedAt).toISOString() : null,
      };

      if (existing) {
        await supabase.from("builds").update(payload).eq("id", this.jobId);
      } else {
        await supabase.from("builds").insert({
          id: this.jobId,
          user_id: session.user.id,
          app_name: job.appName,
          package_name: job.packageName,
          engine: job.engine,
          ...payload,
        });
      }
    } catch (e) {
      console.error("BuildLogger persist failed:", e);
    }
  }
}

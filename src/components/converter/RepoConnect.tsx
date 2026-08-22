import { useState } from "react";
import { GitBranch, ArrowRight, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/stores/projectStore";

const RepoConnect = () => {
  const { repoUrl, repoBranch, repoConnected, setRepoUrl, setRepoBranch, setRepoConnected } = useProjectStore();
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">(
    repoConnected ? "connected" : "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");

  const isValidRepo = (url: string) => {
    return /^https:\/\/(github|gitlab|bitbucket)\.(com|org)\/[\w.-]+\/[\w.-]+/.test(url);
  };

  const extractRepoInfo = (url: string) => {
    const match = url.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)/);
    if (match) return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
    return null;
  };

  const handleConnect = async () => {
    if (!isValidRepo(repoUrl)) return;
    setStatus("connecting");
    setErrorMsg("");

    const info = extractRepoInfo(repoUrl);
    if (!info) {
      // Non-GitHub repos — just accept
      setStatus("connected");
      setRepoConnected(true);
      return;
    }

    try {
      // Validate the repo exists via public GitHub API
      const res = await fetch(`https://api.github.com/repos/${info.owner}/${info.repo}`);
      if (res.ok) {
        setStatus("connected");
        setRepoConnected(true);
      } else if (res.status === 404) {
        // Could be private — still allow it (cloud builder has the token)
        setStatus("connected");
        setRepoConnected(true);
      } else {
        setStatus("error");
        setErrorMsg("Could not verify repository. It may be rate-limited.");
      }
    } catch {
      // Network error — still allow (cloud builder will handle it)
      setStatus("connected");
      setRepoConnected(true);
    }
  };

  const handleDisconnect = () => {
    setStatus("idle");
    setRepoConnected(false);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <GitBranch size={16} className="text-primary" />
          Repository URL
        </label>
        <Input
          placeholder="https://github.com/username/repo"
          value={repoUrl}
          onChange={(e) => { setRepoUrl(e.target.value); if (status !== "idle") { setStatus("idle"); setRepoConnected(false); } }}
          className="bg-background border-border"
          disabled={status === "connected"}
        />
        {repoUrl && !isValidRepo(repoUrl) && (
          <p className="text-xs text-destructive">Enter a valid GitHub, GitLab, or Bitbucket URL</p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Branch</label>
        <Input
          placeholder="main"
          value={repoBranch}
          onChange={(e) => setRepoBranch(e.target.value)}
          className="bg-background border-border"
          disabled={status === "connected"}
        />
      </div>

      {status === "error" && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <AlertCircle size={16} className="text-destructive" />
          <span className="text-sm text-destructive">{errorMsg}</span>
        </div>
      )}

      {status === "connected" ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-[hsl(var(--success))]/10 border border-[hsl(var(--success))]/30">
            <CheckCircle2 size={16} className="text-[hsl(var(--success))]" />
            <span className="text-sm font-medium text-[hsl(var(--success))]">Repository connected</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleDisconnect} className="text-xs text-muted-foreground">
            Disconnect
          </Button>
        </div>
      ) : (
        <Button
          onClick={handleConnect}
          disabled={!isValidRepo(repoUrl) || status === "connecting"}
          className="w-full gap-2"
        >
          {status === "connecting" ? (
            <><Loader2 size={16} className="animate-spin" /> Connecting...</>
          ) : (
            <><ArrowRight size={16} /> Connect Repository</>
          )}
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        The cloud builder will clone your repository, install dependencies, build, and generate an APK using Capacitor.
      </p>
    </div>
  );
};

export default RepoConnect;

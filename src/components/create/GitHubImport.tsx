import { useState, useEffect, useCallback } from "react";
import { Github, Loader2, AlertTriangle, Search, GitBranch, ArrowRight, LogOut, User, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProjectStore } from "@/stores/projectStore";
import { analyzeUploadWithAI } from "@/lib/tools/aiProjectAnalyzer";

interface GitHubImportProps {
  onImported: () => void;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  default_branch: string;
  language: string | null;
  updated_at: string;
}

const SUPABASE_URL = "https://noiioxcxpvfzsqdayjfq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const OAUTH_FN = `${SUPABASE_URL}/functions/v1/github-oauth`;
const CLONE_FN = `${SUPABASE_URL}/functions/v1/github-clone`;

const GitHubImport = ({ onImported }: GitHubImportProps) => {
  const { githubAccessToken, githubUser, setGithubAccessToken, setGithubUser, loadFromZip } = useProjectStore();

  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Repo picker
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branch, setBranch] = useState("main");

  // URL fallback
  const [repoUrl, setRepoUrl] = useState("");
  const [showUrlFallback, setShowUrlFallback] = useState(false);

  // Listen for OAuth callback
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === "github-oauth-callback" && event.data.code) {
        await exchangeCode(event.data.code);
      }
    };
    window.addEventListener("message", handleMessage);

    // Also check URL params (redirect back)
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code && !githubAccessToken) {
      exchangeCode(code);
      window.history.replaceState({}, "", window.location.pathname);
    }

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Fetch repos when token is available
  useEffect(() => {
    if (githubAccessToken && repos.length === 0) {
      fetchRepos();
    }
  }, [githubAccessToken]);

  const handleConnectGitHub = async () => {
    setError(null);
    setLoading(true);
    try {
      const redirectUri = window.location.origin + "/auth/github/callback";
      const returnTo = window.location.pathname + window.location.search;
      const res = await fetch(`${OAUTH_FN}?action=authorize&redirect_uri=${encodeURIComponent(redirectUri)}&return_to=${encodeURIComponent(returnTo)}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }
      // Open GitHub auth in same window (redirect)
      window.location.href = data.authUrl;
    } catch {
      setError("Failed to start GitHub authorization");
      setLoading(false);
    }
  };

  const exchangeCode = async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${OAUTH_FN}?action=exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }
      setGithubAccessToken(data.access_token);
      setGithubUser(data.user);
    } catch {
      setError("Failed to complete GitHub authorization");
    } finally {
      setLoading(false);
    }
  };

  const fetchRepos = async () => {
    if (!githubAccessToken) return;
    setReposLoading(true);
    try {
      const res = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated&type=all", {
        headers: { Authorization: `token ${githubAccessToken}`, Accept: "application/vnd.github.v3+json" },
      });
      if (res.status === 401) {
        handleDisconnect();
        setError("GitHub session expired. Please reconnect.");
        return;
      }
      if (!res.ok) { setError(`GitHub API error: ${res.status}`); return; }
      const data = await res.json();
      setRepos(data);
    } catch {
      setError("Failed to fetch repositories");
    } finally {
      setReposLoading(false);
    }
  };

  const fetchBranches = async (repo: GitHubRepo) => {
    setBranchesLoading(true);
    setBranches([repo.default_branch]);
    try {
      const res = await fetch(`https://api.github.com/repos/${repo.full_name}/branches?per_page=30`, {
        headers: { Authorization: `token ${githubAccessToken}`, Accept: "application/vnd.github.v3+json" },
      });
      if (res.ok) {
        const data = await res.json();
        setBranches(data.map((b: any) => b.name));
      }
    } catch {} finally {
      setBranchesLoading(false);
    }
  };

  const handleSelectRepo = (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setBranch(repo.default_branch);
    fetchBranches(repo);
  };

  const handleImportSelected = async () => {
    if (!selectedRepo) return;
    await handleImportRepo(selectedRepo.full_name, branch);
  };

  const handleImportRepo = async (fullName: string, targetBranch: string) => {
    setLoading(true);
    setError(null);
    try {
      // Use server-side edge proxy — direct browser fetch of the GitHub zipball
      // fails because GitHub 302-redirects to codeload.github.com which has no
      // CORS headers. The github-clone function follows the redirect for us.
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        apikey: SUPABASE_PUBLISHABLE_KEY,
      };
      if (githubAccessToken) headers["x-github-token"] = githubAccessToken;

      const resp = await fetch(CLONE_FN, {
        method: "POST",
        headers,
        body: JSON.stringify({ repo: fullName, ref: targetBranch }),
      });
      if (!resp.ok) {
        let detail = "";
        try { detail = (await resp.json())?.error || ""; } catch { /* ignore */ }
        if (resp.status === 401 || resp.status === 403) {
          setError("GitHub authentication failed. Please reconnect.");
        } else if (resp.status === 404) {
          setError("Repository not found.");
        } else {
          setError(`Clone failed (${resp.status})${detail ? `: ${detail}` : ""}`);
        }
        setLoading(false);
        return;
      }

      const blob = await resp.blob();
      if (!blob.size) { setError("Clone returned empty archive."); setLoading(false); return; }
      const [, repo] = fullName.split("/");
      const file = new File([blob], `${repo}.zip`, { type: "application/zip" });

      useProjectStore.getState().setRepoUrl(`https://github.com/${fullName}`);
      useProjectStore.getState().setRepoBranch(targetBranch);
      useProjectStore.getState().setRepoConnected(true);

      // Load into the project tree
      await loadFromZip(file);

      // Run AI scan so the next step has framework/build-command pre-filled
      setScanning(true);
      try {
        const meta = await analyzeUploadWithAI(file);
        useProjectStore.getState().setScanResult?.({
          framework: meta.framework,
          assurance: meta.assurance,
          assuranceMessage: meta.assuranceMessage,
          issues: meta.issues ?? [],
          buildCommand: meta.buildCommand,
          outputDir: meta.outputDir,
          entryPoint: meta.entryPoint,
          suggestedEngine: meta.suggestedEngine,
          suggestedPlugins: meta.suggestedPlugins ?? [],
        } as any);
      } catch (scanErr: any) {
        console.error("[GitHubImport] scan failed", scanErr);
        // Non-blocking: still let the user proceed
        setError(`Imported, but scan failed: ${scanErr?.message || "AI analyzer unavailable"}`);
      } finally {
        setScanning(false);
      }

      onImported();
    } catch (e: any) {
      console.error("[GitHubImport] import failed", e);
      setError(e?.message || "Failed to import repository.");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setGithubAccessToken("");
    setGithubUser(null);
    setRepos([]);
    setSelectedRepo(null);
    localStorage.removeItem("github_access_token");
    localStorage.removeItem("github_user");
  };

  const parseRepoUrl = (url: string): { owner: string; repo: string } | null => {
    const match = url.match(/(?:github\.com\/)?([^/\s]+)\/([^/\s#?.]+)/);
    if (!match) return null;
    return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
  };

  const handleUrlImport = async () => {
    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) { setError("Invalid GitHub URL."); return; }
    await handleImportRepo(`${parsed.owner}/${parsed.repo}`, branch);
  };

  const filteredRepos = repos.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.description || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 1) return "today";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  // ── Not connected ──
  if (!githubAccessToken) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Github size={16} /> Import from GitHub
        </div>

        <Button onClick={handleConnectGitHub} disabled={loading} className="w-full gap-2" variant="outline">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Github size={16} />}
          {loading ? "Connecting..." : "Connect GitHub Account"}
        </Button>

        <p className="text-[10px] text-muted-foreground">
          Click to authorize with GitHub. We'll request access to your repositories so you can pick one to import.
        </p>

        {/* URL fallback */}
        <button onClick={() => setShowUrlFallback(!showUrlFallback)}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
          Or paste a public repo URL
        </button>

        {showUrlFallback && (
          <div className="space-y-2">
            <Input placeholder="https://github.com/owner/repo" value={repoUrl}
              onChange={(e) => { setRepoUrl(e.target.value); setError(null); }}
              className="bg-secondary border-border font-mono text-sm" />
            <div className="flex gap-2">
              <Input placeholder="Branch" value={branch}
                onChange={(e) => setBranch(e.target.value || "main")}
                className="bg-secondary border-border text-sm flex-1" />
              <Button onClick={handleUrlImport} disabled={loading || !repoUrl.trim()} size="sm">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                Import
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertTriangle size={12} /> {error}
          </div>
        )}
      </div>
    );
  }

  // ── Connected: show repo picker ──
  return (
    <div className="space-y-3">
      {/* Connected header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Github size={16} /> Import from GitHub
        </div>
        <div className="flex items-center gap-2">
          {githubUser && (
            <div className="flex items-center gap-1.5">
              {githubUser.avatar_url ? (
                <img src={githubUser.avatar_url} alt="" className="w-5 h-5 rounded-full" />
              ) : (
                <User size={14} className="text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground">{githubUser.login}</span>
            </div>
          )}
          <button onClick={handleDisconnect} className="text-[10px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1">
            <LogOut size={10} /> Disconnect
          </button>
        </div>
      </div>

      {/* Search */}
      {!selectedRepo && (
        <>
          <Input placeholder="Search your repositories..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-secondary border-border text-sm" />

          {reposLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-primary" />
            </div>
          )}

          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {filteredRepos.map((repo) => (
              <button key={repo.id} onClick={() => handleSelectRepo(repo)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors group">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">{repo.name}</span>
                  {repo.private && <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">private</span>}
                  {repo.language && <span className="text-[10px] text-muted-foreground ml-auto">{repo.language}</span>}
                </div>
                {repo.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{repo.description}</p>}
                <span className="text-[10px] text-muted-foreground/50">Updated {formatDate(repo.updated_at)}</span>
              </button>
            ))}
            {!reposLoading && filteredRepos.length === 0 && repos.length > 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No repos match "{searchQuery}"</p>
            )}
          </div>
        </>
      )}

      {/* Selected repo + branch picker */}
      {selectedRepo && (
        <div className="space-y-3">
          <div className="rounded-lg bg-muted/30 border border-border p-3">
            <div className="flex items-center gap-2 mb-1">
              <Github size={14} className="text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{selectedRepo.full_name}</span>
            </div>
            {selectedRepo.description && <p className="text-xs text-muted-foreground">{selectedRepo.description}</p>}
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Branch</span>
            <div className="flex gap-1.5 mt-1 flex-wrap">
              {branchesLoading && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
              {branches.map((b) => (
                <button key={b} onClick={() => setBranch(b)}
                  className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-all ${branch === b ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted/40 text-muted-foreground border border-transparent hover:border-border"}`}>
                  <GitBranch size={10} /> {b}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSelectedRepo(null)} className="flex-1" size="sm">Back</Button>
            <Button onClick={handleImportSelected} disabled={loading} className="flex-1 gap-1.5" size="sm">
              {loading ? <Loader2 size={14} className="animate-spin" /> : scanning ? <ScanSearch size={14} /> : <ArrowRight size={14} />}
              {scanning ? "Scanning…" : loading ? "Importing…" : "Import"}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive mt-2">
          <AlertTriangle size={12} /> {error}
        </div>
      )}
    </div>
  );
};

export default GitHubImport;

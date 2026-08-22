import GitHubImport from "@/components/create/GitHubImport";
import { useProjectStore } from "@/stores/projectStore";
import { Github, CheckCircle2, ExternalLink, GitBranch } from "lucide-react";

const CodeGitHubPanel = () => {
  const { repoConnected, repoUrl, repoBranch, githubUser } = useProjectStore();

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-foreground">GitHub Integration</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Connect your GitHub account and import repositories.</p>
      </div>

      {repoConnected && (
        <div className="rounded-[4px] border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <CheckCircle2 size={16} className="text-primary" />
            Connected Repository
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Github size={14} className="text-muted-foreground" />
              <span className="text-foreground font-medium">{repoUrl.replace("https://github.com/", "")}</span>
              <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                <ExternalLink size={12} />
              </a>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <GitBranch size={14} />
              <span>{repoBranch}</span>
            </div>
            {githubUser && (
              <div className="flex items-center gap-2 text-muted-foreground">
                {githubUser.avatar_url && <img src={githubUser.avatar_url} className="w-4 h-4 rounded-full" alt="" />}
                <span>{githubUser.login}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-[4px] border border-border bg-card p-4">
        <GitHubImport onImported={() => {}} />
      </div>

      <div className="rounded-[4px] border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-foreground mb-2">OAuth Setup</h3>
        <p className="text-xs text-muted-foreground">
          If you encounter a "redirect URI mismatch" error, ensure your GitHub OAuth App's callback URL is set to:{" "}
          <code className="px-1 py-0.5 bg-muted rounded text-[11px] font-mono">{window.location.origin}/auth/github/callback</code>
        </p>
      </div>
    </div>
  );
};

export default CodeGitHubPanel;

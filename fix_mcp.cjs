const fs = require('fs');
const file = 'src/components/dashboard/DeveloperPanel.tsx';
let content = fs.readFileSync(file, 'utf8');

const mcpReplacement = `const McpServerPanel = () => {
  const [tokens, setTokens] = useState<McpToken[]>(SEED_MCP);
  const [clients, setClients] = useState([
    { id: "c1", name: "Cursor IDE", status: "connected", lastActive: "Just now", permissions: ["build:read", "build:write"] },
    { id: "c2", name: "Claude Desktop", status: "offline", lastActive: "2 days ago", permissions: ["build:read"] },
    { id: "c3", name: "Lovable Web", status: "connected", lastActive: "1 hour ago", permissions: ["build:read", "build:write", "project:write"] }
  ]);
  
  const endpoint = \`\${import.meta.env.VITE_SUPABASE_URL || "https://api.nativebridge.dev"}/functions/v1/mcp\`;
  const tools = [
    { name: "start_build", description: "Kick off a fresh APK/AAB build for this project" },
    { name: "get_build_status", description: "Return phase, pipeline run, and step list for a build" },
    { name: "list_projects", description: "List projects available to the calling token" },
    { name: "patch_appearance", description: "Update icons, splash, and theme then trigger rebuild" },
  ];

  const issue = () => {
    const t: McpToken = { id: crypto.randomUUID(), label: "New App Token", token: \`mcp_\${Math.random().toString(36).slice(2, 14)}\`, createdAt: new Date().toISOString().slice(0, 10), active: true };
    setTokens([t, ...tokens]); 
    toast.success("Token issued for new client");
  };
  
  const revokeClient = (id: string) => {
    setClients(clients.filter(c => c.id !== id));
    toast.success("Client access revoked successfully");
  };

  return (
    <div className="max-w-4xl pb-16">
      <PageHeader icon={Server} title="MCP Server" description="Expose build actions over the Model Context Protocol. Plug into Cursor, Claude Desktop, Lovable, or any MCP client." />
      
      <div className="rounded-lg border border-border bg-card/40 p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Link2 size={13} className="text-muted-foreground" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Endpoint URL</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs bg-background/60 rounded-md px-3 py-2 border border-border">
          <code className="flex-1 truncate">{endpoint}</code>
          <button onClick={() => { navigator.clipboard.writeText(endpoint); toast.success("Copied to clipboard"); }} className="text-muted-foreground hover:text-foreground"><Copy size={12} /></button>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-border bg-card/40 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Installed Applications (MCP Clients)</div>
          <Button size="sm" onClick={issue}><Plus size={12} className="mr-1" />Connect Client</Button>
        </div>
        
        {clients.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">No applications currently connected via MCP.</div>
        ) : (
          <div className="space-y-3">
            {clients.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-md border border-border bg-background/50">
                <div className="flex items-center gap-3">
                  <div className={\`w-2 h-2 rounded-full \${c.status === 'connected' ? 'bg-[hsl(var(--success))]' : 'bg-muted-foreground'}\`} />
                  <div>
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Last active: {c.lastActive}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex items-center gap-1.5">
                    {c.permissions.map(p => (
                      <Badge key={p} variant="secondary" className="text-[9px] uppercase tracking-wider font-mono px-1">{p}</Badge>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => revokeClient(c.id)} className="text-destructive hover:text-destructive h-8 px-2">
                    Revoke
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Exposed Tools & Prompts</div>
          <div className="space-y-2">
            {tools.map(t => (
              <div key={t.name} className="flex items-start gap-2">
                <CheckCircle2 size={12} className="text-[hsl(var(--success))] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <code className="text-xs font-mono text-foreground">{t.name}</code>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{t.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Raw API Tokens</div>
          </div>
          <div className="space-y-2">
            {tokens.map(t => (
              <div key={t.id} className="flex items-center gap-2 rounded-md border border-border bg-background/50 px-3 py-2">
                <Circle size={8} className={t.active ? "fill-[hsl(var(--success))] text-[hsl(var(--success))]" : "fill-muted text-muted"} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{t.label}</div>
                  <code className="text-[10px] font-mono text-muted-foreground">{t.token.slice(0, 8)}••••</code>
                </div>
                <button onClick={() => { setTokens(tokens.filter(x => x.id !== t.id)); toast.success("Raw token revoked"); }} className="text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
              </div>
            ))}
            {tokens.length === 0 && <div className="text-xs text-muted-foreground">No raw tokens issued.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};`;

const startStr = "const McpServerPanel = () => {";
const endStr = "/* ─────────────────────────── 4. WEBHOOKS ─────────────────────────── */";

const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
  content = content.substring(0, startIdx) + mcpReplacement + "\n\n" + content.substring(endIdx);
  fs.writeFileSync(file, content);
  console.log("MCP panel updated successfully");
} else {
  console.log("Failed to find start or end index.");
}

import { useState } from "react";
import {
  KeyRound, Lock, Server, Webhook, Copy, Trash2, Plus, Eye, EyeOff,
  CheckCircle2, XCircle, Circle, Link2, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface DeveloperPanelProps { activeItem: string }

/* ─────────────────────────── shared header ─────────────────────────── */
const PageHeader = ({ icon: Icon, title, description, action }: { icon: any; title: string; description: string; action?: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-6 mb-6">
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon size={18} className="text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-xl">{description}</p>
      </div>
    </div>
    {action}
  </div>
);

const Empty = ({ label }: { label: string }) => (
  <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
    {label}
  </div>
);

/* ─────────────────────────── 1. API KEYS ─────────────────────────── */
interface ApiKey { id: string; name: string; prefix: string; secret: string; createdAt: string; lastUsed: string | null; scopes: string[] }

const SEED_KEYS: ApiKey[] = [
  { id: "k1", name: "Production CLI", prefix: "nb_live_8a3f", secret: "nb_live_8a3f9c2e7d1b4f6a5e8c0d2b3f4a7e9c", createdAt: "2026-04-12", lastUsed: "2 hours ago", scopes: ["builds:read", "builds:write"] },
  { id: "k2", name: "Build Pipeline CI", prefix: "nb_live_2b7e", secret: "nb_live_2b7e4d8a1c6f3b9e0d5a8c2f7b4e1d6a", createdAt: "2026-03-28", lastUsed: "12 minutes ago", scopes: ["builds:write"] },
  { id: "k3", name: "Local dev", prefix: "nb_test_9f1d", secret: "nb_test_9f1d6b3a8e4c2f7d0b5a9c8e1f4d6b3a", createdAt: "2026-02-09", lastUsed: null, scopes: ["builds:read"] },
];

const ApiKeysPanel = () => {
  const [keys, setKeys] = useState<ApiKey[]>(SEED_KEYS);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const create = () => {
    if (!name.trim()) return;
    const secret = `nb_live_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 26)}`;
    const k: ApiKey = { id: crypto.randomUUID(), name, prefix: secret.slice(0, 12), secret, createdAt: new Date().toISOString().slice(0, 10), lastUsed: null, scopes: ["builds:read", "builds:write"] };
    setKeys([k, ...keys]);
    setName(""); setOpen(false);
    toast.success("API key created — copy it now, you won't see it again.");
  };

  return (
    <div className="max-w-4xl">
      <PageHeader
        icon={KeyRound}
        title="API Keys"
        description="Trigger builds and query project state from scripts, curl, or CI. Treat keys like passwords."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus size={14} className="mr-1" />Create API key</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create API key</DialogTitle><DialogDescription>Give the key a memorable name. You'll see the secret once.</DialogDescription></DialogHeader>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Production CLI" />
              </div>
              <DialogFooter><Button onClick={create}>Generate key</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      {keys.length === 0 ? <Empty label="No API keys yet." /> : (
        <div className="rounded-lg border border-border overflow-hidden bg-card/40">
          {keys.map((k, i) => (
            <div key={k.id} className={`p-4 flex items-center gap-4 ${i > 0 ? "border-t border-border" : ""}`}>
              <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center"><KeyRound size={15} className="text-muted-foreground" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{k.name}</span>
                  {k.scopes.map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                </div>
                <div className="flex items-center gap-2 mt-1 font-mono text-xs text-muted-foreground">
                  <span>{revealed[k.id] ? k.secret : `${k.prefix}${"•".repeat(28)}`}</span>
                  <button onClick={() => setRevealed({ ...revealed, [k.id]: !revealed[k.id] })} className="hover:text-foreground">
                    {revealed[k.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                  <button onClick={() => { navigator.clipboard.writeText(k.secret); toast.success("Copied"); }} className="hover:text-foreground"><Copy size={12} /></button>
                </div>
                <div className="text-[11px] text-muted-foreground/70 mt-1">Created {k.createdAt} · Last used {k.lastUsed ?? "never"}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setKeys(keys.filter(x => x.id !== k.id)); toast.success("Key revoked"); }}>
                <Trash2 size={14} className="text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────── 2. OAUTH APPS ─────────────────────────── */
interface OAuthApp { id: string; name: string; clientId: string; clientSecret: string; redirectUri: string; createdAt: string; users: number }

const SEED_OAUTH: OAuthApp[] = [
  { id: "o1", name: "Dashboard Mobile", clientId: "nb_oauth_3f7d2a", clientSecret: "secret_8b4e9c1f2d5a7e6b3c9f1d8e4a2c6b5f", redirectUri: "https://mobile.example.com/auth/callback", createdAt: "2026-04-02", users: 1247 },
  { id: "o2", name: "Slack Integration", clientId: "nb_oauth_9c1b4e", clientSecret: "secret_2a7f9e4b1c8d3a5f6e0b2c4d7a9f1e3b", redirectUri: "https://slack.com/oauth/callback", createdAt: "2026-01-18", users: 89 },
];

const OAuthAppsPanel = () => {
  const [apps, setApps] = useState<OAuthApp[]>(SEED_OAUTH);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", redirectUri: "" });

  const create = () => {
    if (!form.name.trim()) return;
    const a: OAuthApp = {
      id: crypto.randomUUID(), name: form.name, redirectUri: form.redirectUri || "https://example.com/callback",
      clientId: `nb_oauth_${Math.random().toString(36).slice(2, 8)}`,
      clientSecret: `secret_${Math.random().toString(36).slice(2, 34)}`,
      createdAt: new Date().toISOString().slice(0, 10), users: 0,
    };
    setApps([a, ...apps]); setForm({ name: "", redirectUri: "" }); setOpen(false);
    toast.success("OAuth app registered");
  };

  return (
    <div className="max-w-4xl">
      <PageHeader
        icon={Lock} title="OAuth Apps"
        description="Register apps that authenticate users against this project. Sign-in with NativeBridge."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus size={14} className="mr-1" />Register app</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Register OAuth app</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>App name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My Mobile App" /></div>
                <div><Label>Redirect URI</Label><Input value={form.redirectUri} onChange={(e) => setForm({ ...form, redirectUri: e.target.value })} placeholder="https://app.example.com/callback" /></div>
              </div>
              <DialogFooter><Button onClick={create}>Register</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      {apps.length === 0 ? <Empty label="No OAuth apps registered." /> : (
        <div className="grid gap-3">
          {apps.map(a => (
            <div key={a.id} className="rounded-lg border border-border bg-card/40 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center"><Lock size={15} className="text-muted-foreground" /></div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{a.name}</div>
                    <div className="text-[11px] text-muted-foreground/70 mt-0.5">{a.users.toLocaleString()} authorized users · Created {a.createdAt}</div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { setApps(apps.filter(x => x.id !== a.id)); toast.success("App deleted"); }}>
                  <Trash2 size={14} className="text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-border bg-background/50 px-3 py-2">
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Client ID</div>
                  <div className="font-mono text-foreground/80 mt-0.5 truncate">{a.clientId}</div>
                </div>
                <div className="rounded-md border border-border bg-background/50 px-3 py-2">
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Redirect URI</div>
                  <div className="font-mono text-foreground/80 mt-0.5 truncate">{a.redirectUri}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────── 3. MCP SERVER ─────────────────────────── */
interface McpToken { id: string; label: string; token: string; createdAt: string; active: boolean }
const SEED_MCP: McpToken[] = [
  { id: "m1", label: "Cursor desktop", token: "mcp_a8c4e2f7d1b9", createdAt: "2026-04-22", active: true },
  { id: "m2", label: "Claude Desktop", token: "mcp_3b9f2e7d4a1c", createdAt: "2026-03-11", active: true },
];

const McpServerPanel = () => {
  const [tokens, setTokens] = useState<McpToken[]>(SEED_MCP);
  const [clients, setClients] = useState([
    { id: "c1", name: "Cursor IDE", status: "connected", lastActive: "Just now", permissions: ["build:read", "build:write"] },
    { id: "c2", name: "Claude Desktop", status: "offline", lastActive: "2 days ago", permissions: ["build:read"] },
    { id: "c3", name: "Lovable Web", status: "connected", lastActive: "1 hour ago", permissions: ["build:read", "build:write", "project:write"] }
  ]);
  
  const endpoint = `${import.meta.env.VITE_SUPABASE_URL || "https://api.nativebridge.dev"}/functions/v1/mcp`;
  const tools = [
    { name: "start_build", description: "Kick off a fresh APK/AAB build for this project" },
    { name: "get_build_status", description: "Return phase, pipeline run, and step list for a build" },
    { name: "list_projects", description: "List projects available to the calling token" },
    { name: "patch_appearance", description: "Update icons, splash, and theme then trigger rebuild" },
  ];

  const issue = () => {
    const t: McpToken = { id: crypto.randomUUID(), label: "New App Token", token: `mcp_${Math.random().toString(36).slice(2, 14)}`, createdAt: new Date().toISOString().slice(0, 10), active: true };
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
                  <div className={`w-2 h-2 rounded-full ${c.status === 'connected' ? 'bg-[hsl(var(--success))]' : 'bg-muted-foreground'}`} />
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
};

/* ─────────────────────────── 4. WEBHOOKS ─────────────────────────── */
interface Webhook { id: string; url: string; events: string[]; secret: string; enabled: boolean; lastDelivery: { ok: boolean; at: string } | null }
const ALL_EVENTS = ["build.started", "build.succeeded", "build.failed", "appearance.updated", "plugin.changed"];
const SEED_WH: Webhook[] = [
  { id: "w1", url: "https://hooks.slack.com/services/T0/B0/abc123", events: ["build.succeeded", "build.failed"], secret: "whsec_a8f2", enabled: true, lastDelivery: { ok: true, at: "5 min ago" } },
  { id: "w2", url: "https://api.example.com/nativebridge", events: ["build.started", "build.succeeded", "build.failed", "appearance.updated"], secret: "whsec_3b9f", enabled: true, lastDelivery: { ok: false, at: "1 hour ago" } },
  { id: "w3", url: "https://discord.com/api/webhooks/123/xyz", events: ["build.failed"], secret: "whsec_2e7d", enabled: false, lastDelivery: null },
];

const WebhooksPanel = () => {
  const [hooks, setHooks] = useState<Webhook[]>(SEED_WH);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ url: string; events: string[] }>({ url: "", events: ["build.succeeded", "build.failed"] });

  const create = () => {
    if (!form.url.trim()) return;
    const w: Webhook = {
      id: crypto.randomUUID(), url: form.url, events: form.events,
      secret: `whsec_${Math.random().toString(36).slice(2, 8)}`, enabled: true, lastDelivery: null,
    };
    setHooks([w, ...hooks]); setForm({ url: "", events: ["build.succeeded", "build.failed"] }); setOpen(false);
    toast.success("Webhook added");
  };
  const toggleEvent = (e: string) => setForm(f => ({ ...f, events: f.events.includes(e) ? f.events.filter(x => x !== e) : [...f.events, e] }));

  return (
    <div className="max-w-4xl">
      <PageHeader
        icon={Webhook} title="Webhooks"
        description="Receive HTTP POSTs when builds start, succeed, or fail. Signed with HMAC-SHA256 using the secret."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus size={14} className="mr-1" />Add webhook</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add webhook</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Payload URL</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/webhook" /></div>
                <div>
                  <Label>Events</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {ALL_EVENTS.map(ev => (
                      <button key={ev} type="button" onClick={() => toggleEvent(ev)}
                        className={`text-left text-xs font-mono px-2 py-1.5 rounded border transition ${form.events.includes(ev) ? "bg-primary/10 border-primary text-foreground" : "bg-background/50 border-border text-muted-foreground"}`}>
                        {ev}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter><Button onClick={create}>Add</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      {hooks.length === 0 ? <Empty label="No webhooks configured." /> : (
        <div className="grid gap-3">
          {hooks.map(h => (
            <div key={h.id} className="rounded-lg border border-border bg-card/40 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center"><Webhook size={15} className="text-muted-foreground" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-sm text-foreground truncate">{h.url}</div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {h.events.map(e => <Badge key={e} variant="secondary" className="text-[10px] font-mono">{e}</Badge>)}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[11px]">
                      {h.lastDelivery ? (
                        <span className="inline-flex items-center gap-1">
                          {h.lastDelivery.ok
                            ? <CheckCircle2 size={11} className="text-[hsl(var(--success))]" />
                            : <XCircle size={11} className="text-destructive" />}
                          <span className="text-muted-foreground">Last delivery {h.lastDelivery.at}</span>
                        </span>
                      ) : <span className="text-muted-foreground/70">Never delivered</span>}
                      <span className="text-muted-foreground/50">·</span>
                      <code className="font-mono text-muted-foreground/70">{h.secret}••••</code>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={h.enabled} onCheckedChange={(v) => setHooks(hooks.map(x => x.id === h.id ? { ...x, enabled: v } : x))} />
                  <Button variant="ghost" size="icon" onClick={() => toast.success("Test event sent")}><Send size={14} className="text-muted-foreground" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { setHooks(hooks.filter(x => x.id !== h.id)); toast.success("Webhook deleted"); }}>
                    <Trash2 size={14} className="text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────── Router ─────────────────────────── */
const DeveloperPanel = ({ activeItem }: DeveloperPanelProps) => {
  return (
    <div className="p-6 h-full overflow-y-auto">
      {activeItem === "oauth-apps" ? <OAuthAppsPanel />
        : activeItem === "mcp-server" ? <McpServerPanel />
        : activeItem === "webhooks" ? <WebhooksPanel />
        : <ApiKeysPanel />}
    </div>
  );
};

export default DeveloperPanel;

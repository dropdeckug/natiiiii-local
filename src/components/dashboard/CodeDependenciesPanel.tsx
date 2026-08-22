import { useMemo } from "react";
import { useProjectStore, flattenProjectFiles } from "@/stores/projectStore";
import { Package, AlertTriangle, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { Input } from "@/components/ui/input";

interface Dep {
  name: string;
  version: string;
  type: "dependency" | "devDependency";
}

const CodeDependenciesPanel = () => {
  const { files } = useProjectStore();
  const [search, setSearch] = useState("");

  const deps = useMemo<Dep[]>(() => {
    const allFiles = flattenProjectFiles(files);
    const pkgFile = allFiles.find((f) => f.name === "package.json" && !f.path.includes("node_modules"));
    if (!pkgFile?.content) return [];
    try {
      const pkg = JSON.parse(pkgFile.content);
      const result: Dep[] = [];
      for (const [name, version] of Object.entries(pkg.dependencies || {})) {
        result.push({ name, version: version as string, type: "dependency" });
      }
      for (const [name, version] of Object.entries(pkg.devDependencies || {})) {
        result.push({ name, version: version as string, type: "devDependency" });
      }
      return result;
    } catch {
      return [];
    }
  }, [files]);

  const filtered = deps.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));
  const prodDeps = filtered.filter((d) => d.type === "dependency");
  const devDeps = filtered.filter((d) => d.type === "devDependency");

  if (deps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <Package size={32} className="text-muted-foreground/30 mb-3" />
        <h2 className="text-sm font-medium text-foreground mb-1">No Dependencies Found</h2>
        <p className="text-xs text-muted-foreground max-w-sm">Upload a project with a package.json to view dependencies.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Dependencies</h2>
          <p className="text-sm text-muted-foreground">{deps.length} packages ({prodDeps.length} prod, {devDeps.length} dev)</p>
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search dependencies..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
      </div>

      <ScrollArea className="max-h-[calc(100vh-220px)]">
        {prodDeps.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 px-1">Dependencies ({prodDeps.length})</h3>
            <div className="rounded-[4px] border border-border divide-y divide-border">
              {prodDeps.map((dep) => (
                <div key={dep.name} className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Package size={13} className="text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground font-mono">{dep.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{dep.version}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {devDeps.length > 0 && (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 px-1">Dev Dependencies ({devDeps.length})</h3>
            <div className="rounded-[4px] border border-border divide-y divide-border">
              {devDeps.map((dep) => (
                <div key={dep.name} className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Package size={13} className="text-muted-foreground/50 shrink-0" />
                    <span className="text-sm text-foreground/70 font-mono">{dep.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{dep.version}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default CodeDependenciesPanel;

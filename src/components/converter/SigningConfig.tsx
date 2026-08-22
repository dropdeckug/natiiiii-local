import { useState } from "react";
import { KeyRound, Upload, ShieldCheck, Plus, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type SigningMode = "debug" | "release";

const SigningConfig = () => {
  const [mode, setMode] = useState<SigningMode>("debug");
  const [keystoreFile, setKeystoreFile] = useState<File | null>(null);
  const [keyAlias, setKeyAlias] = useState("");
  const [storePassword, setStorePassword] = useState("");
  const [keyPassword, setKeyPassword] = useState("");

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound size={14} className="text-primary" />
          <span className="text-xs font-medium text-foreground">App Signing</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Debug</span>
          <Switch
            checked={mode === "release"}
            onCheckedChange={(checked) => setMode(checked ? "release" : "debug")}
          />
          <span className="text-[10px] text-muted-foreground">Release</span>
        </div>
      </div>

      {mode === "debug" ? (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30">
          <ShieldCheck size={14} className="text-[hsl(var(--success))]" />
          <div>
            <p className="text-xs text-foreground">Debug keystore</p>
            <p className="text-[10px] text-muted-foreground">Auto-generated for testing — not for Play Store</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/20">
            <AlertTriangle size={13} className="text-[hsl(var(--warning))] shrink-0" />
            <p className="text-[10px] text-[hsl(var(--warning))]">
              Release signing required for Play Store publishing
            </p>
          </div>

          <label className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-border cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
            <input
              type="file"
              accept=".jks,.keystore"
              onChange={(e) => setKeystoreFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <Upload size={14} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {keystoreFile ? keystoreFile.name : "Upload .jks or .keystore file"}
            </span>
          </label>

          <Input
            placeholder="Key alias"
            value={keyAlias}
            onChange={(e) => setKeyAlias(e.target.value)}
            className="h-8 text-xs bg-background"
          />
          <Input
            type="password"
            placeholder="Store password"
            value={storePassword}
            onChange={(e) => setStorePassword(e.target.value)}
            className="h-8 text-xs bg-background"
          />
          <Input
            type="password"
            placeholder="Key password"
            value={keyPassword}
            onChange={(e) => setKeyPassword(e.target.value)}
            className="h-8 text-xs bg-background"
          />

          <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs h-8">
            <Plus size={12} /> Generate New Keystore
          </Button>
        </div>
      )}
    </div>
  );
};

export default SigningConfig;

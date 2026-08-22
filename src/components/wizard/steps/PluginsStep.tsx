import type { EngineType } from "@/components/converter/EngineSelector";
import PluginManager from "@/components/plugins/PluginManager";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PluginsStepProps {
  engine: EngineType;
  enabledCount: number;
}

const PluginsStep = ({ engine, enabledCount }: PluginsStepProps) => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-1">Plugins</h2>
        <p className="text-sm text-muted-foreground">
          Enable native capabilities — unsupported plugins are greyed out for your engine
        </p>
      </div>

      <ScrollArea className="max-h-[60vh] rounded-lg border border-border p-2">
        <PluginManager currentEngine={engine} />
      </ScrollArea>
    </div>
  );
};

export default PluginsStep;

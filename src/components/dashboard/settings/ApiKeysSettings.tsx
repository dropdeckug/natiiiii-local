import { useState } from "react";
import DeveloperPanel from "@/components/dashboard/DeveloperPanel";
import { SettingsHeader, Tabs } from "./primitives";

/**
 * Supabase-style API keys page: one header, tabbed sub-surfaces.
 * The individual surfaces are the existing developer panels.
 */
const ApiKeysSettings = ({ initialTab = "api-keys" }: { initialTab?: string }) => {
  const [tab, setTab] = useState(initialTab);

  return (
    <div className="max-w-4xl pb-16">
      <SettingsHeader
        title="API Keys"
        description="Keys, OAuth clients and automation endpoints used to reach this project programmatically."
      />
      <Tabs
        tabs={[
          { id: "api-keys", label: "Project API keys" },
          { id: "oauth-apps", label: "OAuth apps" },
          { id: "mcp-server", label: "MCP server" },
          { id: "webhooks", label: "Webhooks" },
        ]}
        active={tab}
        onChange={setTab}
      />
      <DeveloperPanel activeItem={tab} />
    </div>
  );
};

export default ApiKeysSettings;

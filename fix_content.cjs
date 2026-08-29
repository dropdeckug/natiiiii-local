const fs = require('fs');
const file = 'src/components/dashboard/DashboardContent.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add imports for the new panels
content = content.replace(
  'const InstallPanel = lazy(() => import("@/components/dashboard/InstallPanel"));',
  `const InstallPanel = lazy(() => import("@/components/dashboard/InstallPanel"));
const ConfigurationPanel = lazy(() => import("@/components/dashboard/ConfigurationPanel"));
const NetworkingPanel = lazy(() => import("@/components/dashboard/NetworkingPanel"));`
);

// Replace the Placeholder for Configuration
content = content.replace(
  'if (section === "config") {\n    return <Placeholder icon={Settings} title="Configuration" description="Configure your app settings, Capacitor config, and environment variables." />;\n  }',
  `if (section === "config") {\n    return <Suspense fallback={<Fallback />}><ConfigurationPanel /></Suspense>;\n  }`
);

// Replace the Placeholder for Networking
content = content.replace(
  'if (section === "networking") {\n    return <Placeholder icon={Globe} title="Networking" description="Set up deep links, custom domains, and Android App Links." />;\n  }',
  `if (section === "networking") {\n    return <Suspense fallback={<Fallback />}><NetworkingPanel /></Suspense>;\n  }`
);

fs.writeFileSync(file, content);

const fs = require('fs');
const file = 'src/components/converter/EngineSelector.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace('import electronIcon from "@/assets/icons/electron.png";', 'import electronIcon from "@/assets/icons/electron.png";\nimport tauriIcon from "@/assets/icons/tauri.svg";');

const tauriEngine = `  {
    id: "tauri",
    name: "Tauri",
    icon: tauriIcon,
    tagline: "Lightweight Rust desktop app",
    bestFor: "Small, fast cross-platform apps",
    pros: ["Extremely small binary", "Low memory footprint", "Rust security"],
    cons: ["Rust dependencies", "Different webviews per OS"],
  },`;

// insert before the end of the array
content = content.replace('];\n\ninterface EngineSelectorProps', tauriEngine + '\n];\n\ninterface EngineSelectorProps');

fs.writeFileSync(file, content);

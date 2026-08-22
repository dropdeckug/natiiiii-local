import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installLogBuffer } from "@/lib/runtime/logBuffer";
import { installNetworkBuffer } from "@/lib/runtime/networkBuffer";
import { installApiLogTap } from "@/lib/logs/logSink";

installLogBuffer();
installNetworkBuffer();
try {
  installApiLogTap();
} catch (error) {
  console.warn("[logs] API log tap initialization skipped", error);
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root application mount element");
createRoot(root).render(<App />);

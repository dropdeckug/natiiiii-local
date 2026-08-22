import { useState, useRef, useEffect, useCallback, useMemo, startTransition } from "react";
import {
  ArrowUp, Loader2, Plus, SlidersHorizontal, ChevronDown, X, Check, XCircle, Zap, MessageSquare,
  Activity, Bell, HelpCircle, Terminal, GraduationCap, Bot, MessageCircle, Gauge, Smartphone,
  ClipboardList,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import AiMark from "@/components/ai/AiMark";
import ModelIcon from "@/components/ai/ModelIcon";
import MaterialWavySpinner from "@/components/ai/MaterialWavySpinner";

import { toast } from "sonner";
import { useProjectStore, flattenProjectFiles } from "@/stores/projectStore";
import { useBuildStore } from "@/stores/buildStore";
import NativeBridgeLogo from "@/components/layout/NativeBridgeLogo";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ActionTrackerPanel, { type TrackerAction } from "@/components/dashboard/ActionTrackerPanel";
import InstallPanel from "@/components/dashboard/InstallPanel";
import { searchCapawesomeDocs, readCapawesomeDoc } from "@/lib/docs/capawesomeDocs";
import ChatMarkdown from "@/components/chat/ChatMarkdown";
import ChatTimeline, { type ChatTimelineStep } from "@/components/chat/ChatTimeline";
import ChatComposer, { type ComposerAttachment } from "@/components/chat/ChatComposer";
import MessageActions from "@/components/chat/MessageActions";
import ConsolePanel from "@/components/layout/ConsolePanel";
import { getConsoleLogs as getRuntimeConsoleLogs, getRuntimeErrors as getRuntimeErrorsBuf } from "@/lib/runtime/logBuffer";
import { getNetworkRequests as getNetworkRequestsBuf } from "@/lib/runtime/networkBuffer";

interface AssistantPanelProps {
  onClose: () => void;
}

type Msg = {
  role: "user" | "assistant";
  content: string;
  timeline?: ChatTimelineStep[];
  caption?: string | null;
};

interface ThinkingAction {
  id: string;
  text: string;
  done: boolean;
}

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

interface CodeSuggestion {
  filePath: string;
  description: string;
  addedLines?: string[];
  removedLines?: string[];
  accepted?: boolean;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/forge-ai-chat`;

/**
 * Every model available on the Lovable AI gateway. Selecting one sends
 * `model: <id>` to forge-ai-chat, which forwards it to the gateway's
 * OpenAI-compatible endpoint. Tool calling is supported on every entry.
 */
/** Cheapest capable default for chat and the build workflow. */
const DEFAULT_MODEL_ID = "google/gemini-2.5-flash";

const AI_MODELS = [
  { id: "google/gemini-3.6-flash",        label: "Gemini 3.6 Flash",         group: "Google" },
  { id: "google/gemini-3.5-flash",        label: "Gemini 3.5 Flash",         group: "Google" },
  { id: "google/gemini-3.1-pro-preview",  label: "Gemini 3.1 Pro (Preview)", group: "Google" },
  { id: "google/gemini-3.1-flash-lite",   label: "Gemini 3.1 Flash Lite",    group: "Google" },
  { id: "google/gemini-3-flash-preview",  label: "Gemini 3 Flash (Preview)", group: "Google" },
  { id: "google/gemini-2.5-pro",          label: "Gemini 2.5 Pro",           group: "Google" },
  { id: "google/gemini-2.5-flash",        label: "Gemini 2.5 Flash",         group: "Google" },
  { id: "google/gemini-2.5-flash-lite",   label: "Gemini 2.5 Flash Lite",    group: "Google" },
  { id: "openai/gpt-5.6-sol",             label: "GPT-5.6 Sol",              group: "OpenAI" },
  { id: "openai/gpt-5.6-terra",           label: "GPT-5.6 Terra",            group: "OpenAI" },
  { id: "openai/gpt-5.6-luna",            label: "GPT-5.6 Luna",             group: "OpenAI" },
  { id: "openai/gpt-5.5",                 label: "GPT-5.5",                  group: "OpenAI" },
  { id: "openai/gpt-5.4",                 label: "GPT-5.4",                  group: "OpenAI" },
  { id: "openai/gpt-5.4-mini",            label: "GPT-5.4 Mini",             group: "OpenAI" },
  { id: "openai/gpt-5.4-nano",            label: "GPT-5.4 Nano",             group: "OpenAI" },
  { id: "openai/gpt-5.2",                 label: "GPT-5.2",                  group: "OpenAI" },
  { id: "openai/gpt-5",                   label: "GPT-5",                    group: "OpenAI" },
  { id: "openai/gpt-5-mini",              label: "GPT-5 Mini",               group: "OpenAI" },
  { id: "openai/gpt-5-nano",              label: "GPT-5 Nano",               group: "OpenAI" },
];



type AgentMode = "chat" | "plan" | "agent";
type AgentSpeed = "fast" | "balanced" | "deep";
type AssistantTab = "actions" | "chat" | "install" | "notifications" | "help" | "console" | "learn";

const ASSISTANT_TABS: AssistantTab[] = ["actions", "chat", "install", "notifications", "help", "console", "learn"];
const isAssistantTab = (value: string | null): value is AssistantTab => !!value && ASSISTANT_TABS.includes(value as AssistantTab);

const SPEED_OPTIONS: { id: AgentSpeed; label: string; description: string }[] = [
  { id: "fast",     label: "Fast",     description: "Up to 2 tool/repair loops — quick edits" },
  { id: "balanced", label: "Balanced", description: "Up to 4 loops — default" },
  { id: "deep",     label: "Deep",     description: "Up to 8 loops — best for native/Gradle fixes" },
];

const MODE_OPTIONS: { id: AgentMode; label: string; description: string; icon: LucideIcon }[] = [
  { id: "chat",  label: "Chat",  description: "Single response — answers and explanations", icon: MessageCircle },
  { id: "plan",  label: "Plan",  description: "Read-only: investigates the code and proposes a plan, changes nothing", icon: ClipboardList },
  { id: "agent", label: "Agent", description: "Autonomous: edits files, moves code, installs packages and verifies", icon: Bot },
];

function useProjectContext() {
  const {
    selectedEngine, buildAppName, buildPackageName, repoUrl, scanResult,
    enabledPlugins, files,
  } = useProjectStore();

  return {
    engine: selectedEngine || undefined,
    appName: buildAppName || undefined,
    packageName: buildPackageName || undefined,
    repoUrl: repoUrl || undefined,
    enabledPlugins: Array.from(enabledPlugins),
    framework: scanResult?.framework || undefined,
    totalFiles: scanResult?.totalFiles || undefined,
    issues: scanResult?.issues?.slice(0, 15) || undefined,
    fileList: flattenFileNames(files).slice(0, 400),
    dependencies: scanResult?.dependencies || undefined,
    sourceFiles: getKeyFileContents(files),
    /** Full readable source the AI agent can search/read on the server. */
    fullSourceFiles: getFullSourceFiles(files),
  };
}

function flattenFileNames(files: any[]): string[] {
  const out: string[] = [];
  for (const f of files) {
    if (f.type === "file") out.push(f.path);
    if (f.children) out.push(...flattenFileNames(f.children));
  }
  return out;
}

function getKeyFileContents(files: any[]): Record<string, string> {
  const result: Record<string, string> = {};
  const keyFiles = ["package.json", "capacitor.config.ts", "capacitor.config.json", "index.html", "vite.config.ts", "tsconfig.json"];
  const flat = flattenAllFiles(files);
  for (const f of flat) {
    if (f.type === "file" && keyFiles.includes(f.name) && f.content && !f.isBinary) {
      result[f.path] = f.content.slice(0, 4000);
    }
  }
  return result;
}

/** All readable text source files, capped so the request body stays under ~1MB. */
function getFullSourceFiles(files: any[]): { path: string; content: string }[] {
  const flat = flattenAllFiles(files);
  const out: { path: string; content: string }[] = [];
  let totalBytes = 0;
  const BYTE_BUDGET = 800_000;
  const PER_FILE_CAP = 12_000;
  for (const f of flat) {
    if (f.type !== "file" || f.isBinary || !f.content) continue;
    if (f.path.includes("node_modules/") || f.path.endsWith(".lock") || f.path.endsWith(".lockb")) continue;
    const slice = f.content.slice(0, PER_FILE_CAP);
    if (totalBytes + slice.length > BYTE_BUDGET) break;
    out.push({ path: f.path, content: slice });
    totalBytes += slice.length;
  }
  return out;
}

function flattenAllFiles(files: any[]): any[] {
  const out: any[] = [];
  for (const f of files) {
    out.push(f);
    if (f.children) out.push(...flattenAllFiles(f.children));
  }
  return out;
}

/** Minimal prefix/suffix line diff — enough to preview what a tool changed. */
function lineDiff(before: string, after: string) {
  const a = before.split("\n");
  const b = after.split("\n");
  let s = 0;
  while (s < a.length && s < b.length && a[s] === b[s]) s++;
  let e = 0;
  while (e < a.length - s && e < b.length - s && a[a.length - 1 - e] === b[b.length - 1 - e]) e++;
  const removed = a.slice(s, a.length - e);
  const added = b.slice(s, b.length - e);
  return { added, removed };
}

function readFileContent(path: string): string | null {
  const all = flattenAllFiles(useProjectStore.getState().files);
  const f = all.find((x: any) => x.type === "file" && (x.path === path || x.path.endsWith("/" + path)));
  return f && !f.isBinary && typeof f.content === "string" ? f.content : null;
}

const AssistantPanel = ({ onClose }: AssistantPanelProps) => {
  const navigate = useNavigate();
  const { id: projectId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<AssistantTab>(() => {
    const panel = searchParams.get("panel");
    return isAssistantTab(panel) ? panel : "actions";
  });

  const selectTab = useCallback((tab: AssistantTab, replace = false) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set("panel", tab);
    setSearchParams(next, { replace });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const panel = searchParams.get("panel");
    if (isAssistantTab(panel) && panel !== activeTab) setActiveTab(panel);
  }, [searchParams, activeTab]);

  // Allow external code (e.g. ProjectDashboard on build success) to switch the active tab.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === "string" && isAssistantTab(detail)) selectTab(detail, true);
    };
    window.addEventListener("nb:assistant-tab", handler);
    return () => window.removeEventListener("nb:assistant-tab", handler);
  }, [selectTab]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // Caption is centralized in buildStore (single source of truth — prevents the "Agent" + "Thinking" duplicate spinner).
  const [liveTimeline, setLiveTimeline] = useState<ChatTimelineStep[]>([]);
  const DEFAULT_MODEL_ID = "google/gemini-2.5-flash";
  const [selectedModel, setSelectedModel] = useState(
    AI_MODELS.find((m) => m.id === DEFAULT_MODEL_ID) ?? AI_MODELS[0],
  );
  const [agentMode, setAgentMode] = useState<AgentMode>("chat");
  const [agentSpeed, setAgentSpeed] = useState<AgentSpeed>("balanced");

  /**
   * Preference hydration order:
   *   1. the signed-in user's saved defaults (model / mode / effort) — these
   *      follow them across projects and sessions,
   *   2. the project's own `preferred_ai_model`, which wins for this project.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (uid) {
        const { data: prefs } = await supabase
          .from("user_ai_preferences")
          .select("default_model, agent_mode, effort")
          .eq("user_id", uid)
          .maybeSingle();
        if (!cancelled && prefs) {
          const found = AI_MODELS.find((m) => m.id === prefs.default_model);
          if (found) setSelectedModel(found);
          if (MODE_OPTIONS.some((m) => m.id === prefs.agent_mode)) setAgentMode(prefs.agent_mode as AgentMode);
          if (SPEED_OPTIONS.some((s) => s.id === prefs.effort)) setAgentSpeed(prefs.effort as AgentSpeed);
        }
      }
      if (!projectId || cancelled) return;
      const { data } = await supabase.from("projects").select("preferred_ai_model" as any).eq("id", projectId).maybeSingle();
      const pref = (data as any)?.preferred_ai_model;
      if (pref && !cancelled) {
        const found = AI_MODELS.find(m => m.id === pref);
        if (found) setSelectedModel(found);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  /** Persist the user's global AI defaults so they survive new sessions. */
  const persistUserPrefs = useCallback(async (patch: Record<string, string>) => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      await supabase
        .from("user_ai_preferences")
        .upsert({ user_id: uid, ...patch }, { onConflict: "user_id" });
    } catch { /* preferences are best-effort */ }
  }, []);

  const updateModel = useCallback(async (m: typeof AI_MODELS[number]) => {
    setSelectedModel(m);
    void persistUserPrefs({ default_model: m.id });
    if (projectId) {
      try { await supabase.from("projects").update({ preferred_ai_model: m.id } as any).eq("id", projectId); } catch {}
    }
  }, [projectId, persistUserPrefs]);

  const updateAgentMode = useCallback((mode: AgentMode) => {
    setAgentMode(mode);
    void persistUserPrefs({ agent_mode: mode });
  }, [persistUserPrefs]);

  const updateAgentSpeed = useCallback((speed: AgentSpeed) => {
    setAgentSpeed(speed);
    void persistUserPrefs({ effort: speed });
  }, [persistUserPrefs]);

  const [codeSuggestions, setCodeSuggestions] = useState<CodeSuggestion[]>([]);
  const [trackerActions, setTrackerActions] = useState<TrackerAction[]>([]);
  /** Chat-local live caption. Kept OUT of buildStore so chat activity never
   *  leaks into the Action Panel timeline (and vice-versa). */
  const [chatCaption, setChatCaption] = useState<string | null>(null);
  /** Rebuild requests the AI emitted during this turn (render a button in chat). */
  const [rebuildRequest, setRebuildRequest] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const baseProjectContext = useProjectContext();
  const projectContext = useMemo(
    () => ({ ...baseProjectContext, projectId }),
    [baseProjectContext, projectId]
  );
  const { files, enabledPlugins, pendingChanges, updateFileContent, addFile, removeFile, togglePlugin, addPendingChange, persistToCloud } = useProjectStore();
  const { activePhaseGroups, activeCiSteps, aiTimeline, isBuildActive, thinkingCaption: buildCaption, buildButtonState } = useBuildStore();

  // Helper to add tracker action
  const addTrackerAction = useCallback((action: Omit<TrackerAction, "id" | "startedAt">) => {
    const newAction: TrackerAction = { ...action, id: crypto.randomUUID(), startedAt: Date.now() };
    setTrackerActions(prev => [...prev, newAction]);
    return newAction.id;
  }, []);

  const startBuild = useCallback(async (opts?: { signingMode?: "debug" | "release"; platform?: "android" | "ios" }) => {
    if (!projectId) { toast.error("No project selected"); return; }
    const { runTwoPhaseBuild } = await import("@/lib/twoPhaseBuildRunner");
    const ps = useProjectStore.getState();
    runTwoPhaseBuild({
      projectId,
      appName: ps.buildAppName,
      packageName: ps.buildPackageName,
      signingMode: opts?.signingMode || "debug",
      platform: opts?.platform || "android",
    });
  }, [projectId]);

  const updateTrackerAction = useCallback((id: string, updates: Partial<TrackerAction>) => {
    setTrackerActions(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  }, []);

  // Load chat history from DB
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("project_id", projectId)
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: true })
        .limit(50);
      if (data && data.length > 0) {
        setMessages(data.map(d => ({ role: d.role as "user" | "assistant", content: d.content })));
      }
    })();
  }, [projectId]);

  const persistMessage = useCallback(async (role: string, content: string) => {
    if (!projectId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.from("chat_messages").insert({
        project_id: projectId,
        user_id: session.user.id,
        role,
        content,
      });
    } catch {}
  }, [projectId]);

  // Auto-scroll while streaming. Uses rAF + smooth behavior, but only if user
  // is already near the bottom (so we don't yank them away while reading).
  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distance < 240 || isLoading) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    }
  }, [messages, liveTimeline, buildCaption, isLoading]);

  useEffect(() => {
    if (!projectId) return;
    if (files.length === 0 && enabledPlugins.size === 0 && pendingChanges.length === 0) return;
    const timer = setTimeout(() => {
      persistToCloud(projectId).catch((err) => console.error("Failed to persist project state:", err));
    }, 2500);
    return () => clearTimeout(timer);
  }, [projectId, files, enabledPlugins, pendingChanges, persistToCloud]);

  const parseThinkingActions = useCallback((content: string) => {
    const lines = content.split("\n");
    const actions: ThinkingAction[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[🔍🔧📦⚡🎯🔄✅💡🛠️📋🔬🧪]/)) {
        const text = trimmed.replace(/^[🔍🔧📦⚡🎯🔄✅💡🛠️📋🔬🧪]\s*/, "").slice(0, 50);
        if (text.length > 0 && text.split(" ").length <= 8) {
          actions.push({ id: crypto.randomUUID(), text, done: false });
        }
      }
    }
    return actions;
  }, []);

  const executeToolCall = useCallback((toolCall: ToolCall): string => {
    const { name, arguments: args } = toolCall;

    const friendlyTitle =
      name === "projectMap" ? "Orienting: mapping project" :
      name === "fileOutline" ? `Outlining ${args.path}` :
      name === "readLines" ? `Reading ${args.path} L${args.start}-${args.end}` :
      name === "readAround" ? `Reading around L${args.line} in ${args.path}` :
      name === "findExports" ? `Locating exports${args.name ? ` of ${args.name}` : ""}` :
      name === "findImports" ? `Locating imports of ${args.module}` :
      name === "findUsages" ? `Locating usages of ${args.name}` :
      name === "findSymbol" ? `Locating symbol ${args.name}` :
      name === "searchCode" ? `Grounding search "${(args.pattern || "").slice(0, 30)}"` :
      name === "readSourceCode" ? `Reading ${args.path}` :
      name === "readFiles" ? `Reading ${(args.paths || []).length} files` :
      name === "enablePlugin" ? `${args.enabled ? "Enabling" : "Disabling"} ${args.pluginId}` :
      name === "suggestCodeChange" ? `Reviewing change for ${args.filePath}` :
      name === "searchFiles" ? `Searching for "${args.query}"` :
      name === "listFiles" ? "Mapping project files" :
      name === "createFile" ? `Creating ${args.filePath}` :
      name === "deleteFile" ? `Deleting ${args.filePath}` :
      name === "createFolder" ? `Creating folder ${args.path}` :
      name === "deleteFolder" ? `Deleting folder ${args.path}` :
      name === "movePath" ? `Moving ${args.from} → ${args.to}` :
      name === "copyFile" ? `Copying ${args.from}` :
      name === "moveCode" ? `Moving code into ${args.toPath}` :
      name === "installPackage" ? `Installing ${args.name}` :
      name === "uninstallPackage" ? `Removing ${args.name}` :
      name === "listDependencies" ? "Listing dependencies" :
      name === "editFile" ? `Editing ${args.filePath}` :
      name === "replaceLines" ? `Replacing L${args.start}-${args.end} in ${args.filePath}` :
      name === "insertBeforeLine" ? `Inserting before L${args.line} in ${args.filePath}` :
      name === "insertAfterLine" ? `Inserting after L${args.line} in ${args.filePath}` :
      name === "deleteLines" ? `Deleting L${args.start}-${args.end} in ${args.filePath}` :
      name === "batchEdit" ? `Editing ${(args.edits || []).length} files` :
      name === "writeSourceCode" ? `Writing ${args.filePath}` :
      name === "searchCapawesomeDocs" ? `Looking up docs for "${args.query}"` :
      name === "readCapawesomeDoc" ? `Reading docs · ${args.pluginId}` :
      name === "triggerRebuild" ? "Triggering a rebuild" :
      `Running ${name}`;

    const filesTouched: string[] =
      Array.isArray(args.paths) ? args.paths :
      Array.isArray(args.edits) ? args.edits.map((e: any) => e?.filePath).filter(Boolean) :
      args.path ? [args.path] :
      args.filePath ? [args.filePath] : [];

    // Chat activity stays in the chat: it drives the in-message timeline only,
    // never the Action Panel tracker or the build caption.
    setChatCaption(friendlyTitle);

    // Push a step into the live in-message timeline
    const stepId = crypto.randomUUID();
    const startedAt = Date.now();
    // Snapshot the touched files so we can show a real red/green diff afterwards.
    const diffTargets = filesTouched.slice(0, 3);
    const beforeSnapshot = new Map<string, string>();
    diffTargets.forEach((p) => {
      const c = readFileContent(p);
      if (c != null) beforeSnapshot.set(p, c);
    });
    setLiveTimeline(prev => [...prev, {
      id: stepId, title: friendlyTitle, tool: name,
      files: filesTouched, status: "active", startedAt,
    }]);

    let result = "";

    if (name === "readSourceCode") {
      const path = args.path;
      const allFiles = flattenAllFiles(files);
      const file = allFiles.find((f: any) => f.path === path || f.path.endsWith("/" + path));
      if (file?.content && !file.isBinary) {
        result = file.content.slice(0, 5000);
      } else {
        result = `File not found: ${path}. Available: ${flattenFileNames(files).slice(0, 20).join(", ")}`;
      }
    } else if (name === "readFiles") {
      const paths: string[] = Array.isArray(args.paths) ? args.paths : [];
      const allFiles = flattenAllFiles(files);
      const out: string[] = [];
      for (const p of paths) {
        const f = allFiles.find((x: any) => x.path === p || x.path.endsWith("/" + p));
        if (f?.content && !f.isBinary) {
          out.push(`### ${p}\n${f.content.slice(0, 3000)}`);
        } else {
          out.push(`### ${p}\n(not found or binary)`);
        }
      }
      result = out.join("\n\n");
    } else if (name === "searchFiles") {
      const query = (args.query || "").toLowerCase();
      const allFiles = flattenAllFiles(files);
      const matches: string[] = [];
      for (const f of allFiles) {
        if (f.type === "file" && f.content && !f.isBinary && f.content.toLowerCase().includes(query)) {
          const lines = f.content.split("\n");
          const matchLines = lines
            .map((l: string, i: number) => l.toLowerCase().includes(query) ? `  L${i + 1}: ${l.trim().slice(0, 80)}` : null)
            .filter(Boolean)
            .slice(0, 5);
          matches.push(`${f.path}:\n${matchLines.join("\n")}`);
        }
      }
      result = matches.length > 0 ? matches.slice(0, 10).join("\n\n") : `No matches found for "${args.query}"`;
    } else if (name === "listFiles") {
      result = flattenFileNames(files).join("\n");
    } else if (name === "enablePlugin") {
      const { pluginId, enabled } = args;
      togglePlugin(pluginId);
      addPendingChange({ type: enabled ? "plugin_added" : "plugin_removed", label: `${enabled ? "Enabled" : "Disabled"} plugin: ${pluginId}`, pluginId });
      result = `Plugin ${pluginId} ${enabled ? "enabled" : "disabled"} successfully.`;
    } else if (name === "suggestCodeChange") {
      const suggestion: CodeSuggestion = {
        filePath: args.filePath, description: args.description,
        addedLines: args.addedLines, removedLines: args.removedLines,
      };
      setCodeSuggestions(prev => [...prev, suggestion]);
      result = `Code change suggested for ${args.filePath}: ${args.description}`;
    } else if (name === "writeSourceCode") {
      const { filePath, content } = args;
      updateFileContent(filePath, content);
      addPendingChange({ type: "source_edited", label: `AI wrote: ${filePath}` });
      result = `File ${filePath} updated.`;
    } else if (name === "createFile") {
      const { filePath, content } = args;
      addFile(filePath, content || "");
      addPendingChange({ type: "source_edited", label: `AI created: ${filePath}` });
      result = `File ${filePath} created.`;
    } else if (name === "deleteFile") {
      const { filePath } = args;
      removeFile(filePath);
      addPendingChange({ type: "source_edited", label: `AI deleted: ${filePath}` });
      result = `File ${filePath} deleted.`;
    } else if (name === "createFolder") {
      const folder = String(args.path || "").replace(/\/+$/, "");
      if (!folder) {
        result = "createFolder failed: path is required";
      } else {
        addFile(`${folder}/.gitkeep`, "");
        addPendingChange({ type: "source_edited", label: `AI created folder: ${folder}` });
        result = `Folder ${folder} created.`;
      }
    } else if (name === "deleteFolder") {
      const folder = String(args.path || "").replace(/\/+$/, "");
      const victims = flattenAllFiles(files).filter(
        (f: any) => f.type === "file" && (f.path === folder || f.path.startsWith(folder + "/"))
      );
      if (!folder) {
        result = "deleteFolder failed: path is required";
      } else if (victims.length === 0) {
        result = `deleteFolder: nothing found under ${folder}`;
      } else {
        victims.forEach((f: any) => removeFile(f.path));
        addPendingChange({ type: "source_edited", label: `AI deleted folder: ${folder} (${victims.length} files)` });
        result = `Folder ${folder} deleted (${victims.length} files):\n${victims.map((f: any) => `  - ${f.path}`).join("\n")}`;
      }
    } else if (name === "movePath" || name === "copyFile") {
      const from = String(args.from || "").replace(/\/+$/, "");
      const to = String(args.to || "").replace(/\/+$/, "");
      const allFiles = flattenAllFiles(files);
      const exact = allFiles.find((f: any) => f.type === "file" && f.path === from);
      const inFolder = allFiles.filter((f: any) => f.type === "file" && f.path.startsWith(from + "/"));
      if (!from || !to) {
        result = `${name} failed: both 'from' and 'to' are required`;
      } else if (exact) {
        addFile(to, exact.content || "");
        if (name === "movePath") removeFile(exact.path);
        addPendingChange({ type: "source_edited", label: `AI ${name === "movePath" ? "moved" : "copied"}: ${from} → ${to}` });
        result = `${name === "movePath" ? "Moved" : "Copied"} ${from} → ${to}. Now run findImports on "${from}" and update every importer.`;
      } else if (inFolder.length > 0 && name === "movePath") {
        inFolder.forEach((f: any) => {
          addFile(to + f.path.slice(from.length), f.content || "");
          removeFile(f.path);
        });
        addPendingChange({ type: "source_edited", label: `AI moved folder: ${from} → ${to}` });
        result = `Moved folder ${from} → ${to} (${inFolder.length} files). Update importers of the old paths.`;
      } else {
        result = `${name} failed: ${from} not found`;
      }
    } else if (name === "moveCode") {
      const { fromPath, toPath, start, end, atLine } = args;
      const allFiles = flattenAllFiles(files);
      const src = allFiles.find((f: any) => f.path === fromPath || f.path.endsWith("/" + fromPath));
      const dst = allFiles.find((f: any) => f.path === toPath || f.path.endsWith("/" + toPath));
      if (!src?.content) {
        result = `moveCode failed: ${fromPath} not found`;
      } else if (!dst) {
        result = `moveCode failed: ${toPath} not found — create it first`;
      } else {
        const srcLines = src.content.split("\n");
        const s = Math.max(1, Number(start)), e = Math.min(srcLines.length, Number(end));
        const block = srcLines.slice(s - 1, e);
        const remaining = [...srcLines.slice(0, s - 1), ...srcLines.slice(e)];
        updateFileContent(src.path, remaining.join("\n"));
        const dstLines = (dst.content || "").split("\n");
        const at = typeof atLine === "number" ? Math.min(Math.max(0, atLine), dstLines.length) : dstLines.length;
        const merged = [...dstLines.slice(0, at), ...block, ...dstLines.slice(at)];
        updateFileContent(dst.path, merged.join("\n"));
        addPendingChange({ type: "source_edited", label: `AI moved code: ${fromPath} → ${toPath}` });
        result = `Moved ${block.length} lines from ${fromPath}:${s}-${e} into ${toPath} at line ${at + 1}. Check imports in both files.`;
      }
    } else if (name === "listDependencies" || name === "installPackage" || name === "uninstallPackage") {
      const allFiles = flattenAllFiles(files);
      const pkgFile = allFiles.find((f: any) => f.path === "package.json" || f.path.endsWith("/package.json"));
      if (!pkgFile?.content) {
        result = "package.json not found in this project.";
      } else {
        let pkg: any;
        try { pkg = JSON.parse(pkgFile.content); } catch { pkg = null; }
        if (!pkg) {
          result = "package.json is not valid JSON — fix it before touching dependencies.";
        } else if (name === "listDependencies") {
          const fmt = (o: any) => Object.entries(o || {}).map(([k, v]) => `  ${k}@${v}`).join("\n") || "  (none)";
          result = `dependencies:\n${fmt(pkg.dependencies)}\n\ndevDependencies:\n${fmt(pkg.devDependencies)}`;
        } else if (name === "installPackage") {
          const key = args.dev ? "devDependencies" : "dependencies";
          pkg[key] = pkg[key] || {};
          pkg[key][args.name] = args.version || "latest";
          pkg[key] = Object.fromEntries(Object.entries(pkg[key]).sort(([a], [b]) => a.localeCompare(b)));
          updateFileContent(pkgFile.path, JSON.stringify(pkg, null, 2) + "\n");
          addPendingChange({ type: "source_edited", label: `AI installed: ${args.name}` });
          result = `Added ${args.name}@${args.version || "latest"} to ${key}. It will be installed on the next build/sync.`;
        } else {
          let removed = false;
          for (const key of ["dependencies", "devDependencies"]) {
            if (pkg[key]?.[args.name]) { delete pkg[key][args.name]; removed = true; }
          }
          if (!removed) {
            result = `${args.name} is not in package.json.`;
          } else {
            updateFileContent(pkgFile.path, JSON.stringify(pkg, null, 2) + "\n");
            addPendingChange({ type: "source_edited", label: `AI removed: ${args.name}` });
            result = `Removed ${args.name} from package.json.`;
          }
        }
      }
    } else if (name === "editFile") {
      const { filePath, oldText, newText } = args;
      const allFiles = flattenAllFiles(files);
      const file = allFiles.find((f: any) => f.path === filePath || f.path.endsWith("/" + filePath));
      if (!file?.content) {
        result = `editFile failed: ${filePath} not found`;
      } else if (!file.content.includes(oldText)) {
        result = `editFile failed: oldText not found in ${filePath}`;
      } else {
        const updated = file.content.replace(oldText, newText);
        updateFileContent(file.path, updated);
        addPendingChange({ type: "source_edited", label: `AI edited: ${filePath}` });
        result = `File ${filePath} edited (${oldText.length} → ${newText.length} chars).`;
      }
    } else if (name === "batchEdit") {
      // Apply many edits / new files in a single tool call.
      const edits: Array<{ filePath: string; content?: string; oldText?: string; newText?: string }> =
        Array.isArray(args.edits) ? args.edits : [];
      const allFiles = flattenAllFiles(files);
      const summaries: string[] = [];
      let okCount = 0;
      for (const e of edits) {
        const fp = e.filePath;
        if (!fp) { summaries.push("• skipped: missing filePath"); continue; }
        // Per-file live caption so the spinner reflects which file is being written.
        setChatCaption(`Editing ${fp.split("/").pop()}`);

        if (typeof e.oldText === "string" && typeof e.newText === "string") {
          const file = allFiles.find((f: any) => f.path === fp || f.path.endsWith("/" + fp));
          if (!file?.content) { summaries.push(`• ${fp}: not found`); continue; }
          if (!file.content.includes(e.oldText)) { summaries.push(`• ${fp}: oldText not found`); continue; }
          updateFileContent(file.path, file.content.replace(e.oldText, e.newText));
          addPendingChange({ type: "source_edited", label: `AI edited: ${fp}` });
          summaries.push(`• ${fp}: patched`); okCount++;
        } else if (typeof e.content === "string") {
          // Upsert: write or create.
          const existing = allFiles.find((f: any) => f.path === fp || f.path.endsWith("/" + fp));
          if (existing) {
            updateFileContent(existing.path, e.content);
            summaries.push(`• ${fp}: rewritten`);
          } else {
            addFile(fp, e.content);
            summaries.push(`• ${fp}: created`);
          }
          addPendingChange({ type: "source_edited", label: `AI wrote: ${fp}` });
          okCount++;
        } else {
          summaries.push(`• ${fp}: missing content/oldText/newText`);
        }
      }
      result = `batchEdit applied ${okCount}/${edits.length} edits:\n${summaries.join("\n")}`;
    } else if (name === "replaceLines" || name === "insertBeforeLine" || name === "insertAfterLine" || name === "deleteLines") {
      // Line-precision surgical edits — the payoff of the grounding workflow.
      const fp: string = args.filePath;
      const allFiles = flattenAllFiles(files);
      const file = allFiles.find((f: any) => f.path === fp || f.path.endsWith("/" + fp));
      if (!file?.content) {
        result = `${name} failed: ${fp} not found`;
      } else {
        const lines = file.content.split("\n");
        try {
          if (name === "replaceLines") {
            const s = Math.max(1, Number(args.start));
            const e = Math.min(lines.length, Number(args.end));
            if (!s || !e || s > e) throw new Error(`invalid range L${args.start}-L${args.end}`);
            const replacement = String(args.newContent ?? "").split("\n");
            lines.splice(s - 1, e - s + 1, ...replacement);
            result = `Replaced L${s}-L${e} in ${fp} (${e - s + 1} → ${replacement.length} lines).`;
          } else if (name === "insertBeforeLine") {
            const l = Math.max(1, Math.min(lines.length + 1, Number(args.line)));
            const chunk = String(args.content ?? "").split("\n");
            lines.splice(l - 1, 0, ...chunk);
            result = `Inserted ${chunk.length} lines before L${l} in ${fp}.`;
          } else if (name === "insertAfterLine") {
            const l = Math.max(0, Math.min(lines.length, Number(args.line)));
            const chunk = String(args.content ?? "").split("\n");
            lines.splice(l, 0, ...chunk);
            result = `Inserted ${chunk.length} lines after L${l} in ${fp}.`;
          } else {
            const s = Math.max(1, Number(args.start));
            const e = Math.min(lines.length, Number(args.end));
            if (!s || !e || s > e) throw new Error(`invalid range L${args.start}-L${args.end}`);
            lines.splice(s - 1, e - s + 1);
            result = `Deleted L${s}-L${e} in ${fp}.`;
          }
          updateFileContent(file.path, lines.join("\n"));
          addPendingChange({ type: "source_edited", label: `AI ${name}: ${fp}` });
        } catch (err: any) {
          result = `${name} failed: ${err?.message || String(err)}`;
        }
      }
    } else if (name === "triggerRebuild") {
      setRebuildRequest(String(args.reason || "Re-run the build with the applied fixes."));
      result = `Rebuild button surfaced in the chat: "${args.reason}". The user can click it to re-trigger the build.`;
    } else if (name === "searchCapawesomeDocs") {
      const docs = searchCapawesomeDocs(args.query || "");
      result = docs.length === 0
        ? `No docs found for "${args.query}".`
        : docs.map(d => `- ${d.id} · ${d.npm} · ${d.androidPermissions.join(", ") || "no permissions"}`).join("\n");
    } else if (name === "readCapawesomeDoc") {
      const doc = readCapawesomeDoc(args.pluginId || "");
      result = doc
        ? `# ${doc.pluginName}\nnpm: ${doc.npm}\nimport: ${doc.importName}\npermissions: ${doc.androidPermissions.join(", ") || "none"}\n${doc.setupNotes ? `\nsetup: ${doc.setupNotes}` : ""}${doc.usageSnippet ? `\n\n${doc.usageSnippet}` : ""}`
        : `No doc found for "${args.pluginId}".`;
    } else if (name === "getBuildLogs") {
      const job = useBuildStore.getState().getActiveJob();
      const tail = Math.min(Number(args.tail) || 80, 400);
      result = job ? job.logs.slice(-tail).join("\n") || "(no logs yet)" : "No active build job.";
    } else if (name === "getCiStepLog") {
      const stepName = String(args.stepName || "").toLowerCase();
      const step = useBuildStore.getState().activeCiSteps.find((s) => s.name.toLowerCase().includes(stepName));
      result = step
        ? `${step.name} — ${step.status}/${step.conclusion ?? "?"}\n${step.logExcerpt || "(no excerpt)"}`
        : `No CI step matching "${args.stepName}". Available: ${useBuildStore.getState().activeCiSteps.map(s => s.name).join(", ") || "(none)"}`;
    } else if (name === "parseLastError") {
      const jobs = useBuildStore.getState().jobs;
      const failed = jobs.find((j) => j.status === "failure" || j.errorInfo);
      if (!failed) {
        result = "No failed builds in this session.";
      } else {
        const ei = failed.errorInfo || {};
        result = `Last failed build: ${failed.appName}\nFailed step: ${ei.failedStep || failed.stage}\nType: ${ei.errorType || "unknown"}\nDetail: ${ei.errorDetail || failed.error || "(none)"}\nSuggested fix: ${ei.suggestedFix || "(none)"}`;
      }
    } else if (name === "listArtifacts") {
      const jobs = useBuildStore.getState().jobs.slice(0, 8);
      result = jobs.length === 0
        ? "No builds yet."
        : jobs.map(j => `• ${j.appName} (${j.status}) ${j.signingMode || "debug"}${j.apkUrl ? `\n   APK: ${j.apkUrl}` : ""}${j.aabUrl ? `\n   AAB: ${j.aabUrl}` : ""}`).join("\n");
    } else if (name === "getConsoleLogs") {
      const entries = getRuntimeConsoleLogs({ level: args.level, limit: args.limit });
      result = entries.length === 0
        ? "Console is empty."
        : entries.map(e => `[${e.level}] ${new Date(e.ts).toISOString().slice(11, 19)}  ${e.message}`).join("\n");
    } else if (name === "getNetworkRequests") {
      const entries = getNetworkRequestsBuf({
        status: args.status, urlContains: args.urlContains, errorsOnly: args.errorsOnly, limit: args.limit,
      });
      result = entries.length === 0
        ? "No network activity captured."
        : entries.map(e => `${e.method} ${e.status ?? "ERR"} ${e.durationMs ?? "?"}ms  ${e.url}${e.error ? `  ✗ ${e.error}` : ""}`).join("\n");
    } else if (name === "getRuntimeErrors") {
      const entries = getRuntimeErrorsBuf(args.limit);
      result = entries.length === 0
        ? "No runtime errors recorded."
        : entries.map(e => `• ${e.message}${e.source ? `\n  at ${e.source}` : ""}`).join("\n\n");
    } else {
      result = `Unknown tool: ${name}`;
    }

    const completedAt = Date.now();
    let diffAdded: string[] | undefined;
    let diffRemoved: string[] | undefined;
    for (const p of diffTargets) {
      const after = readFileContent(p);
      if (after == null) continue;
      const before = beforeSnapshot.get(p) ?? "";
      if (before === after) continue;
      const d = lineDiff(before, after);
      diffAdded = [...(diffAdded || []), ...d.added];
      diffRemoved = [...(diffRemoved || []), ...d.removed];
    }
    setLiveTimeline(prev => prev.map(s => s.id === stepId
      ? {
          ...s,
          status: "done" as const,
          completedAt,
          result: result.slice(0, 1500),
          diffAdded,
          diffRemoved,
          added: diffAdded?.length,
          removed: diffRemoved?.length,
        }
      : s));
    return result;
  }, [files, togglePlugin, addPendingChange, updateFileContent, addFile, removeFile, addTrackerAction, updateTrackerAction]);

  const acceptCodeSuggestion = (idx: number) => {
    const suggestion = codeSuggestions[idx];
    if (!suggestion) return;
    const allFiles = flattenAllFiles(files);
    const file = allFiles.find((f: any) => f.path === suggestion.filePath);
    if (!file?.content) { toast.error("File not found: " + suggestion.filePath); return; }

    let content = file.content;
    if (suggestion.removedLines?.length) {
      for (const line of suggestion.removedLines) content = content.replace(line, "");
    }
    if (suggestion.addedLines?.length) content += "\n" + suggestion.addedLines.join("\n");

    updateFileContent(suggestion.filePath, content);
    addPendingChange({ type: "source_edited", label: `Agent modified: ${suggestion.filePath}` });
    setCodeSuggestions(prev => prev.map((s, i) => i === idx ? { ...s, accepted: true } : s));
    toast.success("Code change applied to " + suggestion.filePath);
  };

  const rejectCodeSuggestion = (idx: number) => {
    setCodeSuggestions(prev => prev.map((s, i) => i === idx ? { ...s, accepted: false } : s));
  };

  const dynamicCaption = (text: string): string => {
    // Pick a short, dynamic caption from the latest assistant prose.
    const trimmed = text.trim();
    if (!trimmed) return "Thinking";
    const lastLine = trimmed.split("\n").filter(Boolean).slice(-1)[0] || "";
    const cleaned = lastLine.replace(/^[#>*\-\d.\s]+/, "").replace(/[*_`]/g, "").trim();
    if (cleaned.length < 4) return "Thinking";
    if (/\b(read|reading|scan|inspect)/i.test(cleaned)) return "Reading the codebase";
    if (/\b(write|writing|edit|editing|update)/i.test(cleaned)) return "Editing files";
    if (/\b(plan|planning|approach)/i.test(cleaned)) return "Planning the approach";
    if (/\b(check|verify|validat)/i.test(cleaned)) return "Verifying changes";
    if (/\b(search|look up|lookup|find)/i.test(cleaned)) return "Searching the project";
    if (/\b(install|plugin|config)/i.test(cleaned)) return "Configuring plugins";
    return cleaned.length > 60 ? cleaned.slice(0, 57) + "…" : cleaned;
  };

  const compactChatHistory = (history: Msg[]): Msg[] => history
    .slice(-14)
    .map((m) => ({
      role: m.role,
      content: (m.content.includes("> **Tool:")
        ? m.content.replace(/\n?> \*\*Tool:[\s\S]*$/g, "\n\n> Prior tool output omitted to keep this request small.")
        : m.content
      ).slice(0, 6000),
    }));

  const sendMessage = async (content: string, attachments: ComposerAttachment[] = []) => {
    if ((!content.trim() && attachments.length === 0) || isLoading) return;

    // Text-like attachments are inlined into the prompt; images travel as
    // structured parts so the model can actually look at them.
    const textAttachments = attachments.filter((a) => a.kind === "text");
    const imageAttachments = attachments.filter((a) => a.kind === "image");
    const inlined = textAttachments
      .map((a) => `\n\n### Attached file: ${a.name}\n\`\`\`\n${a.content.slice(0, 40_000)}\n\`\`\``)
      .join("");
    const displayContent = `${content.trim()}${
      attachments.length ? `\n\n_${attachments.map((a) => a.name).join(", ")}_` : ""
    }`.trim();
    const promptContent = `${content.trim()}${inlined}`.trim() || "Review the attached files.";

    const userMsg: Msg = { role: "user", content: displayContent || promptContent };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    setChatCaption("Thinking");
    setRebuildRequest(null);
    setLiveTimeline([]);
    persistMessage("user", displayContent || promptContent);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      startTransition(() => {
        setChatCaption(dynamicCaption(assistantSoFar));
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      });
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: [
            ...compactChatHistory(messages),
            { role: "user" as const, content: promptContent.slice(0, 60_000) },
          ],
          images: imageAttachments.map((a) => ({ name: a.name, dataUrl: a.content })),
          projectContext,
          model: selectedModel.id,
          agentMode,
          agentSpeed,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        throw new Error(errText || `ForgeAI request failed (${resp.status})`);
      }
      if (!resp.body) throw new Error("Failed to start stream");
      // Edge function returns 200 + JSON when the upstream gateway errors.
      const ct = resp.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const errBody = await resp.json().catch(() => ({}));
        const detail = errBody?.detail ? ` — ${String(errBody.detail).slice(0, 200)}` : "";
        const fallbackMessage = `I couldn't start the AI stream right now. ${errBody?.error || "Unknown AI service error"}${detail}`;
        upsertAssistant(fallbackMessage);
        toast.error(errBody?.error || "AI service error");
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;
      let pendingToolCalls: ToolCall[] = [];
      const toolCallArgBuffers: Record<number, string> = {};

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            // OpenAI-shape streaming chunks (delta.content)
            const choice = parsed.choices?.[0];
            const c = choice?.delta?.content as string | undefined;
            if (c) upsertAssistant(c);
            const toolCalls = choice?.delta?.tool_calls;
            if (toolCalls) {
              for (const tc of toolCalls) {
                const idx = tc.index ?? pendingToolCalls.length;
                if (tc.function?.name) {
                  pendingToolCalls[idx] = { id: tc.id || crypto.randomUUID(), name: tc.function.name, arguments: {} };
                  toolCallArgBuffers[idx] = "";
                }
                if (tc.function?.arguments) toolCallArgBuffers[idx] = (toolCallArgBuffers[idx] || "") + tc.function.arguments;
              }
            }
            // ForgeAI custom events
            if (parsed.type === "tool") {
              executeToolCall({ id: parsed.id || crypto.randomUUID(), name: parsed.name, arguments: parsed.arguments || {} });
            } else if (parsed.type === "progress" && typeof parsed.title === "string") {
              // AI-authored short title (≤10 words). Drives the single live spinner caption.
              const t = parsed.title.split(/\s+/).slice(0, 10).join(" ");
              setChatCaption(t);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      for (const idxStr of Object.keys(toolCallArgBuffers)) {
        const idx = Number(idxStr);
        const tc = pendingToolCalls[idx];
        if (tc && toolCallArgBuffers[idx]) {
          try { tc.arguments = JSON.parse(toolCallArgBuffers[idx]); } catch {}
        }
      }

      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const c = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (c) upsertAssistant(c);
            if (parsed.type === "tool") {
              executeToolCall({ id: parsed.id || crypto.randomUUID(), name: parsed.name, arguments: parsed.arguments || {} });
            }
          } catch {}
        }
      }

      if (pendingToolCalls.length > 0) {
        for (const tc of pendingToolCalls) executeToolCall(tc);
      }

      // Snapshot the live timeline onto the final assistant message
      setLiveTimeline(currentTimeline => {
        const finalTimeline = currentTimeline.map(s =>
          s.status === "active" ? { ...s, status: "done" as const, completedAt: Date.now() } : s
        );
        setMessages(prev => prev.map((m, i) =>
          i === prev.length - 1 && m.role === "assistant"
            ? { ...m, timeline: finalTimeline.length > 0 ? finalTimeline : undefined }
            : m
        ));
        return [];
      });

      if (assistantSoFar) persistMessage("assistant", assistantSoFar);
    } catch (e) {
      console.error("ForgeAI error:", e);
      toast.error("Failed to connect to ForgeAI");
    } finally {
      setIsLoading(false);
      setChatCaption(null);
    }
  };

  const clearChat = async () => {
    setMessages([]); setInput(""); setCodeSuggestions([]);
    if (projectId) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) await supabase.from("chat_messages").delete().eq("project_id", projectId).eq("user_id", session.user.id);
      } catch {}
    }
  };

  const hasMessages = messages.length > 0;

  // Vertical icon rail (Firebase-style). Only "actions" and "chat" are functional;
  // the other items are present in the rail but show placeholder content.
  const railItems: { id: AssistantTab; icon: typeof Activity; title: string; live?: boolean }[] = [
    { id: "actions", icon: Activity, title: "Actions", live: trackerActions.some(a => a.status === "running") || isBuildActive },
    { id: "chat", icon: MessageCircle, title: "Chat (AI)" },
    { id: "install", icon: Smartphone, title: "Install to device" },
    { id: "notifications", icon: Bell, title: "Notifications" },
    { id: "help", icon: HelpCircle, title: "Help" },
    { id: "console", icon: Terminal, title: "Console" },
    { id: "learn", icon: GraduationCap, title: "Learn" },
  ];

  const Rail = () => (
    <div className="shrink-0 w-11 flex flex-col items-center py-3 gap-0.5 bg-transparent">
      {railItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => selectTab(item.id)}
            title={item.title}
            className={`group relative w-full h-10 flex items-center justify-center transition-colors ${
              isActive ? "text-foreground" : "text-muted-foreground/70 hover:text-foreground"
            }`}
          >
            <Icon size={17} strokeWidth={isActive ? 2 : 1.6} />
            {item.live && !isActive && (
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            )}
            {/* Right-edge active line indicator */}
            <span
              className={`absolute right-0 top-1.5 bottom-1.5 w-[2px] rounded-l-full transition-all ${
                isActive ? "bg-foreground" : "bg-transparent group-hover:bg-border"
              }`}
            />
          </button>
        );
      })}
      <div className="flex-1" />
      <button
        onClick={onClose}
        title="Close panel"
        className="w-full h-10 flex items-center justify-center text-muted-foreground/70 hover:text-foreground transition-colors"
      >
        <X size={15} />
      </button>
    </div>
  );

  return (
    <div className="w-full h-full flex overflow-hidden bg-transparent">
      {/* ── Right content area ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {activeTab === "actions" ? (
          <ActionTrackerPanel
            actions={trackerActions}
            phaseGroups={activePhaseGroups}
            pendingChanges={pendingChanges}
            ciSteps={activeCiSteps}
            aiTimeline={aiTimeline}
            isBuildActive={isBuildActive}
            canBuild={files.length > 0}
            thinkingCaption={buildCaption}
            modelLabel={selectedModel.label}
            modelId={selectedModel.id}

            buildButtonLabel={
              buildButtonState === "validating" ? "Validating plugins" :
              buildButtonState === "phase1-setup" ? "Phase 1: Setup" :
              buildButtonState === "ai-wiring" ? "AI Wiring" :
              buildButtonState === "phase2-build" ? "Phase 2: Build" :
              buildButtonState === "ready" ? "Build ready" :
              buildButtonState === "failed" ? "Retry build" :
              undefined
            }
            onBuild={(buildOpts) => startBuild(buildOpts)}
          />
        ) : activeTab === "chat" ? (
          <>
            {/* Chat header (new conversation) */}
            <div className="shrink-0 flex items-center justify-end px-3 py-1.5 border-b border-border">
              {hasMessages && (
                <button className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="New chat" onClick={clearChat}>
                  <Plus size={14} className="text-muted-foreground" />
                </button>
              )}
            </div>
            {/* Messages */}
            <div ref={messagesScrollRef} className="flex-1 overflow-y-auto">
              {!hasMessages ? (
                <div className="flex flex-col items-center justify-center h-full px-6">
                  <NativeBridgeLogo size={48} />
                  <p className="mt-4 text-sm text-muted-foreground">Where do you want to get started?</p>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {["Read my source code", "What plugins should I use?", "Search my project files"].map(q => (
                      <button key={q} onClick={() => sendMessage(q)} className="text-xs px-3 py-1.5 rounded-full bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="px-4 py-4 space-y-5">
                  {messages.map((msg, i) => {
                    const isLastAssistant = msg.role === "assistant" && i === messages.length - 1;
                    const streaming = isLastAssistant && isLoading;
                    return (
                      <div key={i}>
                        {msg.role === "user" ? (
                          <div className="flex justify-end mb-1">
                            <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-3.5 py-2 text-[12.5px] leading-[1.5]">
                              {msg.content}
                            </div>
                          </div>
                        ) : (
                          <div className="max-w-full">
                            {/* Single static header — the live spinner lives in ChatTimeline below to avoid duplication */}
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <AiMark size={12} className="text-foreground/70" />
                              <span className="text-[11px] font-medium text-muted-foreground">Agent</span>
                            </div>
                            {/* Inline timeline — either live (during streaming) or persisted */}
                            <ChatTimeline
                              steps={streaming ? liveTimeline : (msg.timeline || [])}
                              caption={streaming ? chatCaption : null}
                            />
                            <ChatMarkdown content={msg.content} streaming={streaming} />
                            {!streaming && msg.content.trim().length > 0 && (
                              <MessageActions
                                content={msg.content}
                                onRegenerate={isLastAssistant ? () => {
                                  // re-run with last user message
                                  const lastUser = [...messages].reverse().find(m => m.role === "user");
                                  if (lastUser) {
                                    setMessages(prev => prev.slice(0, -1));
                                    sendMessage(lastUser.content);
                                  }
                                } : undefined}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Code Suggestions */}
                  {codeSuggestions.filter(s => s.accepted === undefined).map((suggestion, idx) => (
                    <div key={`suggestion-${idx}`} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                      <div className="text-[12px] font-medium text-foreground">📝 Code Change: {suggestion.filePath}</div>
                      <p className="text-[11.5px] text-muted-foreground">{suggestion.description}</p>
                      {suggestion.addedLines && (
                        <pre className="text-[11px] bg-muted/50 rounded p-2 overflow-x-auto border border-border">
                          {suggestion.addedLines.map(l => `+ ${l}`).join("\n")}
                        </pre>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => acceptCodeSuggestion(idx)} className="flex items-center gap-1 text-[11.5px] px-3 py-1 rounded bg-foreground text-background hover:bg-foreground/90 transition-colors">
                          <Check size={12} /> Accept
                        </button>
                        <button onClick={() => rejectCodeSuggestion(idx)} className="flex items-center gap-1 text-[11.5px] px-3 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                          <XCircle size={12} /> Reject
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* When the assistant message hasn't been created yet but we're loading, show a standalone caption */}
                  {isLoading && (messages[messages.length - 1]?.role !== "assistant") && (
                    <div className="px-1">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <AiMark size={12} className="text-foreground/70" />
                        <span className="text-[11px] font-medium text-muted-foreground">Agent</span>
                      </div>
                      <ChatTimeline steps={liveTimeline} caption={chatCaption || "Thinking"} />
                    </div>
                  )}

                  {/* AI-requested rebuild — one click re-triggers the pipeline */}
                  {rebuildRequest && !isLoading && (
                    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                      <div className="text-[12px] font-medium text-foreground">Rebuild suggested</div>
                      <p className="text-[11.5px] text-muted-foreground">{rebuildRequest}</p>
                      <button
                        onClick={() => { setRebuildRequest(null); selectTab("actions"); startBuild(); }}
                        className="flex items-center gap-1.5 text-[11.5px] px-3 py-1.5 rounded bg-foreground text-background hover:bg-foreground/90 transition-colors"
                      >
                        <Zap size={12} /> Re-trigger build
                      </button>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <ChatComposer
              value={input}
              onChange={setInput}
              onSend={(text, atts) => sendMessage(text, atts)}
              isLoading={isLoading}
              mode={agentMode}
              modeOptions={MODE_OPTIONS}
              onModeChange={(m) => updateAgentMode(m as AgentMode)}
              effort={agentSpeed}
              effortOptions={SPEED_OPTIONS}
              onEffortChange={(s) => updateAgentSpeed(s as AgentSpeed)}
              showEffort
              modelSlot={
                <DropdownMenu>
                  <DropdownMenuTrigger className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors px-2 py-1 rounded-lg hover:bg-muted/60">
                    <ModelIcon modelId={selectedModel.id} size={12} />
                    <span className="hidden sm:inline">{selectedModel.label}</span>
                    <ChevronDown size={10} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60 rounded-[6px] max-h-[420px] overflow-y-auto">
                    {Array.from(new Set(AI_MODELS.map(m => m.group))).map(group => (
                      <div key={group}>
                        <div className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                          {group}
                        </div>
                        {AI_MODELS.filter(m => m.group === group).map(m => (
                          <DropdownMenuItem
                            key={m.id}
                            onClick={() => updateModel(m)}
                            className={`rounded-[4px] text-xs gap-2 ${selectedModel.id === m.id ? "bg-muted font-medium" : ""}`}
                          >
                            <ModelIcon modelId={m.id} size={13} />
                            <span className="flex-1">{m.label}</span>
                            {selectedModel.id === m.id && <Check size={11} className="text-primary" />}
                          </DropdownMenuItem>
                        ))}
                      </div>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              }
            />
          </>
        ) : activeTab === "console" ? (
          <ConsolePanel />
        ) : activeTab === "install" ? (
          <InstallPanel />
        ) : (
          <PlaceholderTab id={activeTab} />
        )}
      </div>
      {/* ── Vertical icon rail (right) ── */}
      <Rail />
    </div>
  );
};

const PlaceholderTab = ({ id }: { id: string }) => {
  const labels: Record<string, { title: string; description: string }> = {
    notifications: { title: "Notifications", description: "Build alerts, GitHub events, and signing key updates will appear here." },
    help: { title: "Help & Docs", description: "Guides for getting started, plugins, signing, and troubleshooting." },
    console: { title: "Console", description: "Live logs from the build runner and AI agent will stream here." },
    learn: { title: "Learn", description: "Tutorials and best-practices for shipping native apps." },
  };
  const item = labels[id] || { title: id, description: "Coming soon." };
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mb-3 text-muted-foreground/60">
        <AiMark size={20} />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
      <p className="text-xs text-muted-foreground mt-1.5 max-w-xs leading-relaxed">{item.description}</p>
    </div>
  );
};

export default AssistantPanel;

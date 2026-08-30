/**
 * AI Repair step — the wizard step between "Source" and "Plan".
 *
 * Streams the readiness agent's work into the same Copilot timeline the Action
 * Panel uses, patches the in-memory project tree, then re-runs the
 * deterministic gates so the wizard can unlock "Next" on a verified project.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, RotateCcw, CheckCircle2, AlertTriangle } from "lucide-react";
import ChatTimeline, { type ChatTimelineStep } from "@/components/chat/ChatTimeline";
import { useProjectStore } from "@/stores/projectStore";
import type { ProjectScanResult } from "@/lib/tools/projectScanner";
import type { ReactReadinessReport } from "@/lib/tools/reactReadinessScan";
import type { ProjectEntryCandidate } from "@/lib/tools/projectIndexer";
import {
  applyPackageJsonPatch,
  buildCanonicalRepresentation,
  collectFindings,
  diffLines,
  flattenTree,
  patchSignature,
  requestRepair,
  selectContextFiles,
  verifyPatchedTree,
  type ReadinessFinding,
  type VerificationCheck,
} from "@/lib/repair/readinessAgent";

export interface RepairOutcome {
  clean: boolean;
  filesChanged: string[];
  filesDeleted: string[];
  addedDependencies: { name: string; version: string; dev?: boolean }[];
  resolvedFindings: string[];
  verification: VerificationCheck[];
  notes: string;
  scan: ProjectScanResult;
  readiness: ReactReadinessReport | null;
}

interface AIRepairStepProps {
  scan: ProjectScanResult;
  readiness: ReactReadinessReport | null;
  entry: ProjectEntryCandidate | null;
  appRoot: string;
  buildCommand: string;
  outputDir: string;
  engine: string;
  onOutcome: (outcome: RepairOutcome | null) => void;
}

type FindingState = "pending" | "fixing" | "fixed" | "needs-you";

const MAX_ROUNDS = 2;

const AIRepairStep = ({
  scan,
  readiness,
  entry,
  appRoot,
  buildCommand,
  outputDir,
  engine,
  onOutcome,
}: AIRepairStepProps) => {
  const [steps, setSteps] = useState<ChatTimelineStep[]>([]);
  const [caption, setCaption] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [findings, setFindings] = useState<{ finding: ReadinessFinding; state: FindingState }[]>([]);
  const [outcome, setOutcome] = useState<RepairOutcome | null>(null);
  const startedRef = useRef(false);

  const push = useCallback((step: Omit<ChatTimelineStep, "id" | "startedAt">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setSteps((prev) => [...prev, { id, startedAt: Date.now(), ...step } as ChatTimelineStep]);
    return id;
  }, []);

  const finish = useCallback((id: string, patch: Partial<ChatTimelineStep>) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "done", completedAt: Date.now(), ...patch } : s)),
    );
  }, []);

  const markFinding = useCallback((ids: string[], state: FindingState) => {
    setFindings((prev) =>
      prev.map((f) => (ids.includes(f.finding.id) ? { ...f, state } : f)),
    );
  }, []);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    setDone(false);
    setSteps([]);
    setOutcome(null);
    onOutcome(null);

    const store = useProjectStore.getState();

    try {
      let flat = flattenTree(store.files);
      const initialFindings = collectFindings(scan, readiness);
      setFindings(initialFindings.map((f) => ({ finding: f, state: "pending" })));

      push({
        narration: `Repairing ${initialFindings.length} readiness finding${
          initialFindings.length === 1 ? "" : "s"
        } before this project is created. Edits are validated against the exact CI contract the build workflow uses, so what ships here is what compiles there.`,
        title: "intro",
        status: "done",
        completedAt: Date.now(),
      });

      setCaption("Building canonical project representation");
      const canonical = buildCanonicalRepresentation(scan, readiness, entry, {
        appRoot,
        buildCommand,
        outputDir,
      });
      const cprStep = push({ title: "Building canonical project representation", tool: "map", status: "active" });
      finish(cprStep, {
        detail: `${canonical.framework} · ${canonical.buildTool ?? "unknown build tool"} · out "${canonical.outputDir}" · Node ${canonical.ci.nodeVersion} · Capacitor ${canonical.ci.capacitorMajor}`,
        result: JSON.stringify(canonical, null, 2),
      });

      const context = selectContextFiles(flat, initialFindings);
      const readStep = push({ title: "Reading source referenced by findings", tool: "read", status: "active" });
      finish(readStep, { files: context.map((f) => f.path) });

      let previousFailures: string[] = [];
      let lastSignature = "";
      let verification: VerificationCheck[] = [];
      const changed = new Set<string>();
      const deleted = new Set<string>();
      const addedDeps: { name: string; version: string; dev?: boolean }[] = [];
      const resolved = new Set<string>();
      let notes = "";
      let finalScan = scan;
      let finalReadiness = readiness;
      let clean = false;

      for (let attempt = 1; attempt <= MAX_ROUNDS; attempt++) {
        setCaption(attempt === 1 ? "AI agent is repairing your project" : "Correcting remaining failures");
        const aiStep = push({
          title: attempt === 1 ? "Consulting repair agent" : `Correction round ${attempt}`,
          tool: "ai",
          status: "active",
        });
        markFinding(initialFindings.map((f) => f.id), "fixing");

        const result = await requestRepair({
          flat,
          canonical,
          findings: initialFindings,
          attempt,
          previousFailures,
        });

        finish(aiStep, {
          detail: result.notes || `${result.fileEdits.length} edit(s) proposed`,
          result: result.notes,
        });
        notes = result.notes || notes;

        const signature = patchSignature(result);
        if (signature && signature === lastSignature) {
          push({
            narration: "The agent returned the same patch set again — stopping instead of looping on an ineffective fix.",
            title: "loop-stop",
            status: "done",
            completedAt: Date.now(),
          });
          break;
        }
        lastSignature = signature;

        const byPath = new Map(flat.map((f) => [f.path, f.content ?? ""]));

        for (const edit of result.fileEdits) {
          const before = byPath.get(edit.path) ?? "";
          const stats = diffLines(before, edit.newContent);
          if (byPath.has(edit.path)) {
            useProjectStore.getState().markAiChanged(edit.path, before);
            useProjectStore.getState().updateFileContent(edit.path, edit.newContent);
          } else {
            useProjectStore.getState().addFile(edit.path, edit.newContent);
          }
          changed.add(edit.path);
          const id = push({
            title: edit.path,
            tool: "write",
            files: [edit.path],
            status: "active",
            detail: edit.reason,
          });
          finish(id, {
            added: stats.addedCount,
            removed: stats.removedCount,
            diffAdded: stats.added,
            diffRemoved: stats.removed,
          });
          if (edit.findingId) resolved.add(edit.findingId);
        }

        for (const del of result.fileDeletes) {
          useProjectStore.getState().removeFile(del.path);
          deleted.add(del.path);
          const id = push({ title: `Deleted ${del.path}`, tool: "delete", status: "active", detail: del.reason });
          finish(id, {});
        }

        if (result.packageJsonPatch.length > 0) {
          const pkgBefore = useProjectStore
            .getState()
            .files && flattenTree(useProjectStore.getState().files).find((f) => f.path === "package.json")?.content;
          const patched = applyPackageJsonPatch(pkgBefore ?? "{}", result.packageJsonPatch);
          if (patched) {
            useProjectStore.getState().markAiChanged("package.json", pkgBefore ?? "");
            useProjectStore.getState().updateFileContent("package.json", patched);
            changed.add("package.json");
            addedDeps.push(...result.packageJsonPatch);
            const stats = diffLines(pkgBefore ?? "", patched);
            const id = push({
              title: "package.json",
              tool: "write",
              files: ["package.json"],
              status: "active",
              detail: `Added ${result.packageJsonPatch.map((p) => `${p.name}@${p.version}`).join(", ")}`,
            });
            finish(id, {
              added: stats.addedCount,
              removed: stats.removedCount,
              diffAdded: stats.added,
              diffRemoved: stats.removed,
            });
          }
        }

        for (const id of result.resolved) resolved.add(id);

        setCaption("Verifying compatibility");
        flat = flattenTree(useProjectStore.getState().files);
        const verified = verifyPatchedTree(flat, engine, outputDir);
        verification = verified.checks;
        finalScan = verified.scan;
        finalReadiness = verified.readiness;

        for (const check of verified.checks) {
          const id = push({
            title: check.label,
            command: check.command,
            status: "active",
          });
          setSteps((prev) =>
            prev.map((s) =>
              s.id === id
                ? {
                    ...s,
                    status: check.passed ? "done" : "error",
                    completedAt: Date.now(),
                    output: check.output,
                    exitCode: check.passed ? 0 : 1,
                  }
                : s,
            ),
          );
        }

        const failures = verified.checks.filter((c) => !c.passed);
        clean = failures.length === 0;
        if (clean) break;
        previousFailures = failures.map((c) => `${c.label}: ${c.output}`);
      }

      markFinding([...resolved], "fixed");
      setFindings((prev) =>
        prev.map((f) => (f.state === "fixing" ? { ...f, state: clean ? "fixed" : "needs-you" } : f)),
      );

      push({
        narration: clean
          ? `Done — ${changed.size} file${changed.size === 1 ? "" : "s"} patched and every compatibility gate passed. This project is ready to create.`
          : `Patched ${changed.size} file${changed.size === 1 ? "" : "s"}, but some gates still fail. Review below, re-run the agent, or proceed anyway.`,
        title: "summary",
        status: "done",
        completedAt: Date.now(),
      });

      const result: RepairOutcome = {
        clean,
        filesChanged: [...changed],
        filesDeleted: [...deleted],
        addedDependencies: addedDeps,
        resolvedFindings: [...resolved],
        verification,
        notes,
        scan: finalScan,
        readiness: finalReadiness,
      };
      setOutcome(result);
      onOutcome(result);
      setDone(true);
    } catch (err: any) {
      const message = err?.message || "Repair failed";
      setError(message);
      push({ title: "Repair agent failed", tool: "ai", status: "error", detail: message });
      onOutcome(null);
    } finally {
      setCaption(null);
      setRunning(false);
    }
  }, [appRoot, buildCommand, engine, entry, finish, markFinding, onOutcome, outputDir, push, readiness, scan]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void run();
  }, [run]);

  return (
    <div className="space-y-3">
      {findings.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {findings.map(({ finding, state }) => (
            <span
              key={finding.id}
              title={finding.message}
              className={`text-[10px] px-2 py-0.5 rounded-full border ${
                state === "fixed"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                  : state === "fixing"
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : state === "needs-you"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border text-muted-foreground"
              }`}
            >
              {finding.label} · {state}
            </span>
          ))}
        </div>
      )}

      <div className="rounded-md border border-border bg-background/50 p-3 max-h-[46vh] overflow-y-auto">
        <ChatTimeline steps={steps} caption={caption} />
        {steps.length === 0 && !caption && (
          <div className="text-[11px] text-muted-foreground">Waiting for the repair agent…</div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 flex items-start gap-2 text-[11px] text-destructive">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {done && outcome && (
        <div
          className={`rounded-md border p-2.5 flex items-start gap-2 text-[11px] ${
            outcome.clean
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600"
              : "border-amber-500/30 bg-amber-500/5 text-amber-600"
          }`}
        >
          {outcome.clean ? (
            <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          )}
          <div className="space-y-1">
            <div className="font-medium">
              {outcome.filesChanged.length} file(s) changed
              {outcome.filesDeleted.length ? `, ${outcome.filesDeleted.length} deleted` : ""}
              {outcome.addedDependencies.length ? `, ${outcome.addedDependencies.length} dependency added` : ""}
            </div>
            {!outcome.clean && (
              <ul className="list-disc pl-4 font-normal">
                {outcome.verification
                  .filter((c) => !c.passed)
                  .map((c) => (
                    <li key={c.id}>
                      {c.label}: {c.output.split("\n")[0]}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void run()} disabled={running} className="h-7 text-[11px] gap-1">
          {running ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
          {running ? "Working…" : "Run agent again"}
        </Button>
        {!running && !done && !error && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Sparkles size={11} /> Idle
          </span>
        )}
      </div>
    </div>
  );
};

export default AIRepairStep;

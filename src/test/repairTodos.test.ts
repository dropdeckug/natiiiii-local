import { describe, it, expect, beforeEach } from "vitest";
import { useBuildStore, type RepairTodo } from "@/stores/buildStore";

describe("Repair To-Dos 5-step contract", () => {
  beforeEach(() => {
    useBuildStore.setState({ repairAttempts: [] });
  });

  it("stores and tracks exactly 5 repair to-dos for an attempt", () => {
    const store = useBuildStore.getState();

    const sampleTodos: RepairTodo[] = [
      { id: "todo-1", stepNumber: 1, totalSteps: 5, title: "Step 1: Inspect logs", status: "completed" },
      { id: "todo-2", stepNumber: 2, totalSteps: 5, title: "Step 2: Trace root cause", status: "in_progress" },
      { id: "todo-3", stepNumber: 3, totalSteps: 5, title: "Step 3: Execute repair commands", status: "pending" },
      { id: "todo-4", stepNumber: 4, totalSteps: 5, title: "Step 4: Verify dependencies", status: "pending" },
      { id: "todo-5", stepNumber: 5, totalSteps: 5, title: "Step 5: Resume workflow pipeline", status: "pending" },
    ];

    expect(sampleTodos.length).toBe(5);

    store.addOrUpdateRepairAttempt({
      attempt: 1,
      maxAttempts: 3,
      status: "executing",
      diagnosisType: "DEPENDENCY_CONFLICT",
      todos: sampleTodos,
    });

    const attempt = useBuildStore.getState().repairAttempts.find((a) => a.attempt === 1);
    expect(attempt).toBeDefined();
    expect(attempt?.todos?.length).toBe(5);
    expect(attempt?.todos?.[0].status).toBe("completed");
    expect(attempt?.todos?.[1].status).toBe("in_progress");

    // Advance step 2 to completed and step 3 to in_progress
    store.updateRepairTodo(1, 2, { status: "completed" });
    store.updateRepairTodo(1, 3, { status: "in_progress" });

    const updated = useBuildStore.getState().repairAttempts.find((a) => a.attempt === 1);
    expect(updated?.todos?.[1].status).toBe("completed");
    expect(updated?.todos?.[2].status).toBe("in_progress");

    const completedCount = updated?.todos?.filter((t) => t.status === "completed").length;
    expect(completedCount).toBe(2);
  });
});

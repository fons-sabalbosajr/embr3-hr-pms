// src/context/LoadingContext.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Global loading context for long-running / heavy operations.
//
// Features:
//   • Named tasks with optional progress percentage
//   • Multiple concurrent tasks (overlay visible while ANY task is active)
//   • startLoading / stopLoading / updateProgress helpers
//   • withLoading – wraps an async fn and auto-manages start/stop
//   • NProgress integration for the top progress bar
// ─────────────────────────────────────────────────────────────────────────────
import React, { createContext, useState, useCallback, useRef } from "react";
import NProgress from "nprogress";

const LoadingContext = createContext(null);

/** Generate a short unique id for anonymous tasks */
let _seq = 0;
const uid = () => `__task_${++_seq}`;

export const LoadingProvider = ({ children }) => {
  // tasks: Map<taskId, { label: string, progress: number|null }>
  const [tasks, setTasks] = useState(new Map());
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  // ── helpers ───────────────────────────────────────────────────────────────

  /**
   * Start a loading task.
   * @param {string} [label]    Human-readable label (e.g. "Generating payslip…")
   * @param {string} [taskId]   Optional unique id – auto-generated if omitted
   * @returns {string}          The taskId (use to update progress / stop)
   */
  const startLoading = useCallback((label = "Loading…", taskId) => {
    const id = taskId || uid();
    setTasks((prev) => {
      const next = new Map(prev);
      next.set(id, { label, progress: null });
      return next;
    });
    // Only call NProgress.start when transitioning from 0 → 1 tasks
    if (tasksRef.current.size === 0) NProgress.start();
    return id;
  }, []);

  /**
   * Update the progress of an existing task (0 – 100).
   */
  const updateProgress = useCallback((taskId, progress, label) => {
    setTasks((prev) => {
      if (!prev.has(taskId)) return prev;
      const next = new Map(prev);
      const entry = { ...next.get(taskId), progress };
      if (label !== undefined) entry.label = label;
      next.set(taskId, entry);
      return next;
    });
    // Mirror to NProgress (normalise 0-100 → 0-1)
    if (typeof progress === "number") {
      NProgress.set(Math.min(progress / 100, 0.99));
    }
  }, []);

  /**
   * Stop / finish a loading task.
   */
  const stopLoading = useCallback((taskId) => {
    setTasks((prev) => {
      const next = new Map(prev);
      next.delete(taskId);
      if (next.size === 0) NProgress.done();
      return next;
    });
  }, []);

  /**
   * Convenience wrapper – runs an async function while showing a loading task.
   *
   * @param {Function} asyncFn    Receives { updateProgress } so callers can push progress
   * @param {string}   [label]    Overlay label
   * @returns {Promise<*>}        Resolves with the asyncFn return value
   *
   * Usage:
   *   const result = await withLoading(
   *     async ({ updateProgress }) => {
   *       updateProgress(30, "Crunching numbers…");
   *       const data = await api.post(...);
   *       updateProgress(80, "Rendering PDF…");
   *       await generatePdf(data);
   *     },
   *     "Generating payslip…"
   *   );
   */
  const withLoading = useCallback(
    async (asyncFn, label = "Processing…") => {
      const id = startLoading(label);
      try {
        return await asyncFn({
          updateProgress: (pct, lbl) => updateProgress(id, pct, lbl),
        });
      } finally {
        stopLoading(id);
      }
    },
    [startLoading, updateProgress, stopLoading],
  );

  // Derived state
  const isLoading = tasks.size > 0;
  // Pick the "primary" task (last added) for display
  const activeTask = isLoading
    ? Array.from(tasks.values()).pop()
    : null;

  return (
    <LoadingContext.Provider
      value={{
        isLoading,
        tasks,
        activeTask,
        startLoading,
        stopLoading,
        updateProgress,
        withLoading,
      }}
    >
      {children}
    </LoadingContext.Provider>
  );
};

export default LoadingContext;

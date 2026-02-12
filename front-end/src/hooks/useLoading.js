// src/hooks/useLoading.js
// ─────────────────────────────────────────────────────────────────────────────
// Convenience hook to access the global LoadingContext.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext } from "react";
import LoadingContext from "../context/LoadingContext";

/**
 * @returns {{
 *   isLoading: boolean,
 *   activeTask: { label: string, progress: number|null } | null,
 *   tasks: Map<string, { label: string, progress: number|null }>,
 *   startLoading: (label?: string, taskId?: string) => string,
 *   stopLoading: (taskId: string) => void,
 *   updateProgress: (taskId: string, progress: number, label?: string) => void,
 *   withLoading: (asyncFn: Function, label?: string) => Promise<*>,
 * }}
 */
export default function useLoading() {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    throw new Error("useLoading must be used within a <LoadingProvider>");
  }
  return ctx;
}

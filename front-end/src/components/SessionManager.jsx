import { useEffect, useRef, useCallback } from "react";
import { Modal } from "antd";
import useAuth from "../hooks/useAuth";
import { useTheme } from "../context/ThemeContext";

/**
 * SessionManager — monitors user activity and auto-logs out
 * after the configured sessionTimeout (in minutes) from security settings.
 * Shows a warning 60 seconds before logging out.
 */
const SessionManager = () => {
  const { isAuthenticated, logout, user } = useAuth();
  const { appSettings } = useTheme();
  const lastActivityRef = useRef(Date.now());
  const warningShownRef = useRef(false);
  const timerRef = useRef(null);
  const modalRef = useRef(null);

  // Don't enforce timeout on demo users
  const isDemo = user?.isDemo || user?.userType === "demo";

  const sessionTimeout = appSettings?.security?.sessionTimeout; // in minutes
  const timeoutMs = sessionTimeout && Number.isFinite(sessionTimeout) && sessionTimeout > 0
    ? sessionTimeout * 60 * 1000
    : null; // null = no timeout configured

  const WARNING_BEFORE_MS = 60 * 1000; // warn 60s before logout

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    // If warning was shown and user interacted, dismiss it
    if (warningShownRef.current) {
      warningShownRef.current = false;
      if (modalRef.current) {
        modalRef.current.destroy();
        modalRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !timeoutMs || isDemo) return;

    const events = ["mousedown", "keydown", "scroll", "touchstart", "click"];
    events.forEach((evt) => window.addEventListener(evt, resetActivity, { passive: true }));

    timerRef.current = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      const remaining = timeoutMs - idle;

      if (remaining <= 0) {
        // Time's up — log out
        clearInterval(timerRef.current);
        if (modalRef.current) {
          modalRef.current.destroy();
          modalRef.current = null;
        }
        warningShownRef.current = false;
        logout();
      } else if (remaining <= WARNING_BEFORE_MS && !warningShownRef.current) {
        // Show warning
        warningShownRef.current = true;
        modalRef.current = Modal.warning({
          title: "Session Expiring",
          content: `Your session will expire in about ${Math.ceil(remaining / 1000)} seconds due to inactivity. Move your mouse or press a key to stay logged in.`,
          okText: "Stay Logged In",
          onOk: () => {
            resetActivity();
          },
        });
      }
    }, 10_000); // check every 10 seconds

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, resetActivity));
      if (timerRef.current) clearInterval(timerRef.current);
      if (modalRef.current) {
        modalRef.current.destroy();
        modalRef.current = null;
      }
    };
  }, [isAuthenticated, timeoutMs, isDemo, logout, resetActivity]);

  return null; // purely logic, no UI
};

export default SessionManager;

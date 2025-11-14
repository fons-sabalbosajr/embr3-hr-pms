import { useMemo } from "react";
import dayjs from "dayjs";
import useAuth from "./useAuth";
import { useTheme } from "../context/ThemeContext";

const useDemoMode = () => {
  const { user } = useAuth();
  const { appSettings } = useTheme();
  const demo = appSettings?.demo || {};

  const state = useMemo(() => {
    const now = dayjs();
    const start = demo?.startDate ? dayjs(demo.startDate) : null;
    const end = demo?.endDate ? dayjs(demo.endDate) : null;
    const inRange =
      start && end
        ? now.isAfter(start) && now.isBefore(end.add(1, "second"))
        : true;
    const enabled = Boolean(demo?.enabled) && inRange;
    const isPrivileged = Boolean(
      user?.userType === 'developer' ||
      user?.isAdmin ||
      user?.canAccessDeveloper ||
      user?.canSeeDev ||
      user?.canManageUsers
    );
    return {
      isDemoEnabled: Boolean(demo?.enabled),
      isDemoActive: enabled,
      isDemoUser: Boolean(user?.isDemo),
      allowSubmissions: Boolean(demo?.allowSubmissions),
      maskSensitiveData: demo?.maskSensitiveData !== false,
      startDate: demo?.startDate || null,
      endDate: demo?.endDate || null,
      demoSettings: demo,
      isPrivileged,
    };
  }, [
    demo?.enabled,
    demo?.allowSubmissions,
    demo?.maskSensitiveData,
    demo?.startDate,
    demo?.endDate,
    user?.isDemo,
    user?.userType,
    user?.isAdmin,
    user?.canAccessDeveloper,
    user?.canSeeDev,
    user?.canManageUsers,
  ]);

  // Helper: should disable actions
  const readOnly =
    state.isDemoActive && state.isDemoUser && !state.allowSubmissions && !state.isPrivileged;

  // Helper: can a specific demo action key be performed?
  // New semantics: demo.allowedActions is a deny-list of disabled actions.
  // Returns false only if action is explicitly disabled and user is a demo user in active demo.
  const canDemoPerform = (actionKey) => {
    if (!state.isDemoActive || !state.isDemoUser) return true;
    if (state.isPrivileged || state.allowSubmissions) return true;
    const disabled = new Set(state.demoSettings?.allowedActions || []);
    return !disabled.has(actionKey);
  };

  // UI helper: should we hide a given action's button entirely in demo for demo users?
  // Hidden if demo is active, user is demo, not privileged, and key is in hiddenActions.
  const shouldHideInDemo = (actionKey) => {
    if (!state.isDemoActive || !state.isDemoUser) return false;
    if (state.isPrivileged) return false;
    const hidden = new Set(state.demoSettings?.hiddenActions || []);
    return hidden.has(actionKey);
  };

  return {
    ...state,
    readOnly,
    // Returns props to spread on AntD Buttons/Inputs for disabling in demo
    demoDisabledProps: (extra = {}) =>
      readOnly ? { disabled: true, ...extra } : extra,
    canDemoPerform,
    shouldHideInDemo,
  };
};

export default useDemoMode;

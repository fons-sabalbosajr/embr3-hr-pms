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
    return {
      isDemoEnabled: Boolean(demo?.enabled),
      isDemoActive: enabled,
      isDemoUser: Boolean(user?.isDemo),
      allowSubmissions: Boolean(demo?.allowSubmissions),
      maskSensitiveData: demo?.maskSensitiveData !== false,
      startDate: demo?.startDate || null,
      endDate: demo?.endDate || null,
      demoSettings: demo,
    };
  }, [
    demo?.enabled,
    demo?.allowSubmissions,
    demo?.maskSensitiveData,
    demo?.startDate,
    demo?.endDate,
    user?.isDemo,
  ]);

  // Helper: should disable actions
  const readOnly =
    state.isDemoActive && state.isDemoUser && !state.allowSubmissions;

  return {
    ...state,
    readOnly,
    // Returns props to spread on AntD Buttons/Inputs for disabling in demo
    demoDisabledProps: (extra = {}) =>
      readOnly ? { disabled: true, ...extra } : extra,
  };
};

export default useDemoMode;

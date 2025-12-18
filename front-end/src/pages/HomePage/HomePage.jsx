import {
  Layout,
  Menu,
  Badge,
  Tooltip,
  Typography,
  Popover,
  Divider,
  Button,
  message,
  Modal,
  Descriptions,
  Tag,
  Table,
  Alert,
  Skeleton,
} from "antd";

import {
  UserOutlined,
  BellOutlined,
  MessageOutlined,
  DashboardOutlined,
  SettingOutlined,
  TeamOutlined,
  LogoutOutlined,
  BulbOutlined,
  EyeOutlined,
  FieldTimeOutlined,
  BugOutlined,
} from "@ant-design/icons";

import { useNavigate, Routes, Route } from "react-router-dom";
import { useEffect, useState, useRef, useCallback, useContext } from "react";
import useDemoMode from "../../hooks/useDemoMode";
import useAuth from "../../hooks/useAuth";
import { secureStore, secureGet } from "../../../utils/secureStorage";
import emblogo from "../../assets/emblogo.svg";
import axiosInstance from "../../api/axiosInstance";

import Dashboard from "../../components/Dashboard/Dashboard";
import GenInfo from "../../components/Employees/GeneralInfo/GenInfo";
import BenefitsInfo from "../../components/Employees/SalaryInfo/SalaryInfo";
import Trainings from "../../components/Employees/Trainings/Trainings";
import AccountSettings from "../../components/Settings/AccountSettings/AccountsSettings";
import Backup from "../../components/Settings/Backup/Backup";
import UserAccess from "../../components/Settings/UserAccess/UserAccess";
import DeductionSettings from "../../components/Settings/DeductionSettings";
import ImportDTRModal from "../../components/DTR/ImportDTRModal";
import DTRLogs from "../DTR/DTRLogs/DTRLogs";
import DTRProcess from "../DTR/components/DTRProcess/DTRProcess";
import DTRReports from "../DTR/DTRReports/DTRReports";
import Holidays from "../Holidays/Holidays";
import RecordConfigSettings from "../../components/Settings/RecordConfigSettings/RecordConfigSettings";
import DeveloperSettings from "../../components/Settings/DevSettings/DevSettings";
import ProtectedRoute from "../../components/ProtectedRoute";
import ProfileModal from "./components/ProfileModal";
import FeatureModal from "./components/FeatureModal";
import { NotificationsContext } from "../../context/NotificationsContext";
import socket from "../../../utils/socket";
import dayjs from "dayjs";
import UserAvatar from "../../components/common/UserAvatar";

import "./hompage.css";
import { FloatButton, Form, Input, Upload } from "antd";

const { Text } = Typography;
const { Header, Content, Sider, Footer } = Layout;

const HomePage = () => {
  const navigate = useNavigate();
  const { hasAccess } = useAuth();
  const { user, logout, hasPermission } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState(false);
  const { notifications, setNotifications, messages, setMessages } =
    useContext(NotificationsContext);
  const [devNotifications, setDevNotifications] = useState([]);
  const [devNotificationsLoading, setDevNotificationsLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [employeeError, setEmployeeError] = useState(null);
  // DTR request inline preview state
  const [dtrPreviewLoading, setDtrPreviewLoading] = useState(false);
  const [dtrPreviewRows, setDtrPreviewRows] = useState([]);
  const [dtrPreviewError, setDtrPreviewError] = useState(null);
  // Bug report modal state
  const [isBugOpen, setIsBugOpen] = useState(false);
  const [bugSubmitting, setBugSubmitting] = useState(false);
  const [bugScreenshot, setBugScreenshot] = useState(null);
  const [bugForm] = Form.useForm();
  
  const beforeUploadScreenshot = (file) => {
    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      message.error("Please upload an image file.");
      return Upload.LIST_IGNORE;
    }
    if (file.size > 5 * 1024 * 1024) {
      message.error("Image must be smaller than 5MB.");
      return Upload.LIST_IGNORE;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setBugScreenshot(reader.result);
    };
    reader.readAsDataURL(file);
    return false; // prevent auto upload
  };
  const submitBugReport = async () => {
    try {
      const values = await bugForm.validateFields();
      setBugSubmitting(true);
      const payload = {
        title: values.title,
        description: values.description,
        pageUrl: window.location.href,
        userAgent: navigator.userAgent,
        email: user?.email,
        name: user?.name,
        employeeId: user?.employeeId || user?.id,
        screenshotBase64: bugScreenshot,
      };
      await axiosInstance.post("/bug-report", payload);
      message.success("Bug report sent. Thank you!");
      bugForm.resetFields();
      setBugScreenshot(null);
      setIsBugOpen(false);
    } catch (err) {
      // Ignore validation errors (they have errorFields)
      if (err?.errorFields) return;
      message.error(
        err?.response?.data?.message || "Failed to send bug report."
      );
      console.debug("Bug report failed", err);
    } finally {
      setBugSubmitting(false);
    }
  };
  const handleOpenDevSettings = () => {
    navigate("/settings/developer-settings");
  };
  const handleOpenBugReports = () => {
    navigate("/settings/developer-settings?tab=bug-reports");
  };
  
  // Demo mode state
  const { isDemoActive, isDemoUser, demoSettings } = useDemoMode();
  // Close bug modal if demo mode is turned off
  useEffect(() => {
    if (!isDemoActive) setIsBugOpen(false);
  }, [isDemoActive]);

  // Ant Design breakpoint collapse now manages responsive state; remove manual resize listener.

  useEffect(() => {
    // 1. Instant preload from secure storage (if any)
    try {
      const cached = secureGet("notifications");
      if (
        Array.isArray(cached) &&
        cached.length &&
        notifications.length === 0
      ) {
        // Show cached immediately (optimistic). We'll merge fresh data below.
        setNotifications(cached.map((n) => ({ ...n, cached: true })));
      }
    } catch (_) {
      /* ignore */
    }
    try {
      secureStore("notifications", notifications);
    } catch (_) {
      // non-fatal
    }
  }, [notifications]);

  useEffect(() => {
    // messages are reserved for future chat feature and intentionally not persisted
  }, [messages]);

  // Socket.io: listen for new notifications and normalize payloads
  useEffect(() => {
    const handler = (payload) => {
      try {
        if (!payload) return;
        const d = payload.data || payload;
        const type = payload.type || d.type;
        let normalized = null;
        if (type === "PayslipRequest" || d.period) {
          normalized = {
            type: "PayslipRequest",
            id: d._id || d.id || Date.now(),
            _id: d._id || d.id,
            employeeId: d.employeeId,
            createdAt: d.createdAt || new Date().toISOString(),
            read: !!d.read,
            hidden: !!d.hidden,
            period: d.period,
            title: `Payslip Request - ${d.employeeId}`,
          };
        } else if (type === "DTRRequest" || (d.startDate && d.endDate)) {
          normalized = {
            type: "DTRRequest",
            id: d._id || d.id || Date.now(),
            _id: d._id || d.id,
            employeeId: d.employeeId,
            createdAt: d.createdAt || new Date().toISOString(),
            read: !!d.read,
            hidden: !!d.hidden,
            startDate: d.startDate,
            endDate: d.endDate,
            title: d.title || `DTR Request - ${d.employeeId}`,
            body: d.body,
          };
        }
        if (normalized) {
          setNotifications((prev) => [normalized, ...prev]);
        }
      } catch (_) {
        // ignore malformed payload
      }
    };
    socket.on("newNotification", handler);
    return () => {
      socket.off("newNotification", handler);
    };
  }, [setNotifications]);

  // Load developer notifications if user is developer/admin and listen for DevSettings updates
  useEffect(() => {
    let mounted = true;
    const fetchDev = async () => {
      if (
        !(
          hasPermission(["canAccessDeveloper"]) ||
          (user && user.userType === "developer")
        )
      ) {
        // Not permitted: ensure loading is not stuck
        setDevNotificationsLoading(false);
        return;
      }
      try {
        setDevNotificationsLoading(true);
        const { data } = await axiosInstance.get("/dev/notifications");
        if (!mounted) return;
        const items = (data?.data || []).map((n) => ({
          ...n,
          id: n._id || Date.now(),
        }));
        setDevNotifications(items);
      } catch (err) {
        // ignore dev notification load errors
        console.debug("Failed to load dev notifications", err);
      } finally {
        if (mounted) setDevNotificationsLoading(false);
      }
    };

    fetchDev();

    const handler = (e) => {
      if (!e || !e.detail) return;
      const payload = (e.detail || []).map((n) => ({
        ...n,
        id: n._id || Date.now(),
      }));
      setDevNotifications(payload);
    };
    window.addEventListener("devNotificationsUpdated", handler);

    return () => {
      mounted = false;
      window.removeEventListener("devNotificationsUpdated", handler);
    };
  }, [hasPermission]);

  // Load initial notifications quickly (cached) then refresh from backend
  useEffect(() => {
    // 1. Instant preload from secure storage (if any)
    try {
      const cached = secureGet("notifications");
      if (
        Array.isArray(cached) &&
        cached.length &&
        notifications.length === 0
      ) {
        // Show cached immediately (optimistic). We'll merge fresh data below.
        setNotifications(cached.map((n) => ({ ...n, cached: true })));
      }
    } catch (_) {
      /* ignore */
    }

    let aborted = false;
    const controller = new AbortController();
    const signal = controller.signal;

    const fetchData = async () => {
      // In demo mode, avoid slow/blocked network calls: show cached immediately and skip fetch
      if (isDemoActive && isDemoUser) {
        setNotificationsLoading(false);
        return;
      }
      setNotificationsLoading(true); // Set loading BEFORE network requests
      // Use Promise.allSettled so one slow endpoint doesn't block the other
      const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
      const relPayslip = axiosInstance
        .get("/payslip-requests", { signal })
        .catch((e) => ({ error: e }));
      const relDtr = axiosInstance
        .get("/dtr-requests", { signal })
        .catch((e) => ({ error: e }));
      const results = await Promise.allSettled([relPayslip, relDtr]);
      let payslipRes =
        results[0].status === "fulfilled" ? results[0].value : null;
      let dtrReqRes =
        results[1].status === "fulfilled" ? results[1].value : null;

      // Fallback if both failed and VITE_API_URL exists
      if (!payslipRes && !dtrReqRes && base) {
        const absPayslip = axiosInstance
          .get(`${base}/payslip-requests`, { signal })
          .catch((e) => ({ error: e }));
        const absDtr = axiosInstance
          .get(`${base}/dtr-requests`, { signal })
          .catch((e) => ({ error: e }));
        const absResults = await Promise.allSettled([absPayslip, absDtr]);
        payslipRes =
          absResults[0].status === "fulfilled" ? absResults[0].value : null;
        dtrReqRes =
          absResults[1].status === "fulfilled" ? absResults[1].value : null;
      }

      if (aborted) return;
      try {
        const payslipRaw = payslipRes?.data?.data || payslipRes?.data || [];
        const dtrRaw = dtrReqRes?.data?.data || dtrReqRes?.data || [];
        const payslip = payslipRaw.map((d) => ({
          type: "PayslipRequest",
          id: d._id || d.id || `${Date.now()}_${Math.random()}`,
          _id: d._id,
          employeeId: d.employeeId,
          createdAt: d.createdAt,
          read: !!d.read,
          hidden: !!d.hidden,
          period: d.period,
          title: `Payslip Request - ${d.employeeId}`,
        }));
        const dtr = dtrRaw.map((d) => ({
          type: "DTRRequest",
          id: d._id || d.id || `${Date.now()}_${Math.random()}`,
          _id: d._id || d.id,
          employeeId: d.employeeId,
          createdAt: d.createdAt,
          read: !!d.read,
          hidden: !!d.hidden,
          startDate: d.startDate,
          endDate: d.endDate,
          title: `DTR Request - ${d.employeeId}`,
          body: `${
            d.startDate ? new Date(d.startDate).toLocaleDateString() : ""
          } - ${d.endDate ? new Date(d.endDate).toLocaleDateString() : ""}`,
        }));

        // Merge with any cached notifications avoiding duplicates by _id
        setNotifications((prev) => {
          const seen = new Set();
          const combined = [...payslip, ...dtr, ...prev];
          const deduped = [];
          for (const n of combined) {
            const key = n._id || n.id;
            if (!seen.has(key)) {
              seen.add(key);
              deduped.push({ ...n, cached: false });
            }
          }
          return deduped;
        });
      } catch (e) {
        console.error("Failed to process notifications", e);
      } finally {
        if (!aborted) setNotificationsLoading(false);
      }
    };
    fetchData();
    return () => {
      aborted = true;
      controller.abort();
    };
  }, [user?.id, isDemoActive, isDemoUser]);

  // Socket.io connection is managed by AuthContext; listeners are attached above.

  const handleLogout = () => {
    message.success("Logging out...");
    // AuthContext.logout will handle redirect to /auth
    logout();
  };

  const IDLE_TIMEOUT = 10 * 60 * 1000;
  const idleTimer = useRef(null);

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(handleLogout, IDLE_TIMEOUT);
  }, [handleLogout]);

  useEffect(() => {
    window.addEventListener("mousemove", resetIdleTimer);
    window.addEventListener("keydown", resetIdleTimer);
    return () => {
      clearTimeout(idleTimer.current);
      window.removeEventListener("mousemove", resetIdleTimer);
      window.removeEventListener("keydown", resetIdleTimer);
    };
  }, [resetIdleTimer]);

  const handleViewProfile = () => setIsProfileModalOpen(true);
  const handleSuggestFeature = () => setIsFeatureModalOpen(true);

  const getMenuItems = () => {
    const { isDemoActive, isDemoUser, demoSettings } = useDemoMode();
    const demoAllowed =
      demoSettings && Array.isArray(demoSettings.allowedPermissions)
        ? demoSettings.allowedPermissions
        : null;
    const allItems = [
      {
        key: "/",
        icon: <DashboardOutlined />,
        label: "Overview",
        permissions: ["canViewDashboard"],
      },
      {
        key: "employees",
        icon: <TeamOutlined />,
        label: "Personnel",
        permissions: ["canViewEmployees"],
        children: [
          {
            key: "/employeeinfo",
            label: "Employee Profile",
            permissions: ["canViewEmployees"],
          },
          {
            key: "/trainings",
            label: "Training Records",
            permissions: ["canViewTrainings"],
          },
          {
            key: "/benefitsinfo",
            label: "Compensation",
            permissions: ["canViewPayroll"],
          },
        ],
      },
      {
        key: "dtr",
        icon: <FieldTimeOutlined />,
        label: "Timekeeping",
        permissions: ["canViewDTR"],
        children: [
          {
            key: "/dtr/logs",
            label: "Biometric Logs",
            permissions: ["canViewDTR"],
          },
          {
            key: "/dtr/process",
            label: "Generate DTR",
            permissions: ["canProcessDTR"],
          },
          {
            key: "/dtr/reports",
            label: "DTR Reports",
            permissions: ["canViewDTR"],
          },
          {
            key: "/dtr/holidays",
            label: "Holidays & Suspensions",
            permissions: ["canViewDTR"],
          },
        ],
      },
      {
        key: "settings",
        icon: <SettingOutlined />,
        label: "Administration",
        permissions: ["canAccessSettings"],
        children: [
          {
            key: "/settings/account",
            label: "Account Preferences",
            permissions: ["canAccessSettings"],
          },
          {
            key: "/settings/deductions",
            label: "Deductions",
            permissions: ["canChangeDeductions"],
          },
          {
            key: "/settings/access",
            label: "User Access",
            permissions: ["canManageUsers"],
          },
          // {
          //   key: "/settings/record-config",
          //   label: "Record Configuration Settings",
          //   permissions: ["canAccessConfigSettings"],
          // },
          {
            key: "/settings/backup",
            label: "Backup",
            permissions: ["canPerformBackup"],
          },
          {
            key: "/settings/developer-settings",
            label: "Developer Settings",
            className: "developer-menu-item", // 👈 custom class
            permissions: ["canAccessDeveloper"],
          },
        ],
      },
    ];

    const filterItems = (items) =>
      items.reduce((acc, item) => {
        const permitted = hasPermission(item.permissions);
        // In demo mode for the demo user, restrict to allowedPermissions when configured; otherwise don't hide menus.
        const demoFilterActive = isDemoActive && isDemoUser;
        const demoPermitted =
          !demoFilterActive ||
          (Array.isArray(demoAllowed) && demoAllowed.length > 0
            ? (item.permissions || []).some((p) => demoAllowed.includes(p))
            : true);
        if (permitted && demoPermitted) {
          if (item.children) {
            const filteredChildren = filterItems(item.children);
            if (filteredChildren.length)
              acc.push({ ...item, children: filteredChildren });
          } else {
            acc.push(item);
          }
        }
        return acc;
      }, []);
    return filterItems(allItems);
  };

  // ---- Notifications Popover ----
  const openNotificationModal = async (n) => {
    // Mark read (optimistic) and open modal
    try {
      if (!n.read) {
        // Route to correct endpoint depending on request type
        if (n.type === "PayslipRequest" || n.period) {
          await axiosInstance.put(`/payslip-requests/${n.id}/read`);
        } else if (n.type === "DTRRequest" || (n.startDate && n.endDate)) {
          await axiosInstance.put(`/dtr-requests/${n.id}/read`);
        }
        setNotifications((prev) =>
          prev.map((notif) =>
            notif.id === n.id ? { ...notif, read: true } : notif
          )
        );
      }
    } catch (error) {
      // Non-fatal; still show modal
      message.error("Failed to update notification status");
    }
    setSelectedNotification(n);
    setIsNotificationModalOpen(true);

    // Fetch employee details if employeeId present
    if (n.employeeId) {
      setEmployeeLoading(true);
      setEmployeeError(null);
      setEmployeeDetails(null);
      try {
        // Build candidate IDs: original and digits-only without leading zeros
        const rawId = String(n.employeeId || "");
        const digitsOnly = (rawId.match(/\d+/g) || []).join("");
        const noLeadingZeros = digitsOnly.replace(/^0+/, "");
        const candidates = Array.from(
          new Set(
            [
              rawId,
              noLeadingZeros && noLeadingZeros !== rawId
                ? noLeadingZeros
                : null,
            ].filter(Boolean)
          )
        );

        // Helper to try fetch against a base prefix ("" for relative, or absolute base)
        const tryFetch = async (basePrefix, id) => {
          const path = `${basePrefix}/employees/by-emp-id/${encodeURIComponent(
            id
          )}`.replace(/([^:]\/)\/+/g, "$1/");
          return axiosInstance.get(path);
        };

        const bases = [""];
        const absBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
        if (absBase) bases.push(absBase);

        let found = null;
        for (const id of candidates) {
          for (const base of bases) {
            try {
              const resp = await tryFetch(base, id);
              if (resp?.data?.success) {
                found = resp.data.data;
                break;
              }
            } catch (_) {
              // try next
            }
          }
          if (found) break;
        }

        if (found) {
          setEmployeeDetails(found);
        } else {
          setEmployeeError("Employee not found");
        }
      } catch (err) {
        setEmployeeError("Failed to load employee details");
      } finally {
        setEmployeeLoading(false);
      }
    } else {
      setEmployeeDetails(null);
    }
  };

  // Load inline time log preview for DTR or Payslip notifications (payslip uses whole month)
  useEffect(() => {
    const n = selectedNotification;
    const isOpen = isNotificationModalOpen && n && n.employeeId;
    if (!isOpen) {
      setDtrPreviewRows([]);
      setDtrPreviewError(null);
      setDtrPreviewLoading(false);
      return;
    }
    // Determine range: DTRRequest uses explicit start/end; PayslipRequest uses period month (YYYY-MM)
    let rangeStart = null;
    let rangeEnd = null;
    if (n.type === 'DTRRequest' && n.startDate && n.endDate) {
      rangeStart = dayjs(n.startDate).startOf('day');
      rangeEnd = dayjs(n.endDate).startOf('day');
    } else if ((n.type === 'PayslipRequest' || n.period) && n.period) {
      // Expect n.period like YYYY-MM; fallback skip if malformed
      const parsed = dayjs(n.period + '-01');
      if (parsed.isValid()) {
        rangeStart = parsed.startOf('month');
        rangeEnd = parsed.endOf('month');
      }
    }
    if (!rangeStart || !rangeEnd) {
      setDtrPreviewRows([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        setDtrPreviewLoading(true);
        setDtrPreviewError(null);
        setDtrPreviewRows([]);
        const { data } = await axiosInstance.get('/dtrlogs/merged', {
          params: {
            startDate: rangeStart.format('YYYY-MM-DD'),
            endDate: rangeEnd.format('YYYY-MM-DD'),
            empIds: n.employeeId,
          },
        });
        if (cancelled) return;
        const logs = data?.data || [];
        const byDate = logs.reduce((acc, log) => {
          const dateKey = dayjs(log.time).format('YYYY-MM-DD');
          if (!acc[dateKey]) acc[dateKey] = [];
          acc[dateKey].push(log);
          return acc;
        }, {});
        const totalDays = rangeEnd.diff(rangeStart, 'day') + 1;
        const rows = Array.from({ length: totalDays }).map((_, idx) => {
          const date = rangeStart.add(idx, 'day');
          const key = date.format('YYYY-MM-DD');
          const list = (byDate[key] || []).map(l => ({ time: dayjs(l.time), state: l.state }));
          const timeInCandidates = list.filter(l => l.state === 'C/In' && l.time.hour() < 12).sort((a,b)=>a.time-b.time);
          const timeOutCandidates = list.filter(l => l.state === 'C/Out' && l.time.hour() >= 12).sort((a,b)=>a.time-b.time);
          const breakOutCandidates = list.filter(l => l.state === 'Out' && l.time.hour() >= 12 && l.time.hour() < 13).sort((a,b)=>a.time-b.time);
          const breakInCandidates = list.filter(l => l.state === 'Out Back' && l.time.hour() >= 12 && l.time.hour() < 14).sort((a,b)=>a.time-b.time);
          let timeIn = timeInCandidates[0]?.time.format('h:mm') || '';
          let timeOut = timeOutCandidates.length ? timeOutCandidates[timeOutCandidates.length-1].time.format('h:mm') : '';
            let breakOut = breakOutCandidates[0]?.time.format('h:mm') || '';
          let breakIn = breakInCandidates[0]?.time.format('h:mm') || '';
          if (timeIn && timeOut && !breakOut && !breakIn) { breakOut = '12:00'; breakIn = '1:00'; }
          return { key, date: date.format('MM/DD/YYYY'), timeIn: timeIn || '---', breakOut: breakOut || '---', breakIn: breakIn || '---', timeOut: timeOut || '---' };
        });
        setDtrPreviewRows(rows);
      } catch (err) {
        if (!cancelled) setDtrPreviewError(err?.response?.data?.message || err.message || 'Failed to load time logs');
      } finally {
        if (!cancelled) setDtrPreviewLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [isNotificationModalOpen, selectedNotification]);

  // ---- Messages Modal Logic ----
  const openMessageModal = async (m) => {
    // Messages feature reserved; do not mark as read on the server yet.
    setSelectedMessage(m);
    setIsMessageModalOpen(true);

    // Fetch employee details if employeeId present
    if (m.employeeId) {
      setEmployeeLoading(true);
      setEmployeeError(null);
      setEmployeeDetails(null);
      try {
        const { data } = await axiosInstance.get(
          `/employees/by-emp-id/${encodeURIComponent(m.employeeId)}`
        );
        if (data?.success) {
          setEmployeeDetails(data.data);
        } else {
          setEmployeeError(data?.message || "Employee not found");
        }
      } catch (err) {
        setEmployeeError("Failed to load employee details");
      } finally {
        setEmployeeLoading(false);
      }
    } else {
      setEmployeeDetails(null);
    }
  };

  const notificationContent = hasAccess("canViewNotifications") && (
    <div style={{ maxHeight: 350, overflowY: "auto", width: 320 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "4px 8px",
        }}
      >
        <Text strong>Notifications</Text>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {hasAccess("canManageNotifications") && (
            <Button
              type="link"
              size="small"
              onClick={async () => {
                try {
                  await Promise.all([
                    axiosInstance.put("/payslip-requests/read-all"),
                    axiosInstance.put("/dtr-requests/read-all"),
                  ]);
                  setNotifications((prev) =>
                    prev.map((n) => ({ ...n, read: true }))
                  );
                } catch (error) {
                  message.error("Failed to mark all notifications as read");
                }
              }}
            >
              Mark all as read
            </Button>
          )}

          {/* Developer notifications are shown but hidden items are excluded */}
        </div>
      </div>
      {/** Merge regular notifications and (optionally) dev notifications. Dev notifications have `hidden` flag. */}
      {notificationsLoading || devNotificationsLoading ? (
        <div style={{ padding: 12 }}>
          <Skeleton active paragraph={{ rows: 3 }} />
        </div>
      ) : (
        (() => {
          // Always exclude hidden dev notifications from the bell popover
          const visibleDev = devNotifications.filter((d) => !d.hidden);
          // Respect dataVisible flag: if a dev notification has dataVisible === false
          // replace its body/title with a placeholder when merging for the bell popover
          const normalizedDev = visibleDev.map((d) => ({
            ...d,
            title: d.dataVisible === false ? "[hidden]" : d.title,
            body: d.dataVisible === false ? "[hidden]" : d.body,
          }));
          // Exclude hidden regular notifications as well
          let merged = [
            ...normalizedDev,
            ...notifications.filter((n) => !n.hidden),
          ];

          if (merged.length === 0) {
            return (
              <Text
                type="secondary"
                style={{ padding: "8px 12px", display: "block" }}
              >
                No new notifications
              </Text>
            );
          }

          // Sort: unread first, then by createdAt descending (newest first)
          merged = merged.sort((a, b) => {
            if ((a.read ? 1 : 0) !== (b.read ? 1 : 0)) {
              return (a.read ? 1 : 0) - (b.read ? 1 : 0);
            }
            const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tb - ta;
          });

          return merged.map((n) => (
            <div
              key={n.id}
              style={{
                padding: "8px 12px",
                borderBottom: "1px solid #f0f0f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                opacity: n.read ? 0.6 : 1,
              }}
            >
              <div>
                <Text strong>
                  {n.title ||
                    `Notification${n.employeeId ? " - " + n.employeeId : ""}`}
                </Text>
                <br />
                <Text type="secondary" style={{ fontSize: "12px" }}>
                  {n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}
                </Text>
              </div>
              {!(isDemoActive && isDemoUser) && (
                <Button
                  size="small"
                  type="link"
                  onClick={(e) => {
                    e.stopPropagation();
                    openNotificationModal(n);
                  }}
                >
                  View
                </Button>
              )}
            </div>
          ));
        })()
      )}
    </div>
  );

  const notificationModal = (
    <Modal
      open={isNotificationModalOpen}
      title={
        selectedNotification
          ? `${
              selectedNotification.type === "DTRRequest"
                ? "DTR Request"
                : "Payslip Request"
            } - ${selectedNotification.employeeId}`
          : "Notification"
      }
      onCancel={() => setIsNotificationModalOpen(false)}
      className="dtr-admin-modal"
      footer={[
        <Button key="close" onClick={() => setIsNotificationModalOpen(false)}>
          Close
        </Button>,
        // If this is a payslip request, provide a quick "Send Payslip" action when HR already has a generated PDF
        selectedNotification &&
          (selectedNotification.type === "PayslipRequest" ||
            selectedNotification.period) && (
            <Button
              key="sendPayout"
              onClick={async () => {
                try {
                  // Ask for a pre-generated base64 PDF data URI
                  const pdfBase64 = window.__LAST_GENERATED_PAYSLIP_BASE64__;
                  if (!pdfBase64) {
                    Modal.info({
                      title: "Attach Payslip PDF",
                      content:
                        'Please generate or open the payslip first so it can be attached. After generating, click "Send Payslip" again.',
                    });
                    return;
                  }
                  const n = selectedNotification;
                  const confirm = await new Promise((resolve) => {
                    Modal.confirm({
                      title: "Send payslip to employee? ",
                      content: `Employee ${n.employeeId} • Period ${
                        n.period || ""
                      }`,
                      onOk: () => resolve(true),
                      onCancel: () => resolve(false),
                    });
                  });
                  if (!confirm) return;
                  // Call backend to send email
                  await axiosInstance.post(
                    `/payslip-requests/${encodeURIComponent(
                      n._id || n.id
                    )}/send-email`,
                    {
                      pdfBase64,
                      filename: `payslip_${n.employeeId}_${(
                        n.period || ""
                      ).replace(/\//g, "-")}.pdf`,
                    }
                  );
                  message.success("Payslip emailed successfully");
                } catch (err) {
                  message.error(
                    err?.response?.data?.message ||
                      "Failed to send payslip email"
                  );
                }
              }}
            >
              Send Payslip
            </Button>
          ),
        selectedNotification && (
          <Button
            key="process"
            type="primary"
            onClick={() => {
              // Determine target route
              const notif = selectedNotification;
              let target = null;
              // Simple heuristic: payslip requests go to benefits/payroll page, others maybe DTR
              if (
                notif.period ||
                notif.reason === "payslip" ||
                /payslip/i.test(notif.type || "")
              ) {
                const empQ = notif.employeeId
                  ? `&empId=${encodeURIComponent(notif.employeeId)}`
                  : "";
                target = `/dtr/reports?payslip=1${empQ}`;
              } else if (/dtr/i.test(notif.type || "") || notif.dtrId) {
                target = "/dtr/process";
              }
              if (!target) {
                // default fallback
                target = "/dtr/reports";
              }
              setIsNotificationModalOpen(false);
              navigate(target);
            }}
          >
            Process Request
          </Button>
        ),
      ]}
    >
      {selectedNotification && (
        <>
          <Descriptions
            size="small"
            column={1}
            bordered
            styles={{
              label: { width: 130 },
              content: { background: "transparent" },
            }}
          >
            {selectedNotification.employeeName && (
              <Descriptions.Item label="Employee">
                {selectedNotification.employeeName} (
                {selectedNotification.employeeId})
              </Descriptions.Item>
            )}
            {!selectedNotification.employeeName &&
              selectedNotification.employeeId && (
                <Descriptions.Item label="Employee">
                  {selectedNotification.employeeId}
                </Descriptions.Item>
              )}
            {employeeLoading && (
              <Descriptions.Item label="Employee Details">
                Loading...
              </Descriptions.Item>
            )}
            {employeeError && (
              <Descriptions.Item label="Employee Details">
                <span style={{ color: "red" }}>{employeeError}</span>
              </Descriptions.Item>
            )}
            {employeeDetails && (
              <>
                <Descriptions.Item label="Full Name">
                  {employeeDetails.fullName ||
                    employeeDetails.name ||
                    `${employeeDetails.firstName || ""} ${
                      employeeDetails.lastName || ""
                    }`.trim()}
                </Descriptions.Item>
                {employeeDetails.position && (
                  <Descriptions.Item label="Position">
                    {employeeDetails.position}
                  </Descriptions.Item>
                )}
                {employeeDetails.division && (
                  <Descriptions.Item label="Division">
                    {employeeDetails.division}
                  </Descriptions.Item>
                )}
                {(employeeDetails.sectionOrUnit ||
                  employeeDetails.section ||
                  employeeDetails.unit) && (
                  <Descriptions.Item label="Section / Unit">
                    {employeeDetails.sectionOrUnit ||
                      employeeDetails.section ||
                      employeeDetails.unit}
                  </Descriptions.Item>
                )}
                {employeeDetails.employmentStatus && (
                  <Descriptions.Item label="Employment Status">
                    {employeeDetails.employmentStatus}
                  </Descriptions.Item>
                )}
                {employeeDetails.empType &&
                  !employeeDetails.employmentStatus && (
                    <Descriptions.Item label="Employment Type">
                      {employeeDetails.empType}
                    </Descriptions.Item>
                  )}
              </>
            )}
            {selectedNotification.reason && (
              <Descriptions.Item label="Reason">
                {selectedNotification.dataVisible === false
                  ? "[hidden]"
                  : selectedNotification.reason}
              </Descriptions.Item>
            )}
            {selectedNotification.type === "DTRRequest" && (
              <>
                {selectedNotification.startDate && (
                  <Descriptions.Item label="Start Date">
                    {new Date(
                      selectedNotification.startDate
                    ).toLocaleDateString()}
                  </Descriptions.Item>
                )}
                {selectedNotification.endDate && (
                  <Descriptions.Item label="End Date">
                    {new Date(
                      selectedNotification.endDate
                    ).toLocaleDateString()}
                  </Descriptions.Item>
                )}
              </>
            )}
            {selectedNotification.period && (
              <Descriptions.Item label="Period">
                {selectedNotification.period}
              </Descriptions.Item>
            )}
            {selectedNotification.createdAt && (
              <Descriptions.Item label="Requested At">
                {new Date(selectedNotification.createdAt).toLocaleString()}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Status">
              <Tag color={selectedNotification.read ? "green" : "blue"}>
                {selectedNotification.read ? "Read" : "Unread"}
              </Tag>
            </Descriptions.Item>
            {selectedNotification.notes && (
              <Descriptions.Item label="Notes">
                {selectedNotification.dataVisible === false
                  ? "[hidden]"
                  : selectedNotification.notes}
              </Descriptions.Item>
            )}
            {selectedNotification._id && (
              <Descriptions.Item label="Internal ID">
                {selectedNotification._id}
              </Descriptions.Item>
            )}
          </Descriptions>
          {/* Show grid only when we have a known range (DTR or Payslip request) */}
          {!dtrPreviewLoading &&
            !dtrPreviewError &&
            (selectedNotification?.type === 'DTRRequest' || selectedNotification?.type === 'PayslipRequest' || selectedNotification?.period) &&
            dtrPreviewRows.length > 0 && (
              <Table
                size="small"
                className="dtr-table-compact compact-table"
                dataSource={dtrPreviewRows}
                pagination={false}
                rowKey={(r) => r.key}
                bordered
                columns={[
                  {
                    title: "Date",
                    dataIndex: "date",
                    key: "date",
                    width: 120,
                    onCell: () => ({ className: "date-cell" }),
                  },
                  {
                    title: "Time In",
                    dataIndex: "timeIn",
                    key: "timeIn",
                    width: 100,
                    onCell: () => ({ className: "time-cell" }),
                  },
                  {
                    title: "Break Out",
                    dataIndex: "breakOut",
                    key: "breakOut",
                    width: 100,
                    onCell: () => ({ className: "time-cell" }),
                  },
                  {
                    title: "Break In",
                    dataIndex: "breakIn",
                    key: "breakIn",
                    width: 100,
                    onCell: () => ({ className: "time-cell" }),
                  },
                  {
                    title: "Time Out",
                    dataIndex: "timeOut",
                    key: "timeOut",
                    width: 100,
                    onCell: () => ({ className: "time-cell" }),
                  },
                ]}
              />
            )}
          {!dtrPreviewLoading &&
            !dtrPreviewError &&
            (selectedNotification?.type === 'DTRRequest' || selectedNotification?.type === 'PayslipRequest' || selectedNotification?.period) &&
            dtrPreviewRows.length > 0 &&
            dtrPreviewRows.every(
              (r) =>
                r.timeIn === "---" &&
                r.breakOut === "---" &&
                r.breakIn === "---" &&
                r.timeOut === "---"
            ) && (
              <Alert
                style={{ marginTop: 8 }}
                type="warning"
                showIcon
                message="No biometrics encoded yet for the selected period."
              />
            )}
          {!dtrPreviewLoading &&
            !dtrPreviewError &&
            (selectedNotification?.type === 'DTRRequest' || selectedNotification?.type === 'PayslipRequest' || selectedNotification?.period) &&
            dtrPreviewRows.length === 0 && (
              <Alert
                type="warning"
                showIcon
                message="No biometrics encoded yet for the selected period."
              />
            )}
        </>
      )}
    </Modal>
  );

  // ---- Message Modal (missing render previously) ----
  const messageModal = (
    <Modal
      open={isMessageModalOpen}
      title={
        selectedMessage
          ? `DTR Log - ${selectedMessage.employeeId || selectedMessage._id}`
          : "Message"
      }
      onCancel={() => setIsMessageModalOpen(false)}
      footer={[
        <Button key="close" onClick={() => setIsMessageModalOpen(false)}>
          Close
        </Button>,
        selectedMessage?.employeeId && (
          <Button
            key="process"
            type="primary"
            onClick={() => {
              const empId = selectedMessage.employeeId;
              setIsMessageModalOpen(false);
              navigate(`/dtr/process?empId=${encodeURIComponent(empId)}`);
            }}
          >
            Process DTR
          </Button>
        ),
      ]}
    >
      {selectedMessage && (
        <Descriptions
          size="small"
          column={1}
          bordered
          styles={{
            label: { width: 130 },
            content: { background: "transparent" },
          }}
        >
          {selectedMessage.employeeId && (
            <Descriptions.Item label="Employee ID">
              {selectedMessage.employeeId}
            </Descriptions.Item>
          )}
          {employeeLoading && (
            <Descriptions.Item label="Employee Details">
              Loading...
            </Descriptions.Item>
          )}
          {employeeError && (
            <Descriptions.Item label="Employee Details">
              <span style={{ color: "red" }}>{employeeError}</span>
            </Descriptions.Item>
          )}
          {employeeDetails && (
            <>
              <Descriptions.Item label="Full Name">
                {employeeDetails.fullName ||
                  employeeDetails.name ||
                  `${employeeDetails.firstName || ""} ${
                    employeeDetails.lastName || ""
                  }`.trim()}
              </Descriptions.Item>
              {employeeDetails.position && (
                <Descriptions.Item label="Position">
                  {employeeDetails.position}
                </Descriptions.Item>
              )}
            </>
          )}
          {selectedMessage.type && (
            <Descriptions.Item label="Type">
              {selectedMessage.type}
            </Descriptions.Item>
          )}
          {selectedMessage.logType && (
            <Descriptions.Item label="Log Type">
              {selectedMessage.logType}
            </Descriptions.Item>
          )}
          {selectedMessage.message && (
            <Descriptions.Item label="Message">
              {selectedMessage.message}
            </Descriptions.Item>
          )}
          {selectedMessage.reason && (
            <Descriptions.Item label="Reason">
              {selectedMessage.reason}
            </Descriptions.Item>
          )}
          {selectedMessage.createdAt && (
            <Descriptions.Item label="Logged At">
              {new Date(selectedMessage.createdAt).toLocaleString()}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Status">
            <Tag color={selectedMessage.read ? "green" : "blue"}>
              {selectedMessage.read ? "Read" : "Unread"}
            </Tag>
          </Descriptions.Item>
          {selectedMessage._id && (
            <Descriptions.Item label="Internal ID">
              {selectedMessage._id}
            </Descriptions.Item>
          )}
        </Descriptions>
      )}
    </Modal>
  );

  // ---- Messages Popover ----
  const messageContent = hasAccess("canViewMessages") && (
    <div style={{ maxHeight: 350, overflowY: "auto", width: 320 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "4px 8px",
        }}
      >
        <Text strong>Messages</Text>
        {hasAccess("canManageMessages") && (
          <Button
            type="link"
            size="small"
            onClick={async () => {
              // Messages are reserved; just mark locally (no-op setter) for now
              setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
              message.success("Marked all as read (local)");
            }}
          >
            Mark all as read
          </Button>
        )}
      </div>

      {messages.length > 0 ? (
        messages.map((m) => (
          <div
            key={m._id} // ✅ use _id instead of id
            style={{
              padding: "8px 12px",
              borderBottom: "1px solid #f0f0f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              opacity: m.read ? 0.6 : 1,
            }}
          >
            <div>
              <Text strong>{`DTR Log - ${m.employeeId}`}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: "12px" }}>
                {new Date(m.createdAt).toLocaleString()}
              </Text>
            </div>
            <Button
              size="small"
              type="link"
              onClick={() => openMessageModal(m)}
            >
              View
            </Button>
          </div>
        ))
      ) : (
        <Text
          type="secondary"
          style={{ padding: "8px 12px", display: "block" }}
        >
          No new messages
        </Text>
      )}
    </div>
  );

  const userPopover = (
    <div className="popover-content">
      <div className="popover-user">
        <Text strong>{user?.name || "Unknown User"}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          @{user?.username || "unknown"}
        </Text>
      </div>
      <Divider style={{ margin: "8px 0" }} />
      <div className="popover-actions">
        <div className="popover-item" onClick={handleViewProfile}>
          <EyeOutlined style={{ marginRight: 8 }} />
          View Profile
        </div>
        {/* Developer Settings item removed as requested */}
        {hasPermission(["canAccessDeveloper"]) && (
          <div className="popover-item" onClick={handleOpenBugReports}>
            <BugOutlined style={{ marginRight: 8 }} />
            Bug Reports
          </div>
        )}
        <div className="popover-item" onClick={handleSuggestFeature}>
          <BulbOutlined style={{ marginRight: 8 }} />
          Suggest a Feature
        </div>
        <div className="popover-item logout" onClick={handleLogout}>
          <LogoutOutlined style={{ marginRight: 8 }} />
          Logout
        </div>
      </div>
    </div>
  );

  return (
    <Layout className="homepage-root-layout">
      {notificationModal}
      {messageModal}
      <Sider
        breakpoint="lg"
        collapsedWidth={80}
        width={220}
        collapsible
        collapsed={collapsed}
        onCollapse={(val) => setCollapsed(val)}
        onBreakpoint={(broken) => {
          if (broken) setCollapsed(true);
        }}
        className="sider"
        style={{ background: "var(--app-sider-bg, #001529)" }}
      >
        <div className={`logo-container ${collapsed ? "collapsed" : ""}`}>
          <Tooltip title="EMBR3 DTR Management System" placement="right">
            <img src={emblogo} alt="EMB Logo" className="logo-img" />
          </Tooltip>
          {!collapsed && (
            <span className="logo-text">EMBR3 DTR Management System</span>
          )}
        </div>
        {/* Import Biometrics button visibility now also considers demo exposed menus when in demo */}
        {hasPermission(["canManipulateBiometrics"]) &&
          (!isDemoActive ||
            !isDemoUser ||
            (demoSettings?.allowedPermissions || []).includes(
              "canManipulateBiometrics"
            )) && (
            <div style={{ padding: "12px", textAlign: "center" }}>
              {collapsed ? (
                <Tooltip title="Import Biometrics" placement="right">
                  <Button
                    shape="circle"
                    icon={<FieldTimeOutlined />}
                    onClick={() => setIsImportModalOpen(true)}
                    className="animated-gradient-button"
                  />
                </Tooltip>
              ) : (
                <Button
                  onClick={() => setIsImportModalOpen(true)}
                  className="animated-gradient-button"
                >
                  Import Biometrics
                </Button>
              )}
            </div>
          )}
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={["/"]}
          onClick={({ key }) =>
            key === "logout" ? handleLogout() : navigate(key)
          }
          items={getMenuItems()}
        />
      </Sider>

      {user && (
        <ImportDTRModal
          open={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          currentUser={user}
          isDemo={isDemoActive && isDemoUser}
        />
      )}

      <Layout>
        <Header
          className="header"
          style={{ background: "var(--app-header-bg, #ffffff)" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "15px",
              marginRight: "10px",
            }}
          >
            <Popover
              content={notificationContent}
              trigger="click"
              placement="bottomRight"
              onOpenChange={(visible) => {
                // Lazy refresh when popover is opened and data is stale (>60s old)
                if (visible) {
                  if (isDemoActive && isDemoUser) return; // skip refresh in demo for fast open
                  const newest = notifications.reduce((a, b) => {
                    const ta = a?.createdAt
                      ? new Date(a.createdAt).getTime()
                      : 0;
                    const tb = b?.createdAt
                      ? new Date(b.createdAt).getTime()
                      : 0;
                    return tb > ta ? b : a;
                  }, null);
                  const ageMs = newest
                    ? Date.now() - new Date(newest.createdAt).getTime()
                    : Infinity;
                  if (ageMs > 60_000 && !notificationsLoading) {
                    // trigger lightweight refresh without cached preload logic
                    (async () => {
                      try {
                        setNotificationsLoading(true);
                        const [payslipRes, dtrReqRes] = await Promise.all([
                          axiosInstance.get("/payslip-requests"),
                          axiosInstance.get("/dtr-requests"),
                        ]);
                        const payslipRaw =
                          payslipRes.data?.data || payslipRes.data || [];
                        const dtrRaw =
                          dtrReqRes.data?.data || dtrReqRes.data || [];
                        const payslip = payslipRaw.map((d) => ({
                          type: "PayslipRequest",
                          id: d._id || d.id || `${Date.now()}_${Math.random()}`,
                          _id: d._id,
                          employeeId: d.employeeId,
                          createdAt: d.createdAt,
                          read: !!d.read,
                          hidden: !!d.hidden,
                          period: d.period,
                          title: `Payslip Request - ${d.employeeId}`,
                        }));
                        const dtr = dtrRaw.map((d) => ({
                          type: "DTRRequest",
                          id: d._id || d.id || `${Date.now()}_${Math.random()}`,
                          _id: d._id || d.id,
                          employeeId: d.employeeId,
                          createdAt: d.createdAt,
                          read: !!d.read,
                          hidden: !!d.hidden,
                          startDate: d.startDate,
                          endDate: d.endDate,
                          title: `DTR Request - ${d.employeeId}`,
                          body: `${
                            d.startDate
                              ? new Date(d.startDate).toLocaleDateString()
                              : ""
                          } - ${
                            d.endDate
                              ? new Date(d.endDate).toLocaleDateString()
                              : ""
                          }`,
                        }));
                        setNotifications((prev) => {
                          const seen = new Set();
                          const combined = [...payslip, ...dtr, ...prev];
                          const deduped = [];
                          for (const n of combined) {
                            const key = n._id || n.id;
                            if (!seen.has(key)) {
                              seen.add(key);
                              deduped.push(n);
                            }
                          }
                          return deduped;
                        });
                      } catch (e) {
                        console.debug("Lazy refresh failed", e);
                      } finally {
                        setNotificationsLoading(false);
                      }
                    })();
                  }
                }
              }}
            >
              <Badge
                count={(() => {
                  const visibleDev = devNotifications.filter((d) => !d.hidden);
                  const visibleRegular = notifications.filter((n) => !n.hidden);
                  const merged = [...visibleDev, ...visibleRegular];
                  return merged.filter((n) => !n.read).length;
                })()}
                size="small"
                overflowCount={99}
              >
                <BellOutlined className="icon-trigger" />
              </Badge>
            </Popover>
            <Popover
              content={messageContent}
              trigger="click"
              placement="bottomRight"
            >
              <Badge
                count={messages.filter((m) => !m.read).length} // Correctly count unread
                size="small"
                overflowCount={99}
              >
                <MessageOutlined className="icon-trigger" />
              </Badge>
            </Popover>
            <Popover
              content={userPopover}
              placement="bottomLeft"
              trigger="hover"
              classNames="user-popover"
            >
              <UserAvatar
                className="user-avatar"
                src={user?.avatarUrl}
                name={user?.name}
                size={32}
              />
            </Popover>
          </div>
        </Header>

        <Content style={{ margin: "16px", paddingBottom: 0 }}>
          <div className="content-wrapper">
            <Routes>
              <Route
                path="/"
                element={
                  <ProtectedRoute requiredPermissions={["canViewDashboard"]}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/employeeinfo"
                element={
                  <ProtectedRoute requiredPermissions={["canViewEmployees"]}>
                    <GenInfo />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dtr/logs"
                element={
                  <ProtectedRoute requiredPermissions={["canViewDTR"]}>
                    <DTRLogs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dtr/process"
                element={
                  <ProtectedRoute requiredPermissions={["canProcessDTR"]}>
                    <DTRProcess currentUser={user} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dtr/reports"
                element={
                  <ProtectedRoute requiredPermissions={["canViewDTR"]}>
                    <DTRReports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dtr/holidays"
                element={
                  <ProtectedRoute requiredPermissions={["canViewDTR"]}>
                    <Holidays />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/trainings"
                element={
                  <ProtectedRoute requiredPermissions={["canViewTrainings"]}>
                    <Trainings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/benefitsinfo"
                element={
                  <ProtectedRoute requiredPermissions={["canViewPayroll"]}>
                    <BenefitsInfo />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/account"
                element={
                  <ProtectedRoute requiredPermissions={["canAccessSettings"]}>
                    <AccountSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/access"
                element={
                  <ProtectedRoute requiredPermissions={["canManageUsers"]}>
                    <UserAccess />
                  </ProtectedRoute>
                }
              />
              {/* <Route
                path="/settings/record-config"
                element={
                  <ProtectedRoute requiredPermissions={["canAccessSettings"]}>
                    <RecordConfigSettings />
                  </ProtectedRoute>
                }
              /> */}
              <Route
                path="/settings/backup"
                element={
                  <ProtectedRoute requiredPermissions={["canPerformBackup"]}>
                    <Backup />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/deductions"
                element={
                  <ProtectedRoute requiredPermissions={["canChangeDeductions"]}>
                    <DeductionSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/developer-settings"
                element={
                  <ProtectedRoute requiredPermissions={["canAccessDeveloper"]}>
                    <DeveloperSettings />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </div>
        </Content>

        <Footer style={{ textAlign: "center" }}>
          © {new Date().getFullYear()} EMBR3 Daily Time Record Management System
        </Footer>
      </Layout>

      

      {isDemoActive && (
        <>
          {/* Report a bug floating button (visible only in demo mode) */}
          <FloatButton
            icon={<BugOutlined />}
            tooltip="Report a bug"
            type="primary"
            style={{ right: 24, bottom: 24 }}
            onClick={() => setIsBugOpen(true)}
          />

          <Modal
            title="Report a bug"
            open={isBugOpen}
            onCancel={() => {
              if (!bugSubmitting) {
                setIsBugOpen(false);
              }
            }}
            okText={bugSubmitting ? "Sending..." : "Send"}
            onOk={submitBugReport}
            confirmLoading={bugSubmitting}
            destroyOnHidden
          >
            <Form form={bugForm} layout="vertical" preserve={false}>
              <Form.Item
                name="title"
                label="Title"
                rules={[
                  { required: true, message: "Please add a short title" },
                ]}
              >
                <Input maxLength={180} placeholder="Short summary" />
              </Form.Item>
              <Form.Item
                name="description"
                label="Description"
                rules={[
                  { required: true, message: "Please describe the issue" },
                ]}
              >
                <Input.TextArea
                  rows={6}
                  placeholder="What happened? Steps to reproduce, expected vs actual, etc."
                />
              </Form.Item>
              <Form.Item label="Screenshot (optional)">
                <Upload
                  beforeUpload={beforeUploadScreenshot}
                  maxCount={1}
                  accept="image/*"
                  listType="picture-card"
                  showUploadList={{ showPreviewIcon: false }}
                >
                  Upload
                </Upload>
                {bugScreenshot && (
                  <div style={{ marginTop: 8 }}>
                    <img
                      src={bugScreenshot}
                      alt="screenshot"
                      style={{
                        maxWidth: "100%",
                        border: "1px solid #eee",
                        borderRadius: 4,
                      }}
                    />
                  </div>
                )}
              </Form.Item>
              <Alert
                type="info"
                showIcon
                message="Your report will be sent to embrhrpms@gmail.com. We include page URL and browser info for faster fixes."
              />
            </Form>
          </Modal>
        </>
      )}

      <ProfileModal
        open={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
      />

      <FeatureModal
        open={isFeatureModalOpen}
        onClose={() => setIsFeatureModalOpen(false)}
        user={user}
      />
    </Layout>
  );
};

export default HomePage;

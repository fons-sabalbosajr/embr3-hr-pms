import {
  Layout,
  Menu,
  Badge,
  Tooltip,
  Typography,
  Popover,
  Divider,
  Button,
  Modal,
  Descriptions,
  Tag,
  Table,
  Alert,
  Skeleton,
  Collapse,
  Avatar,
} from "antd";
import { swalSuccess, swalError, swalWarning, swalInfo, swalConfirm, swalAlert } from "../../utils/swalHelper";

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
  LockOutlined,
  PlusOutlined,
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
import AnnouncementManager from "../../components/Settings/AnnouncementManager/AnnouncementManager";
import Messaging from "../Messaging/Messaging";
import AnnouncementPopup from "../../components/AnnouncementPopup/AnnouncementPopup";
import ProtectedRoute from "../../components/ProtectedRoute";
import ProfileModal from "./components/ProfileModal";
import FeatureModal from "./components/FeatureModal";
import { NotificationsContext } from "../../context/NotificationsContext";
import socket from "../../../utils/socket";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import relativeTime from "dayjs/plugin/relativeTime";
import UserAvatar from "../../components/common/UserAvatar";
import { fetchPhilippineHolidays } from "../../api/holidayPH";
import { resolveTimePunches } from "../../../utils/resolveTimePunches";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(relativeTime);

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
  const [notifPopoverOpen, setNotifPopoverOpen] = useState(false);
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
  // Bug reports summary modal (developer only)
  const [bugListOpen, setBugListOpen] = useState(false);
  const [bugListData, setBugListData] = useState([]);
  const [bugListLoading, setBugListLoading] = useState(false);
  const [bugListStats, setBugListStats] = useState({ total: 0, open: 0, resolved: 0 });
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [recentConversations, setRecentConversations] = useState([]);
  const [loadingRecentConvs, setLoadingRecentConvs] = useState(false);
  const [msgPopoverOpen, setMsgPopoverOpen] = useState(false);

  // Per-feature maintenance status
  const [featureMaintenance, setFeatureMaintenance] = useState({});

  // Fetch unread message count & listen for new messages
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const { data } = await axiosInstance.get("/messages/unread-count");
        setUnreadMsgCount(data.count || 0);
      } catch {}
    };
    fetchUnread();

    const handleNewMsg = () => {
      fetchUnread();
      // Refresh recent conversations if popover is open
      if (msgPopoverOpen) fetchRecentConversations();
    };
    socket.on("new-message", handleNewMsg);
    return () => socket.off("new-message", handleNewMsg);
  }, [msgPopoverOpen]);

  // Fetch per-feature maintenance status
  useEffect(() => {
    const fetchFeatureMaintenance = async () => {
      try {
        const { data } = await axiosInstance.get("/settings/feature-maintenance");
        if (data.isDeveloper) {
          setFeatureMaintenance({}); // Developers see everything
        } else {
          setFeatureMaintenance(data.features || {});
        }
      } catch {}
    };
    fetchFeatureMaintenance();
    // Re-check every 2 minutes
    const interval = setInterval(fetchFeatureMaintenance, 120000);
    return () => clearInterval(interval);
  }, []);

  // Fetch recent conversations for message popup
  const fetchRecentConversations = async () => {
    setLoadingRecentConvs(true);
    try {
      const { data } = await axiosInstance.get("/messages/conversations");
      setRecentConversations((data || []).slice(0, 5));
    } catch {} finally {
      setLoadingRecentConvs(false);
    }
  };
  
  const beforeUploadScreenshot = (file) => {
    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      swalError("Please upload an image file.");
      return Upload.LIST_IGNORE;
    }
    if (file.size > 5 * 1024 * 1024) {
      swalError("Image must be smaller than 5MB.");
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
      swalSuccess("Bug report sent. Thank you!");
      bugForm.resetFields();
      setBugScreenshot(null);
      setIsBugOpen(false);
    } catch (err) {
      // Ignore validation errors (they have errorFields)
      if (err?.errorFields) return;
      swalError(
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
  const handleOpenBugReports = async () => {
    setBugListOpen(true);
    setBugListLoading(true);
    try {
      const res = await axiosInstance.get("/bug-report", { params: { page: 1, limit: 50 } });
      const rows = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      setBugListData(rows);
      const total = res.data?.total ?? rows.length;
      const open = rows.filter((r) => r.status !== "resolved").length;
      setBugListStats({ total, open, resolved: total - open });
    } catch {
      swalError("Failed to load bug reports");
    } finally {
      setBugListLoading(false);
    }
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

  // Socket.io: remove dispatched notifications in real-time (for all connected admins)
  useEffect(() => {
    const handleDtrSent = (payload) => {
      if (payload?.id) {
        setNotifications((prev) =>
          prev.filter((n) => (n._id || n.id) !== String(payload.id))
        );
      }
    };
    const handlePayslipSent = (payload) => {
      if (payload?.id) {
        setNotifications((prev) =>
          prev.filter((n) => (n._id || n.id) !== String(payload.id))
        );
      }
    };
    socket.on("dtrSent", handleDtrSent);
    socket.on("payslipSent", handlePayslipSent);
    return () => {
      socket.off("dtrSent", handleDtrSent);
      socket.off("payslipSent", handlePayslipSent);
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

        // Replace notifications with fresh server data (source of truth)
        setNotifications(() => {
          const seen = new Set();
          const combined = [...payslip, ...dtr];
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
    swalInfo("Logging out...");
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
        key: "messaging",
        icon: <MessageOutlined />,
        label: (() => {
          return (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              Messaging
              {unreadMsgCount > 0 && (
                <Badge
                  count={unreadMsgCount}
                  size="small"
                  overflowCount={99}
                  style={{ marginLeft: 8 }}
                />
              )}
            </span>
          );
        })(),
        className: "messaging-menu-item",
        permissions: ["canViewMessages"],
        children: [
          {
            key: "/messaging/inbox",
            label: "Inbox",
            className: "messaging-menu-item",
            permissions: ["canViewMessages"],
          },
          {
            key: "/messaging/sent",
            label: "Sent",
            className: "messaging-menu-item",
            permissions: ["canViewMessages"],
          },
          {
            key: "/messaging/drafts",
            label: "Drafts",
            className: "messaging-menu-item",
            permissions: ["canViewMessages"],
          },
          {
            key: "/messaging/archived",
            label: "Archived",
            className: "messaging-menu-item",
            permissions: ["canViewMessages"],
          },
        ],
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
            label: "User Accounts",
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
            key: "/settings/announcements",
            label: "Announcements",
            permissions: ["canManageNotifications"],
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

        // Per-feature maintenance: check if this feature is hidden
        const featureKey = item.featureKey || item.key;
        const fm = featureMaintenance[featureKey];
        if (fm && fm.enabled && fm.hidden) return acc; // Hidden entirely

        if (permitted && demoPermitted) {
          // If feature is under maintenance (but not hidden), mark it
          const isUnderMaintenance = fm && fm.enabled && !fm.hidden;
          const itemWithMaint = isUnderMaintenance
            ? { ...item, disabled: true, label: (
                <span style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.6 }}>
                  {typeof item.label === "string" ? item.label : item.label}
                  <Tag color="orange" style={{ fontSize: 10, lineHeight: "16px", padding: "0 4px", marginLeft: 4 }}>
                    Maintenance
                  </Tag>
                </span>
              )}
            : item;

          if (item.children) {
            const filteredChildren = filterItems(item.children);
            if (filteredChildren.length)
              acc.push({ ...itemWithMaint, children: filteredChildren });
          } else {
            acc.push(itemWithMaint);
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
      swalError("Failed to update notification status");
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
    if (n.type === 'DTRRequest') {
      // Use the request's Start Date / End Date as the definitive coverage range
      if (n.startDate && n.endDate) {
        rangeStart = dayjs(n.startDate).tz('Asia/Manila').startOf('day');
        rangeEnd = dayjs(n.endDate).tz('Asia/Manila').startOf('day');
      } else if (n.startDate) {
        // Single date — treat as full-month request
        const d = dayjs(n.startDate).tz('Asia/Manila');
        rangeStart = d.startOf('month');
        rangeEnd = d.endOf('month').startOf('day');
      }
    } else if ((n.type === 'PayslipRequest' || n.period) && n.period) {
      // Expect n.period like YYYY-MM; fallback skip if malformed
      const parsed = dayjs.tz(n.period + '-01', 'Asia/Manila');
      if (parsed.isValid()) {
        rangeStart = parsed.startOf('month');
        rangeEnd = parsed.endOf('month').startOf('day');
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

        // Fetch ALL logs for the employee within the date range (limit=500 to avoid default pagination of 20)
        const { data } = await axiosInstance.get('/dtrlogs/merged', {
          params: {
            startDate: rangeStart.format('YYYY-MM-DD'),
            endDate: rangeEnd.format('YYYY-MM-DD'),
            empIds: n.employeeId,
            limit: 500,
          },
        });
        if (cancelled) return;
        const logs = data?.data || [];

        // Fetch holidays, local holidays, and suspensions in parallel
        const startStr = rangeStart.format('YYYY-MM-DD');
        const endStr = rangeEnd.format('YYYY-MM-DD');
        let allHolidays = [];
        try {
          const yearStart = rangeStart.year();
          const yearEnd = rangeEnd.year();
          const [phRes, lhRes, sRes] = await Promise.all([
            fetchPhilippineHolidays(yearStart).catch(() => []),
            axiosInstance.get('/local-holidays/public', { params: { start: startStr, end: endStr } }).catch(() => ({ data: { data: [] } })),
            axiosInstance.get('/suspensions/public', { params: { start: startStr, end: endStr } }).catch(() => ({ data: { data: [] } })),
          ]);
          let phHolidays = phRes || [];
          if (yearEnd !== yearStart) {
            const ph2 = await fetchPhilippineHolidays(yearEnd).catch(() => []);
            phHolidays = [...phHolidays, ...(ph2 || [])];
          }
          const localHolidays = (lhRes?.data?.data || []).map(h => ({
            date: dayjs(h.date).format('YYYY-MM-DD'),
            endDate: h.endDate ? dayjs(h.endDate).format('YYYY-MM-DD') : null,
            name: h.name,
            type: 'Local Holiday',
          }));
          const suspensions = (sRes?.data?.data || []).map(s => ({
            date: dayjs(s.date).format('YYYY-MM-DD'),
            endDate: s.endDate ? dayjs(s.endDate).format('YYYY-MM-DD') : null,
            name: s.title || s.name,
            type: 'Suspension',
          }));
          allHolidays = [
            ...phHolidays.map(h => ({ date: h.date, name: h.localName, type: h.type })),
            ...localHolidays,
            ...suspensions,
          ];
        } catch (_) {}

        const getHolidayName = (dateKey) => {
          const found = allHolidays.find(h => {
            const s = h.date || null;
            const e = h.endDate || null;
            if (s && e) return dayjs(dateKey).isSameOrAfter(s, 'day') && dayjs(dateKey).isSameOrBefore(e, 'day');
            return s === dateKey;
          });
          if (!found) return '';
          return found.type === 'Suspension' ? `Suspension: ${found.name}` : found.name || 'Holiday';
        };

        // Group logs by date using Asia/Manila timezone
        const byDate = logs.reduce((acc, log) => {
          const dateKey = dayjs(log.time).tz('Asia/Manila').format('YYYY-MM-DD');
          if (!acc[dateKey]) acc[dateKey] = [];
          acc[dateKey].push(log);
          return acc;
        }, {});
        const totalDays = rangeEnd.diff(rangeStart, 'day') + 1;
        const rows = Array.from({ length: totalDays }).map((_, idx) => {
          const date = rangeStart.add(idx, 'day');
          const key = date.format('YYYY-MM-DD');
          const dayLogs = (byDate[key] || []);

          // Use shared chronological position-based detection
          const resolved = resolveTimePunches(dayLogs, { format: 'h:mm', defaultBreak: true });
          const { timeIn, breakOut, breakIn, timeOut } = resolved;

          const dayOfWeek = date.day();
          let status = '';
          const holidayName = getHolidayName(key);
          if (holidayName) status = holidayName;
          else if (dayOfWeek === 0) status = 'Sunday';
          else if (dayOfWeek === 6) status = 'Saturday';
          const hasLogs = Boolean(timeIn || timeOut || breakOut || breakIn);
          return { key, date: date.format('MM/DD/YYYY'), timeIn: timeIn || '---', breakOut: breakOut || '---', breakIn: breakIn || '---', timeOut: timeOut || '---', status, hasLogs };
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
                  swalError("Failed to mark all notifications as read");
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
                borderBottom: "1px solid var(--app-border-color, #f0f0f0)",
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
                    swalAlert({
                      title: "Attach Payslip PDF",
                      text: 'Please generate or open the payslip first so it can be attached. After generating, click "Send Payslip" again.',
                      icon: "info",
                    });
                    return;
                  }
                  const n = selectedNotification;
                  const result = await swalConfirm({
                    title: "Send payslip to employee?",
                    text: `Employee ${n.employeeId} • Period ${
                      n.period || ""
                    }\n\nThe payslip PDF will be sent to: ${n.email || "the email on file"}`,
                    icon: "question",
                    confirmText: "Send",
                  });
                  if (!result.isConfirmed) return;
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
                  swalSuccess("Payslip emailed successfully");
                  // Remove dispatched notification in real-time and close modal
                  setNotifications((prev) =>
                    prev.filter((item) => (item._id || item.id) !== (n._id || n.id))
                  );
                  setIsNotificationModalOpen(false);
                  setSelectedNotification(null);
                } catch (err) {
                  swalError(
                    err?.response?.data?.message ||
                      "Failed to send payslip email"
                  );
                }
              }}
            >
              Send Payslip
            </Button>
          ),
        // If this is a DTR request, provide a quick "Send DTR" action when HR already has a generated PDF
        selectedNotification &&
          selectedNotification.type === "DTRRequest" && (
            <Button
              key="sendDTR"
              onClick={async () => {
                try {
                  const pdfBase64 = window.__LAST_GENERATED_DTR_BASE64__;
                  if (!pdfBase64) {
                    swalAlert({
                      title: "Attach DTR PDF",
                      text: 'Please generate or open the DTR first so it can be attached. After generating, click "Send DTR" again.',
                      icon: "info",
                    });
                    return;
                  }
                  const n = selectedNotification;
                  const startLabel = n.startDate ? new Date(n.startDate).toLocaleDateString() : "";
                  const endLabel = n.endDate ? new Date(n.endDate).toLocaleDateString() : "";
                  const result = await swalConfirm({
                    title: "Send DTR to employee?",
                    text: `Employee ${n.employeeId} • ${startLabel} – ${endLabel}\n\nThe DTR PDF will be sent to: ${n.email || "the email on file"}`,
                    icon: "question",
                    confirmText: "Send",
                  });
                  if (!result.isConfirmed) return;
                  await axiosInstance.post(
                    `/dtr-requests/${encodeURIComponent(n._id || n.id)}/send-email`,
                    {
                      pdfBase64,
                      filename: `dtr_${n.employeeId}_${startLabel.replace(/\//g, "-")}.pdf`,
                    }
                  );
                  swalSuccess("DTR emailed successfully");
                  // Remove dispatched notification in real-time and close modal
                  setNotifications((prev) =>
                    prev.filter((item) => (item._id || item.id) !== (n._id || n.id))
                  );
                  setIsNotificationModalOpen(false);
                  setSelectedNotification(null);
                } catch (err) {
                  swalError(
                    err?.response?.data?.message ||
                      "Failed to send DTR email"
                  );
                }
              }}
            >
              Send DTR
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
              {selectedNotification.status === "sent" && (
                <Tag color="green" style={{ marginLeft: 4 }}>Sent</Tag>
              )}
            </Descriptions.Item>
            {selectedNotification.email && (
              <Descriptions.Item label="Recipient Email">
                {selectedNotification.email}
              </Descriptions.Item>
            )}
            {selectedNotification.sentAt && (
              <Descriptions.Item label="Sent At">
                {new Date(selectedNotification.sentAt).toLocaleString()}
              </Descriptions.Item>
            )}
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
          {/* Collapsible Quick DTR Summary */}
          {(selectedNotification?.type === 'DTRRequest' || selectedNotification?.type === 'PayslipRequest' || selectedNotification?.period) && (
            <Collapse
              size="small"
              style={{ marginTop: 12 }}
              items={[{
                key: 'dtr-summary',
                label: `Quick DTR Summary${dtrPreviewRows.length ? ` (${dtrPreviewRows.filter(r => r.hasLogs).length} days with logs)` : ''}`,
                children: (
                  <>
                    {dtrPreviewLoading && (
                      <Skeleton active paragraph={{ rows: 4 }} />
                    )}
                    {dtrPreviewError && (
                      <Alert type="error" showIcon message={dtrPreviewError} />
                    )}
                    {!dtrPreviewLoading && !dtrPreviewError && dtrPreviewRows.length > 0 && (
                      <Table
                        size="small"
                        className="dtr-table-compact compact-table"
                        dataSource={dtrPreviewRows}
                        pagination={false}
                        rowKey={(r) => r.key}
                        bordered
                        scroll={{ x: 420 }}
                        columns={[
                          {
                            title: "Date",
                            dataIndex: "date",
                            key: "date",
                            width: 85,
                            onCell: () => ({ className: "date-cell", style: { fontSize: 11, padding: '4px 6px' } }),
                          },
                          {
                            title: "In",
                            dataIndex: "timeIn",
                            key: "timeIn",
                            width: 55,
                            render: (value, record) =>
                              !record.hasLogs && record.status
                                ? record.status
                                : value,
                            onCell: (record) =>
                              !record.hasLogs && record.status
                                ? {
                                    colSpan: 4,
                                    style: {
                                      background: "#f5f5f5",
                                      textAlign: "center",
                                      fontWeight: 500,
                                      color: "#888",
                                      fontSize: 11,
                                      padding: '4px 6px',
                                    },
                                  }
                                : { className: "time-cell", style: { fontSize: 11, padding: '4px 6px' } },
                          },
                          {
                            title: "B-Out",
                            dataIndex: "breakOut",
                            key: "breakOut",
                            width: 55,
                            onCell: (record) =>
                              !record.hasLogs && record.status
                                ? { colSpan: 0 }
                                : { className: "time-cell", style: { fontSize: 11, padding: '4px 6px' } },
                          },
                          {
                            title: "B-In",
                            dataIndex: "breakIn",
                            key: "breakIn",
                            width: 55,
                            onCell: (record) =>
                              !record.hasLogs && record.status
                                ? { colSpan: 0 }
                                : { className: "time-cell", style: { fontSize: 11, padding: '4px 6px' } },
                          },
                          {
                            title: "Out",
                            dataIndex: "timeOut",
                            key: "timeOut",
                            width: 55,
                            onCell: (record) =>
                              !record.hasLogs && record.status
                                ? { colSpan: 0 }
                                : { className: "time-cell", style: { fontSize: 11, padding: '4px 6px' } },
                          },
                        ]}
                      />
                    )}
                    {!dtrPreviewLoading && !dtrPreviewError && dtrPreviewRows.length > 0 &&
                      dtrPreviewRows.every(
                        (r) => r.timeIn === "---" && r.breakOut === "---" && r.breakIn === "---" && r.timeOut === "---"
                      ) && (
                        <Alert
                          style={{ marginTop: 8 }}
                          type="warning"
                          showIcon
                          message="No biometrics encoded yet for the selected period."
                        />
                      )}
                    {!dtrPreviewLoading && !dtrPreviewError && dtrPreviewRows.length === 0 && (
                      <Alert
                        type="warning"
                        showIcon
                        message="No biometrics encoded yet for the selected period."
                      />
                    )}
                  </>
                ),
              }]}
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

  // ---- Messages Popover (recent conversations popup) ----
  const messageContent = hasAccess("canViewMessages") && (
    <div style={{ width: 360, maxHeight: 440, overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #f0f0f0" }}>
        <Text strong style={{ fontSize: 15 }}>Messages</Text>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Button size="small" icon={<PlusOutlined />} type="primary" style={{ borderRadius: 6 }}
            onClick={() => { setMsgPopoverOpen(false); navigate("/messaging/inbox"); }}
          >New</Button>
          <Button type="link" size="small" onClick={() => { setMsgPopoverOpen(false); navigate("/messaging/inbox"); }}>
            View All
          </Button>
        </div>
      </div>
      {loadingRecentConvs ? (
        <div style={{ textAlign: "center", padding: 30 }}><Skeleton active paragraph={{ rows: 3 }} /></div>
      ) : recentConversations.length === 0 ? (
        <div style={{ padding: "32px 16px", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #e6f4ff, #f0f5ff)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <MessageOutlined style={{ fontSize: 24, color: "#1677ff" }} />
          </div>
          <Text type="secondary" style={{ fontSize: 13 }}>No conversations yet</Text>
        </div>
      ) : (
        recentConversations.map((conv) => {
          const other = (conv.participants || []).find((p) => String(p._id) !== String(user?._id));
          const name = conv.isGroup ? (conv.groupName || "Group Chat") : (other?.name || "Unknown");
          const preview = conv.lastMessage
            ? conv.lastMessage.isDeleted
              ? "Message deleted"
              : conv.lastMessage.priority === "urgent"
              ? `🔴 ${(conv.lastMessage.content || "").slice(0, 45)}`
              : (conv.lastMessage.content || "").slice(0, 50)
            : "No messages yet";
          return (
            <div
              key={conv._id}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
                borderBottom: "1px solid #fafafa", cursor: "pointer",
                background: conv.unreadCount > 0 ? "#f0f7ff" : "transparent",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { if (!conv.unreadCount) e.currentTarget.style.background = "#f9f9fb"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = conv.unreadCount > 0 ? "#f0f7ff" : "transparent"; }}
              onClick={() => { setMsgPopoverOpen(false); navigate(`/messaging/inbox?cid=${conv._id}`); }}
            >
              <div style={{ position: "relative", flexShrink: 0 }}>
                {conv.isGroup ? (
                  <Avatar style={{ background: "linear-gradient(135deg, #667eea, #764ba2)" }} icon={<TeamOutlined />} size={40} />
                ) : other ? (
                  <UserAvatar user={other} size={40} />
                ) : (
                  <Avatar style={{ backgroundColor: "#1677ff" }} icon={<MessageOutlined />} size={40} />
                )}
                {!conv.isGroup && other?.isOnline && (
                  <span style={{ position: "absolute", bottom: 2, right: 2, width: 10, height: 10, background: "#52c41a", border: "2px solid #fff", borderRadius: "50%", zIndex: 1 }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: conv.unreadCount > 0 ? 600 : 500, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 4 }}>
                  {conv.isConfidential && <LockOutlined style={{ fontSize: 11, color: "#faad14" }} />}
                  {name}
                  {conv.isGroup && <span style={{ fontSize: 10, color: "#8c8c8c", background: "#f0f0f0", borderRadius: 10, padding: "0 5px", height: 16, display: "inline-flex", alignItems: "center", marginLeft: 4 }}>{(conv.participants || []).length}</span>}
                </div>
                <div style={{ fontSize: 12, color: "#8c8c8c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>
                  {preview}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                {conv.lastMessageAt && (
                  <div style={{ fontSize: 11, color: "#bfbfbf" }}>
                    {dayjs(conv.lastMessageAt).fromNow(true)}
                  </div>
                )}
                {conv.unreadCount > 0 && (
                  <Badge count={conv.unreadCount} size="small" style={{ marginTop: 4 }} />
                )}
              </div>
            </div>
          );
        })
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
        {user?.userType === "developer" && (
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
          onClick={({ key }) => {
            if (key === "logout") return handleLogout();
            navigate(key);
          }}
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

      <Layout style={{ marginLeft: collapsed ? 80 : 220, transition: 'margin-left 0.2s' }}>
        <Header
          className="header"
          style={{ background: "var(--app-header-bg, #ffffff)" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginRight: "5px",
            }}
          >
            <Popover
              content={notificationContent}
              trigger="click"
              placement="bottomRight"
              open={notifPopoverOpen}
              onOpenChange={(visible) => {
                setNotifPopoverOpen(visible);
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
                        setNotifications(() => {
                          const seen = new Set();
                          const combined = [...payslip, ...dtr];
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
              open={msgPopoverOpen}
              onOpenChange={(open) => {
                setMsgPopoverOpen(open);
                if (open) fetchRecentConversations();
              }}
            >
              <Badge
                count={unreadMsgCount}
                size="small"
                overflowCount={99}
              >
                <MessageOutlined className="icon-trigger" style={{ cursor: 'pointer' }} />
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

        <div className="homepage-content-scroll">
        <Content style={{ margin: "16px", paddingBottom: 0 }}
          className="main-content"
        >
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
              <Route
                path="/settings/announcements"
                element={
                  <ProtectedRoute requiredPermissions={["canManageNotifications"]}>
                    <AnnouncementManager />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/messaging/inbox"
                element={
                  <ProtectedRoute requiredPermissions={["canViewMessages"]}>
                    <Messaging currentUser={user} tab="inbox" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/messaging/sent"
                element={
                  <ProtectedRoute requiredPermissions={["canViewMessages"]}>
                    <Messaging currentUser={user} tab="sent" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/messaging/drafts"
                element={
                  <ProtectedRoute requiredPermissions={["canViewMessages"]}>
                    <Messaging currentUser={user} tab="drafts" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/messaging/archived"
                element={
                  <ProtectedRoute requiredPermissions={["canViewMessages"]}>
                    <Messaging currentUser={user} tab="archived" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/messaging"
                element={
                  <ProtectedRoute requiredPermissions={["canViewMessages"]}>
                    <Messaging currentUser={user} tab="inbox" />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </div>
        </Content>

        <Footer style={{ textAlign: "center" }}>
          © {new Date().getFullYear()} EMBR3 Daily Time Record Management System
        </Footer>
        </div>
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

      {/* Bug Reports Summary Modal (developer only) */}
      <Modal
        open={bugListOpen}
        onCancel={() => setBugListOpen(false)}
        footer={<Button onClick={() => setBugListOpen(false)}>Close</Button>}
        width={720}
        title="Bug Reports Summary"
        destroyOnHidden
      >
        {bugListLoading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : (
          <>
            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              <Tag color="blue" style={{ fontSize: 14, padding: "4px 12px" }}>Total: {bugListStats.total}</Tag>
              <Tag color="volcano" style={{ fontSize: 14, padding: "4px 12px" }}>Open: {bugListStats.open}</Tag>
              <Tag color="green" style={{ fontSize: 14, padding: "4px 12px" }}>Resolved: {bugListStats.resolved}</Tag>
            </div>
            <Table
              size="small"
              dataSource={bugListData}
              rowKey={(r) => r._id}
              pagination={{ pageSize: 5, size: "small" }}
              columns={[
                { title: "Title", dataIndex: "title", key: "title", render: (t) => t || "(no title)", ellipsis: true },
                { title: "Status", dataIndex: "status", key: "status", width: 90, render: (s) => <Tag color={s === "resolved" ? "green" : "volcano"}>{s || "open"}</Tag> },
                { title: "Reporter", key: "reporter", width: 140, render: (_, r) => r.reporterName || r.name || "-" },
                { title: "Date", dataIndex: "createdAt", key: "createdAt", width: 130, render: (v) => v ? dayjs(v).format("MM/DD/YY HH:mm") : "-" },
              ]}
              expandable={{
                expandedRowRender: (r) => (
                  <div style={{ fontSize: 13 }}>
                    {r.description && <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{r.description}</p>}
                    {r.pageUrl && <Text type="secondary" style={{ fontSize: 12 }}>Page: {r.pageUrl}</Text>}
                  </div>
                ),
              }}
            />
          </>
        )}
      </Modal>

      {/* Show pop-up announcements after login */}
      <AnnouncementPopup />
    </Layout>
  );
};

export default HomePage;

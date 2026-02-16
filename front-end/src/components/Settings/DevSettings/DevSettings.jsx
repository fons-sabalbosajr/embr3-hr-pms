import React, { useEffect, useMemo, useState, useContext } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Card,
  Descriptions,
  Space,
  Tag,
  Alert,
  Typography,
  Divider,
  Button,
  Tabs,
  Collapse,
  Form,
  Input,
  InputNumber,
  Switch,
  ColorPicker,
  Row,
  Col,
  DatePicker,
  TimePicker,
  Select,
  Table,
  Modal,
  Checkbox,
  Layout,
  Menu,
} from "antd";
import dayjs from "dayjs";
import useAuth from "../../../hooks/useAuth";
import { NotificationsContext } from "../../../context/NotificationsContext";
import SecureStorageDiagnostics from "./SecureStorageDiagnostics";
import axiosInstance from "../../../api/axiosInstance";
import DemoModeSettings from "./DemoModeSettings";
import { secureStore, secureSessionGet, secureSessionStore, secureRetrieve } from "../../../../utils/secureStorage";
import socket from "../../../../utils/socket";
import { swalSuccess, swalError, swalInfo, swalWarning, swalConfirm } from "../../../utils/swalHelper";
import "./DevSettings.css";
import {
  EyeOutlined,
  DownloadOutlined,
  DeleteOutlined,
  LinkOutlined,
  CalendarOutlined,
  ReloadOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  MailOutlined,
  CloudOutlined,
  ApiOutlined,
  DesktopOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DashboardOutlined,
  TeamOutlined,
  FieldTimeOutlined,
  SafetyOutlined,
  BugOutlined,
  BellOutlined,
  LockOutlined,
  ToolOutlined,
  InboxOutlined,
  SettingOutlined,
  MessageOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;
const { Sider, Content } = Layout;

// Lightweight color mapping for document types (for nicer tags)
const docTagColor = (t) => {
  switch (t) {
    case "Payslip":
      return "blue";
    case "Certificate of Employment":
      return "green";
    case "Salary Record":
      return "orange";
    case "DTR":
      return "red";
    default:
      return "default";
  }
};

const Section = ({ title, children, extra }) => (
  <Card title={title} extra={extra} size="small" style={{ marginBottom: 16 }}>
    {children}
  </Card>
);

const DevSettings = () => {
  const { user, hasPermission, updateCurrentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [devInfo, setDevInfo] = useState(null);

  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState(null);
  const [settings, setSettings] = useState(null);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState("runtime");
  const [siderCollapsed, setSiderCollapsed] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [didInitFromUrl, setDidInitFromUrl] = useState(false);

  // Treat explicit developer userType as developer access as well
  const canSeeDev =
    user?.isAdmin ||
    user?.userType === "developer" ||
    hasPermission("canAccessDeveloper") ||
    hasPermission("canSeeDev") ||
    hasPermission("canManageNotifications") ||
    hasPermission("canAccessNotifications") ||
    user?.canSeeDev ||
    user?.canManageNotifications ||
    user?.canAccessNotifications;
  const isDemoUser = user?.isDemo;

  // Consolidated hooks (declare once, in stable order)
  const [settingsLoadingLocal, setSettingsLoadingLocal] = useState(false);

  // Attendance preview
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState([]);
  const [attendanceRange, setAttendanceRange] = useState(null);
  const [attendanceNameFilter, setAttendanceNameFilter] = useState("");
  const [attendancePage, setAttendancePage] = useState(1);
  const [attendancePageSize, setAttendancePageSize] = useState(10);
  const [attendanceTotal, setAttendanceTotal] = useState(0);

  const filteredAttendance = useMemo(() => {
    const q = (attendanceNameFilter || "").trim().toLowerCase();
    if (!q) return attendanceData || [];
    return (attendanceData || []).filter((r) =>
      (r.name || "").toLowerCase().includes(q)
    );
  }, [attendanceData, attendanceNameFilter]);

  // Reset page to 1 when the name filter changes
  useEffect(() => {
    setAttendancePage(1);
  }, [attendanceNameFilter]);

  // Keep total in sync with filtered results
  useEffect(() => {
    setAttendanceTotal((filteredAttendance || []).length);
  }, [filteredAttendance]);

  // Database & Maintenance
  const [collections, setCollections] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [backupFormat, setBackupFormat] = useState("json");
  const [backupJobs, setBackupJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  // Backup jobs filters
  const [jobStatusFilter, setJobStatusFilter] = useState("all");
  const [jobCollectionFilter, setJobCollectionFilter] = useState("all");
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsPageSize, setJobsPageSize] = useState(5);
  // Derived collections from jobs for filter options (must be before any early returns)
  const jobCollections = useMemo(() => {
    const names = (backupJobs || []).map((j) => j?.collection).filter(Boolean);
    return Array.from(new Set(names));
  }, [backupJobs]);
  // Apply filters to jobs list (must be before any early returns)
  const filteredJobs = useMemo(() => {
    return (backupJobs || []).filter((j) => {
      const statusOk =
        jobStatusFilter === "all" ||
        (j?.status || "").toLowerCase() === jobStatusFilter;
      const collOk =
        jobCollectionFilter === "all" ||
        (j?.collection || "") === jobCollectionFilter;
      return statusOk && collOk;
    });
  }, [backupJobs, jobStatusFilter, jobCollectionFilter]);

  useEffect(() => {
    setJobsPage(1);
  }, [jobStatusFilter, jobCollectionFilter]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceRange, setMaintenanceRange] = useState(() => {
    const m = settings?.maintenance;
    return m?.startDate && m?.endDate
      ? [dayjs(m.startDate), dayjs(m.endDate)]
      : null;
  });
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    () => settings?.maintenance?.message || ""
  );
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(
    () => settings?.maintenance?.enabled || false
  );
  const [isMaintPreviewOpen, setIsMaintPreviewOpen] = useState(false);

  // Per-feature maintenance
  const [featureMaintenanceMap, setFeatureMaintenanceMap] = useState(() => {
    const fm = settings?.featureMaintenance;
    if (fm && typeof fm === "object") {
      // Convert Map-like or plain object
      const obj = {};
      if (fm.forEach) fm.forEach((v, k) => { obj[k] = v; });
      else Object.entries(fm).forEach(([k, v]) => { obj[k] = v; });
      return obj;
    }
    return {};
  });
  const [featureMaintSaving, setFeatureMaintSaving] = useState(false);

  // All features that can be toggled
  const FEATURE_LIST = [
    { key: "/", label: "Dashboard / Overview" },
    { key: "employees", label: "Personnel (all)" },
    { key: "/employeeinfo", label: "Employee Profile" },
    { key: "/trainings", label: "Training Records" },
    { key: "/benefitsinfo", label: "Compensation" },
    { key: "dtr", label: "Timekeeping (all)" },
    { key: "/dtr/logs", label: "Biometric Logs" },
    { key: "/dtr/process", label: "Generate DTR" },
    { key: "/dtr/reports", label: "DTR Reports" },
    { key: "/dtr/holidays", label: "Holidays & Suspensions" },
    { key: "messaging", label: "Messaging (all)" },
    { key: "/messaging/inbox", label: "Inbox" },
    { key: "/messaging/sent", label: "Sent Messages" },
    { key: "/messaging/drafts", label: "Drafts" },
    { key: "settings", label: "Administration (all)" },
    { key: "/settings/account", label: "Account Preferences" },
    { key: "/settings/deductions", label: "Deductions" },
    { key: "/settings/access", label: "User Access" },
    { key: "/settings/backup", label: "Backup" },
    { key: "/settings/announcements", label: "Announcements" },
  ];

  const updateFeatureMaint = (featureKey, field, value) => {
    setFeatureMaintenanceMap((prev) => ({
      ...prev,
      [featureKey]: { ...(prev[featureKey] || { enabled: false, message: "", hidden: false }), [field]: value },
    }));
  };

  const saveFeatureMaintenance = async () => {
    try {
      setFeatureMaintSaving(true);
      const payload = { ...(settings || {}), featureMaintenance: featureMaintenanceMap };
      const res = await axiosInstance.put("/settings", payload);
      setSettings(res.data);
      swalSuccess("Feature maintenance settings saved");
    } catch {
      swalError("Failed to save feature maintenance settings");
    } finally {
      setFeatureMaintSaving(false);
    }
  };

  // Audit logs and Notifications state
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(10);
  const [auditTotal, setAuditTotal] = useState(0);
  // Multi-select actions (empty means all)
  const [auditActionsFilter, setAuditActionsFilter] = useState([]);
  const [auditUserFilter, setAuditUserFilter] = useState("all");
  const [auditDateRange, setAuditDateRange] = useState(null); // [dayjs, dayjs]
  const [auditSortBy, setAuditSortBy] = useState("createdAt");
  const [auditSortOrder, setAuditSortOrder] = useState("descend");
  const [auditDetailOpen, setAuditDetailOpen] = useState(false);
  const [auditDetailObj, setAuditDetailObj] = useState(null);
  const [auditDetailsQuery, setAuditDetailsQuery] = useState("");
  const [notifications, setNotifications] = useState([]);
  const notificationsContext = useContext(NotificationsContext);
  const [notifLoading, setNotifLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [editForm] = Form.useForm();

  // Bug Reports management
  const [bugLoading, setBugLoading] = useState(false);
  const [bugReports, setBugReports] = useState([]);
  const [bugPage, setBugPage] = useState(1);
  const [bugPageSize, setBugPageSize] = useState(10);
  const [bugTotal, setBugTotal] = useState(0);
  const [bugStatusFilter, setBugStatusFilter] = useState("open");
  const [bugQuery, setBugQuery] = useState("");
  const [bugDetailOpen, setBugDetailOpen] = useState(false);
  const [bugDetailObj, setBugDetailObj] = useState(null);

  // Google Drive quick browser
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveFiles, setDriveFiles] = useState([]);
  const [drivePath, setDrivePath] = useState(""); // local uploads subdir
  const [driveFolderStack, setDriveFolderStack] = useState([]); // [{id, name}] for Drive breadcrumb
  const [drivePage, setDrivePage] = useState(1);
  const [drivePageSize, setDrivePageSize] = useState(5);
  const isDriveProvider = devInfo?.storageProvider === 'drive';
  const fetchDriveFiles = async (nextPathOrFolderId, folderName) => {
    try {
      setDriveLoading(true);
      let params = {};
      if (isDriveProvider) {
        // Drive mode — navigate by folder ID
        if (nextPathOrFolderId) params.folderId = nextPathOrFolderId;
      } else {
        // Local mode — navigate by path
        const pathToUse = typeof nextPathOrFolderId === 'string' ? nextPathOrFolderId : drivePath;
        if (pathToUse) params.path = pathToUse;
      }
      const res = await axiosInstance.get("/uploads", { params });
      const rows = res?.data?.data || res?.data || [];
      setDriveFiles(Array.isArray(rows) ? rows : []);
      setDrivePage(1);
      if (!isDriveProvider && typeof nextPathOrFolderId === 'string') {
        setDrivePath(nextPathOrFolderId);
      }
    } catch (e) {
      swalError(e?.response?.data?.message || "Failed to load Drive files");
    } finally {
      setDriveLoading(false);
    }
  };
  const navigateDriveFolder = (folderId, folderName) => {
    setDriveFolderStack((prev) => [...prev, { id: folderId, name: folderName }]);
    fetchDriveFiles(folderId, folderName);
  };
  const navigateDriveUp = () => {
    if (isDriveProvider) {
      setDriveFolderStack((prev) => {
        const next = prev.slice(0, -1);
        const parentId = next.length > 0 ? next[next.length - 1].id : "";
        fetchDriveFiles(parentId || "");
        return next;
      });
    } else {
      const parent = drivePath.split('/').slice(0, -1).join('/');
      fetchDriveFiles(parent);
    }
  };
  const navigateDriveRoot = () => {
    setDriveFolderStack([]);
    fetchDriveFiles("");
  };

  // Employees management
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [resignModalOpen, setResignModalOpen] = useState(false);
  const [resignForm] = Form.useForm();
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  // Resigned employees management (DB & Maintenance tab)
  const [resignedEmployees, setResignedEmployees] = useState([]);
  const [resignedLoading, setResignedLoading] = useState(false);
  const [resignedDetailsOpen, setResignedDetailsOpen] = useState(false);
  const [resignedSelected, setResignedSelected] = useState(null);
  const [empRecordsLoading, setEmpRecordsLoading] = useState(false);
  const [empRecords, setEmpRecords] = useState(null);
  // Biometrics logs filters
  const [bioRange, setBioRange] = useState(null);
  const [bioTimeFrom, setBioTimeFrom] = useState(null); // dayjs or null
  const [bioTimeTo, setBioTimeTo] = useState(null); // dayjs or null
  const [bioLogs, setBioLogs] = useState([]);
  const [bioMeta, setBioMeta] = useState(null);
  const [bioPage, setBioPage] = useState(1);
  const [bioPageSize] = useState(500);
  const [bioLoading, setBioLoading] = useState(false);

  // Employees filters
  const [empFilterName, setEmpFilterName] = useState("");
  const [empFilterEmpId, setEmpFilterEmpId] = useState("");
  const [empFilterEmpNo, setEmpFilterEmpNo] = useState("");
  const [empFilterDivision, setEmpFilterDivision] = useState("all");
  const [empFilterSection, setEmpFilterSection] = useState("all");
  const [empFilterType, setEmpFilterType] = useState("all");
  const [empFilterStatus, setEmpFilterStatus] = useState("all");
  const [employeesPage, setEmployeesPage] = useState(1);
  const [employeesPageSize, setEmployeesPageSize] = useState(10);

  useEffect(() => {
    setEmployeesPage(1);
  }, [
    empFilterName,
    empFilterEmpId,
    empFilterEmpNo,
    empFilterDivision,
    empFilterSection,
    empFilterType,
    empFilterStatus,
  ]);

  // Demo users management (per-user demo flag)
  const [demoUsers, setDemoUsers] = useState([]);
  const [demoUsersLoading, setDemoUsersLoading] = useState(false);
  const [showOnlyDemoUsers, setShowOnlyDemoUsers] = useState(false);
  const [savingDemoIds, setSavingDemoIds] = useState(new Set());
  const [demoUsersPage, setDemoUsersPage] = useState(1);
  const [demoUsersPageSize, setDemoUsersPageSize] = useState(8);

  useEffect(() => {
    setDemoUsersPage(1);
  }, [showOnlyDemoUsers]);

  const fetchDemoUsers = async () => {
    try {
      setDemoUsersLoading(true);
      const res = await axiosInstance.get("/users");
      // API may return { success, data } or raw array; normalize
      const rows = res?.data?.data || res?.data?.users || res?.data;
      const arr = Array.isArray(rows) ? rows : [];
      setDemoUsers(arr);
    } catch (e) {
      swalError("Failed to fetch users for demo management");
    } finally {
      setDemoUsersLoading(false);
    }
  };

  const toggleUserDemo = async (u, value) => {
    // Prevent duplicate in-flight updates for same user
    if (savingDemoIds.has(u._id)) return;
    setSavingDemoIds((prev) => new Set(prev).add(u._id));

    // Snapshot previous for revert
    const prevUsers = demoUsers;

    // Optimistic local update using functional set to avoid stale closure
    setDemoUsers((prev) =>
      prev.map((r) => (r._id === u._id ? { ...r, isDemo: value } : r))
    );

    try {
      const res = await axiosInstance.put(`/users/${u._id}/access`, {
        isDemo: value,
      });
      const updated = res?.data?.data || res?.data;
      if (updated && updated._id) {
        setDemoUsers((prev) =>
          prev.map((r) => (r._id === updated._id ? { ...r, ...updated } : r))
        );
        if (user?._id === updated._id) {
          updateCurrentUser(updated);
          // Persist updated current user so interceptor reflects new demo flag immediately
          try {
            secureStore("user", updated);
            window.dispatchEvent(new Event("current-user-updated"));
          } catch (_) {}
        }
        swalSuccess(
          value
            ? `Marked ${
                updated.name || updated.fullName || updated.email
              } as demo user`
            : `Removed ${
                updated.name || updated.fullName || updated.email
              } from demo users`
        );
      } else {
        // Fallback: re-fetch to sync state if API response shape unexpected
        fetchDemoUsers();
      }
    } catch (e) {
      // Revert state
      setDemoUsers(prevUsers);
      swalError(e?.response?.data?.message || "Failed to update demo flag");
    } finally {
      setSavingDemoIds((prev) => {
        const n = new Set(prev);
        n.delete(u._id);
        return n;
      });
    }
  };

  // Auto-load demo users when entering Demo Mode tab
  useEffect(() => {
    if (activeTab === "demo-mode") {
      fetchDemoUsers();
    }
  }, [activeTab]);

  const loadAllEmployees = async () => {
    try {
      setEmployeesLoading(true);
      const res = await axiosInstance.get("/employees", {
        params: { includeResigned: "true", pageSize: 0 },
      });
      const rows = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];
      setEmployees(rows);
    } catch (err) {
      swalError("Failed to load employees");
    } finally {
      setEmployeesLoading(false);
    }
  };

  const loadResignedEmployees = async () => {
    try {
      setResignedLoading(true);
      const res = await axiosInstance.get("/employees", {
        params: { includeResigned: "true", pageSize: 0 },
      });
      const rows = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];
      setResignedEmployees(rows.filter((r) => r.isResigned));
    } catch (err) {
      swalError("Failed to load resigned employees");
    } finally {
      setResignedLoading(false);
    }
  };

  const openResignedDetails = async (emp) => {
    setResignedSelected(emp);
    setResignedDetailsOpen(true);
    setEmpRecords(null);
    setBioRange(null);
    setBioTimeFrom(null);
    setBioTimeTo(null);
    setBioLogs([]);
    setBioMeta(null);
    setBioPage(1);
    try {
      setEmpRecordsLoading(true);
      const res = await axiosInstance.get(`/employees/${emp._id}/records`, {
        params: { page: 1, pageSize: bioPageSize },
      });
      const data = res?.data?.data || null;
      setEmpRecords(data);
      setBioLogs(data?.biometricLogs || []);
      setBioMeta(data?.biometricMeta || null);
      setBioPage(1);
    } catch (err) {
      swalError("Failed to load employee records");
    } finally {
      setEmpRecordsLoading(false);
    }
  };

  const refreshEmpRecords = async () => {
    if (!resignedSelected) return;
    try {
      setEmpRecordsLoading(true);
      const res = await axiosInstance.get(`/employees/${resignedSelected._id}/records`, {
        params: { page: 1, pageSize: bioPageSize },
      });
      const data = res?.data?.data || null;
      setEmpRecords(data);
      setBioLogs(data?.biometricLogs || []);
      setBioMeta(data?.biometricMeta || null);
      setBioPage(1);
    } catch (err) {
      swalError("Failed to refresh employee records");
    } finally {
      setEmpRecordsLoading(false);
    }
  };

  const handleOpenDoc = (doc) => {
    const url = doc?.downloadUrl;
    if (!url) return swalInfo("No file available for this document");
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (_) {
      swalError("Failed to open document");
    }
  };

  const handleDownloadDoc = (doc) => {
    const url = doc?.downloadUrl;
    if (!url) return swalInfo("No file available for this document");
    const a = document.createElement("a");
    a.href = url;
    a.download = doc?.originalFilename || "document";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDeleteDoc = async (doc) => {
    try {
      await axiosInstance.delete(`/employee-docs/${doc._id}`);
      swalSuccess("Document deleted");
      await refreshEmpRecords();
    } catch (e) {
      swalError(e?.response?.data?.message || "Failed to delete document");
    }
  };

  const refreshBiometricLogs = async () => {
    if (!resignedSelected) return;
    try {
      setBioLoading(true);
      const params = { page: 1, pageSize: bioPageSize };
      if (bioRange && bioRange[0] && bioRange[1]) {
        params.dateFrom = bioRange[0].startOf("day").toISOString();
        params.dateTo = bioRange[1].endOf("day").toISOString();
      }
      const res = await axiosInstance.get(
        `/employees/${resignedSelected._id}/records`,
        { params }
      );
      const data = res?.data?.data || {};
      setEmpRecords((prev) => ({ ...(prev || {}), ...data }));
      setBioLogs(data?.biometricLogs || []);
      setBioMeta(data?.biometricMeta || null);
      setBioPage(1);
    } catch (e) {
      swalError("Failed to refresh biometrics");
    } finally {
      setBioLoading(false);
    }
  };

  const loadMoreBiometrics = async () => {
    if (!resignedSelected || !bioMeta?.hasMore) return;
    try {
      setBioLoading(true);
      const nextPage = bioPage + 1;
      const params = { page: nextPage, pageSize: bioPageSize };
      if (bioRange && bioRange[0] && bioRange[1]) {
        params.dateFrom = bioRange[0].startOf("day").toISOString();
        params.dateTo = bioRange[1].endOf("day").toISOString();
      }
      const res = await axiosInstance.get(
        `/employees/${resignedSelected._id}/records`,
        { params }
      );
      const data = res?.data?.data || {};
      const more = data?.biometricLogs || [];
      setBioLogs((prev) => [...prev, ...more]);
      setBioMeta(data?.biometricMeta || null);
      setBioPage(nextPage);
    } catch (e) {
      swalError("Failed to load more biometrics");
    } finally {
      setBioLoading(false);
    }
  };

  const exportBiometricsCSV = () => {
    try {
      // Apply time-of-day filter to current bioLogs
      const rows = (bioLogs || []).filter((r) => {
        const t = r?.Time ? dayjs(r.Time) : null;
        if (!t) return false;
        // Date range filter (client-side visual filter as extra guard)
        if (bioRange && bioRange[0] && bioRange[1]) {
          if (!t.isBetween(bioRange[0], bioRange[1], "day", "[]")) return false;
        }
        // Time-of-day filter
        if (bioTimeFrom || bioTimeTo) {
          const minutes = t.hour() * 60 + t.minute();
          const startM = bioTimeFrom
            ? bioTimeFrom.hour() * 60 + bioTimeFrom.minute()
            : null;
          const endM = bioTimeTo
            ? bioTimeTo.hour() * 60 + bioTimeTo.minute()
            : null;
          if (startM !== null && minutes < startM) return false;
          if (endM !== null && minutes > endM) return false;
        }
        return true;
      });
      const header = ["AC-No", "Name", "Time", "State"];
      const lines = [header.join(",")].concat(
        rows.map((r) =>
          [
            JSON.stringify(r["AC-No"] || ""),
            JSON.stringify(r["Name"] || ""),
            JSON.stringify(
              r["Time"] ? dayjs(r["Time"]).format("YYYY-MM-DD HH:mm") : ""
            ),
            JSON.stringify(r["State"] || ""),
          ].join(",")
        )
      );
      const blob = new Blob([lines.join("\n")], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${resignedSelected?.empId || "employee"}-biometrics.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      swalError("Failed to export CSV");
    }
  };

  const restoreResignedEmployee = async (emp) => {
    try {
      await axiosInstance.put(`/employees/${emp._id}/undo-resign`);
      swalSuccess("Employee restored (with records)");
      // refresh lists
      loadResignedEmployees();
      if (activeTab === "employees") loadAllEmployees();
      setResignedDetailsOpen(false);
      setResignedSelected(null);
    } catch (err) {
      swalError("Failed to restore employee");
    }
  };

  const deleteResignedEmployee = async (emp) => {
    try {
      // Fetch a fresh summary right before deleting
      const summaryRes = await axiosInstance.get(
        `/employees/${emp._id}/records`
      );
      const s = summaryRes?.data?.data || {};
      const summaryText = [
        `Docs: ${(s.docs || []).length}`,
        `Payslip Requests: ${(s.payslipRequests || []).length}`,
        `DTR Gen Logs: ${(s.dtrGenerationLogs || []).length}`,
        `Biometric Logs: ${(s.biometricLogs || []).length}`,
        `DTR Requests: ${(s.dtrRequests || []).length}`,
        `Salary: ${s.salary ? "Yes" : "No"}`,
        `Trainings: ${(s.trainings || []).length}`,
      ].join(" | ");
      const result = await swalConfirm({
        title: `Delete ${emp.name}?`,
        text: `This will permanently remove the employee and all linked records. Emp No will be reordered.\n\n${summaryText}`,
        confirmText: "Yes, delete",
        cancelText: "Cancel",
        dangerMode: true,
      });
      if (result.isConfirmed) {
        await axiosInstance.delete(`/employees/${emp._id}`);
        swalSuccess(
          "Employee and related records deleted; Emp No reordered"
        );
        loadResignedEmployees();
        if (activeTab === "employees") loadAllEmployees();
        setResignedDetailsOpen(false);
        setResignedSelected(null);
      }
    } catch (err) {
      swalError(
        err?.response?.data?.message || "Failed to delete employee"
      );
    }
  };

  const openResignModal = (emp) => {
    setSelectedEmployee(emp);
    resignForm.setFieldsValue({ resignedAt: dayjs(), reason: "" });
    setResignModalOpen(true);
  };

  const handleResignSubmit = async () => {
    try {
      if (!selectedEmployee) return;
      const values = await resignForm.validateFields();
      const payload = {
        resignedAt: values?.resignedAt
          ? dayjs(values.resignedAt).toISOString()
          : dayjs().toISOString(),
        reason: values?.reason || "",
      };
      await axiosInstance.put(
        `/employees/${selectedEmployee._id}/resign`,
        payload
      );
      swalSuccess("Employee marked as resigned");
      setResignModalOpen(false);
      setSelectedEmployee(null);
      resignForm.resetFields();
      // Refresh lists
      loadAllEmployees();
      // Also refresh resigned tab data in case it is viewed next
      loadResignedEmployees();
    } catch (err) {
      swalError(
        err?.response?.data?.message || "Failed to mark employee as resigned"
      );
    }
  };

  const handleUndoResign = async (emp) => {
    try {
      const target = emp || selectedEmployee;
      if (!target) return;
      await axiosInstance.put(`/employees/${target._id}/undo-resign`);
      swalSuccess("Employee restored");
      // Refresh lists
      loadAllEmployees();
      loadResignedEmployees();
    } catch (err) {
      swalError(err?.response?.data?.message || "Failed to undo resign");
    }
  };

  const closeEditModal = () => {
    setEditingRow(null);
    editForm.resetFields();
    setEditModalVisible(false);
  };

  const handleUpdateNotification = async () => {
    try {
      const values = await editForm.validateFields();
      await axiosInstance.put(`/dev/notifications/${editingRow._id}`, values);
      swalSuccess("Notification updated");
      closeEditModal();
      fetchNotifications();
    } catch (err) {
      swalError("Failed to update notification");
    }
  };

  const removeNotification = async (row) => {
    try {
      await axiosInstance.delete(`/dev/notifications/${row._id}`);
      swalSuccess("Notification deleted");
      try {
        const { setNotifications: setGlobalNotifications } =
          notificationsContext || {};
        if (typeof setGlobalNotifications === "function") {
          setGlobalNotifications((prev) =>
            prev.filter((n) => (n._id || n.id) !== (row._id || row.id))
          );
        }
      } catch (e) {}
    } catch (err) {
      swalError("Failed to delete notification");
    }
  };

  const markDataRequestRead = async (row) => {
    try {
      if (row._source === "payslip") {
        await axiosInstance.put(`/payslip-requests/${row._id}/read`);
      } else if (row._source === "dtr") {
        await axiosInstance.put(`/dtr-requests/${row._id}/read`);
      }
      swalSuccess("Marked as read");
      fetchNotifications();
    } catch (err) {
      swalError("Failed to mark as read");
    }
  };

  // Audit logs
  const fetchAuditLogs = async (
    page = auditPage,
    limit = auditPageSize,
    opts = {}
  ) => {
    try {
      setAuditLoading(true);
      const params = { page, limit };
      const acts = opts.actions ?? auditActionsFilter;
      const usr = opts.user ?? auditUserFilter;
      const range = opts.dateRange ?? auditDateRange;
      const sortBy = opts.sortBy ?? auditSortBy;
      const sortOrder = opts.sortOrder ?? auditSortOrder;
      if (Array.isArray(acts) && acts.length > 0) params.actions = acts;
      if (usr && usr !== "all") params.user = usr;
      if (range && range.length === 2) {
        params.dateFrom = range[0]?.toISOString?.() || range[0];
        params.dateTo = range[1]?.toISOString?.() || range[1];
      }
      if (sortBy) params.sortBy = sortBy;
      if (sortOrder) params.sortOrder = sortOrder;
      const detailsFragment =
        opts.detailsFragment !== undefined
          ? opts.detailsFragment
          : auditDetailsQuery;
      if (detailsFragment) params.detailsFragment = detailsFragment;

      const res = await axiosInstance.get("/dev/audit-logs", { params });
      const rows = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];
      setAuditLogs(rows);
      if (typeof res.data?.total === "number") setAuditTotal(res.data.total);
      setAuditPage(page);
      setAuditPageSize(limit);
    } catch (err) {
      swalError("Failed to load audit logs");
    } finally {
      setAuditLoading(false);
    }
  };

  const auditActionOptions = useMemo(() => {
    // derive unique actions from current page, plus currently selected to keep them visible
    const set = new Set((auditLogs || []).map((a) => a.action).filter(Boolean));
    (auditActionsFilter || []).forEach((v) => set.add(v));
    return Array.from(set)
      .sort()
      .map((v) => ({ label: v, value: v }));
  }, [auditLogs, auditActionsFilter]);

  const auditUserOptions = useMemo(() => {
    const set = new Set(
      (auditLogs || []).map((a) => a.performedByName).filter(Boolean)
    );
    return [
      { label: "All Users", value: "all" },
      ...Array.from(set)
        .sort()
        .map((v) => ({ label: v, value: v })),
    ];
  }, [auditLogs]);

  // With server-side filtering, table rows are the server result
  const filteredAuditLogs = auditLogs;

  const exportAuditCsv = () => {
    const rows = filteredAuditLogs;
    const headers = ["Action", "By", "CreatedAt", "Details"];
    const lines = [headers.join(",")];
    for (const r of rows) {
      const vals = [
        r.action || "",
        r.performedByName || "",
        r.createdAt ? dayjs(r.createdAt).format("YYYY-MM-DD HH:mm:ss") : "",
        JSON.stringify(r.details || {}),
      ];
      const esc = (s) => '"' + String(s).replace(/"/g, '""') + '"';
      lines.push(vals.map(esc).join(","));
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${dayjs().format("YYYYMMDD-HHmmss")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAuditCsvServer = () => {
    const params = new URLSearchParams();
    if (Array.isArray(auditActionsFilter) && auditActionsFilter.length > 0) {
      auditActionsFilter.forEach((a) => params.append('actions', a));
    }
    if (auditUserFilter && auditUserFilter !== 'all') params.set('user', auditUserFilter);
    if (auditDateRange && auditDateRange.length === 2) {
      params.set('dateFrom', auditDateRange[0]?.toISOString?.() || auditDateRange[0]);
      params.set('dateTo', auditDateRange[1]?.toISOString?.() || auditDateRange[1]);
    }
    if (auditSortBy) params.set('sortBy', auditSortBy);
    if (auditSortOrder) params.set('sortOrder', auditSortOrder);
    if (auditDetailsQuery) params.set('detailsFragment', auditDetailsQuery);
    const base = window.location.origin;
    const url = `${base}/api/dev/audit-logs/export?${params.toString()}`;
    window.open(url, '_blank');
  };

  const tagColorForAction = (action) => {
    if (!action) return "default";
    const key = String(action).split(":")[0];
    switch (key) {
      case "backup":
        return "geekblue";
      case "notification":
        return "purple";
      case "audit":
        return "gold";
      case "user":
        return "cyan";
      case "demo":
        return "magenta";
      default:
        return "blue";
    }
  };

  // Notifications helpers: aggregate Payslip and DTR requests
  const fetchNotifications = async () => {
    try {
      setNotifLoading(true);
      const [ps, dtr] = await Promise.all([
        axiosInstance.get("/payslip-requests"),
        axiosInstance.get("/dtr-requests"),
      ]);

      const payslipsRaw = Array.isArray(ps.data?.data)
        ? ps.data.data
        : Array.isArray(ps.data)
        ? ps.data
        : [];
      const dtrRaw = Array.isArray(dtr.data?.data)
        ? dtr.data.data
        : Array.isArray(dtr.data)
        ? dtr.data
        : [];

      const payslips = (payslipsRaw || []).map((r) => ({
        ...r,
        _id: r._id || r.id,
        _source: "payslip",
        title: `Payslip Request - ${r.employeeId || ""}`,
        body: `Period: ${r.period || ""}${r.email ? ` | ${r.email}` : ""}`,
      }));
      const dtrs = (dtrRaw || []).map((r) => ({
        ...r,
        _id: r._id || r.id,
        _source: "dtr",
        title: `DTR Request - ${r.employeeId || ""}`,
        body: `${
          r.startDate ? dayjs(r.startDate).format("MM/DD/YYYY") : ""
        } - ${r.endDate ? dayjs(r.endDate).format("MM/DD/YYYY") : ""}${
          r.email ? ` | ${r.email}` : ""
        }`,
      }));

      const merged = [...payslips, ...dtrs].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
      // De-duplicate by source+id to avoid redundant rows
      const seen = new Set();
      const unique = [];
      for (const it of merged) {
        const key = `${it._source || "dev"}:${it._id || it.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(it);
        }
      }
      setNotifications(unique);
    } catch (err) {
      swalError("Failed to load requests");
    } finally {
      setNotifLoading(false);
    }
  };

  const toggleNotificationHidden = async (row) => {
    try {
      if (row._source === "payslip") {
        await axiosInstance.put(`/payslip-requests/${row._id}`, {
          hidden: !row.hidden,
        });
      } else if (row._source === "dtr") {
        await axiosInstance.put(`/dtr-requests/${row._id}`, {
          hidden: !row.hidden,
        });
      } else {
        await axiosInstance.put(`/dev/notifications/${row._id}`, {
          hidden: !row.hidden,
        });
      }
      swalSuccess("Visibility updated");
      fetchNotifications();
    } catch (err) {
      swalError("Failed to update visibility");
    }
  };

  const toggleDataVisibility = async (row) => {
    try {
      await axiosInstance.put(`/dev/notifications/${row._id}`, {
        dataVisible: !row.dataVisible,
      });
      swalSuccess("Data visibility updated");
      fetchNotifications();
    } catch (err) {
      swalError("Failed to update data visibility");
    }
  };

  const openEditModal = (row) => {
    setEditingRow(row);
    editForm.setFieldsValue({ title: row.title || "", body: row.body || "" });
    setEditModalVisible(true);
  };

  // Bug Reports helpers
  const fetchBugReports = async (
    page = bugPage,
    limit = bugPageSize,
    opts = {}
  ) => {
    try {
      setBugLoading(true);
      const params = { page, limit };
      const status = opts.status ?? bugStatusFilter;
      const q = opts.q ?? bugQuery;
      if (status && status !== "all") params.status = status;
      if (q && q.trim()) params.q = q.trim();
      const res = await axiosInstance.get("/bug-report", { params });
      const rows = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];
      setBugReports(rows);
      if (typeof res.data?.total === "number") setBugTotal(res.data.total);
      setBugPage(page);
      setBugPageSize(limit);
    } catch (e) {
      swalError(e?.response?.data?.message || "Failed to load bug reports");
    } finally {
      setBugLoading(false);
    }
  };

  const toggleBugResolved = async (row) => {
    try {
      const next = row.status === "resolved" ? "open" : "resolved";
      await axiosInstance.patch(`/bug-report/${row._id}`, { status: next });
      swalSuccess(next === "resolved" ? "Marked resolved" : "Reopened");
      fetchBugReports(bugPage, bugPageSize);
    } catch (e) {
      swalError(e?.response?.data?.message || "Failed to update status");
    }
  };

  const removeBugReport = async (row) => {
    try {
      await axiosInstance.delete(`/bug-report/${row._id}`);
      swalSuccess("Deleted");
      fetchBugReports(bugPage, bugPageSize);
    } catch (e) {
      swalError(e?.response?.data?.message || "Failed to delete bug report");
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get("/dev/config");
        if (!mounted) return;
        setDevInfo(res.data);
      } catch (err) {
        if (!mounted) return;
        setError(
          err?.response?.data?.message ||
            err.message ||
            "Failed to load dev settings"
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };
    if (canSeeDev) load();
    return () => {
      mounted = false;
    };
  }, [canSeeDev]);

  // Load employees when Employees tab opens
  useEffect(() => {
    if (activeTab === "employees" && canSeeDev) {
      loadAllEmployees();
    }
  }, [activeTab, canSeeDev]);

  // Auto-load data for Audit Logs and Notifications when their tabs open
  useEffect(() => {
    if (!canSeeDev) return;
    if (activeTab === "audit-logs") {
      fetchAuditLogs();
    } else if (activeTab === "notifications") {
      fetchNotifications();
    } else if (activeTab === "db-maintenance") {
      // Prefetch resigned employees so the table isn't empty on first open
      loadResignedEmployees();
    } else if (activeTab === "bug-reports") {
      fetchBugReports();
    }
  }, [activeTab, canSeeDev]);

  // Derive dropdown options from employees data
  const employeeDivisionOptions = useMemo(() => {
    const vals = Array.from(
      new Set((employees || []).map((e) => e.division).filter(Boolean))
    );
    return [
      { label: "All Divisions", value: "all" },
      ...vals.map((v) => ({ label: v, value: v })),
    ];
  }, [employees]);

  const employeeSectionOptions = useMemo(() => {
    const vals = Array.from(
      new Set((employees || []).map((e) => e.sectionOrUnit).filter(Boolean))
    );
    return [
      { label: "All Sections/Units", value: "all" },
      ...vals.map((v) => ({ label: v, value: v })),
    ];
  }, [employees]);

  const employeeTypeOptions = useMemo(() => {
    const vals = Array.from(
      new Set((employees || []).map((e) => e.empType).filter(Boolean))
    );
    return [
      { label: "All Types", value: "all" },
      ...vals.map((v) => ({ label: v, value: v })),
    ];
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const nameQ = empFilterName.trim().toLowerCase();
    const idQ = empFilterEmpId.trim().toLowerCase();
    const noQ = empFilterEmpNo.trim().toLowerCase();
    return (employees || []).filter((e) => {
      const nameOk = !nameQ || (e.name || "").toLowerCase().includes(nameQ);
      const idOk =
        !idQ ||
        String(e.empId || "")
          .toLowerCase()
          .includes(idQ);
      const noOk =
        !noQ ||
        String(e.empNo || "")
          .toLowerCase()
          .includes(noQ);
      const divOk =
        empFilterDivision === "all" || (e.division || "") === empFilterDivision;
      const secOk =
        empFilterSection === "all" ||
        (e.sectionOrUnit || "") === empFilterSection;
      const typeOk =
        empFilterType === "all" || (e.empType || "") === empFilterType;
      const statusOk =
        empFilterStatus === "all" ||
        (empFilterStatus === "active" ? !e.isResigned : !!e.isResigned);
      return nameOk && idOk && noOk && divOk && secOk && typeOk && statusOk;
    });
  }, [
    employees,
    empFilterName,
    empFilterEmpId,
    empFilterEmpNo,
    empFilterDivision,
    empFilterSection,
    empFilterType,
    empFilterStatus,
  ]);

  useEffect(() => {
    let mounted = true;
    const loadSettings = async () => {
      try {
        setSettingsLoading(true);
        const res = await axiosInstance.get("/settings");
        if (!mounted) return;
        setSettings(res.data);
      } catch (err) {
        if (!mounted) return;
        setSettingsError(
          err?.response?.data?.message ||
            err.message ||
            "Failed to load application settings"
        );
      } finally {
        if (mounted) setSettingsLoading(false);
      }
    };
    if (canSeeDev) loadSettings();
    return () => {
      mounted = false;
    };
  }, [canSeeDev, form]);

  // Populate form values when the settings are loaded and the tab is active/mounted
  useEffect(() => {
    if (activeTab === "app-settings" && settings) {
      form.setFieldsValue(settings);
    }
  }, [activeTab, settings, form]);

  if (!canSeeDev) {
    return (
      <Alert
        type="warning"
        message="Insufficient permissions"
        description="You don't have access to Developer Settings."
        showIcon
      />
    );
  }

  // Allow deep-link to tabs via ?tab=... (supports aliases)
  useEffect(() => {
    const t = (searchParams.get("tab") || "").toLowerCase();
    const normalize = (k) => {
      switch (k) {
        case "runtime":
        case "employees":
        case "attendance-preview":
        case "db-maintenance":
        case "app-settings":
        case "demo-mode":
        case "secure-storage":
        case "audit-logs":
        case "notifications":
        case "bug-reports":
          return k;
        // Aliases for Bug Reports
        case "bugs":
        case "bug":
        case "report-bugs":
        case "report-bug":
          return "bug-reports";
        default:
          return null;
      }
    };
    const next = normalize(t);
    if (next) {
      setActiveTab(next);
      if (!didInitFromUrl) setDidInitFromUrl(true);
    }
  }, [searchParams]);

  // Keep URL synced with current tab for easy sharing
  useEffect(() => {
    if (!didInitFromUrl) return; // avoid overwriting initial URL param on first mount
    try {
      const curr = searchParams.get("tab");
      if (curr !== activeTab) setSearchParams({ tab: activeTab });
    } catch (_) {}
  }, [activeTab, didInitFromUrl]);

  if (error) {
    return (
      <Alert
        type="error"
        message="Failed to load Developer Settings"
        description={error}
        showIcon
      />
    );
  }

  const onSaveSettings = async (values) => {
    try {
      await axiosInstance.put("/settings", values);
      swalSuccess("Settings updated");
      setSettings(values);
      // Notify ThemeContext to re-fetch and apply CSS variables
      window.dispatchEvent(new Event("app-settings-updated"));
    } catch (err) {
      swalError(
        err?.response?.data?.message ||
          err.message ||
          "Failed to update settings"
      );
    }
  };

  const [smtpForm] = Form.useForm();
  const onSaveSmtp = async (vals) => {
    try {
      const payload = {
        ...(settings || {}),
        smtp: { ...(settings?.smtp || {}), ...vals },
      };
      const res = await axiosInstance.put("/settings", payload);
      setSettings(res.data);
      swalSuccess("SMTP settings saved");
    } catch (e) {
      swalError(e?.response?.data?.message || "Failed to save SMTP");
    }
  };
  const [testingSmtp, setTestingSmtp] = useState(false);
  const testSmtp = async () => {
    try {
      const vals = smtpForm.getFieldsValue();
      setTestingSmtp(true);
      const res = await axiosInstance.post("/dev/test-smtp", vals);
      if (res.data?.success) {
        swalSuccess(`SMTP test sent to ${res.data.to}`);
      } else {
        swalError(res.data?.message || "SMTP test failed");
      }
    } catch (e) {
      swalError(e?.response?.data?.message || "SMTP test failed");
    } finally {
      setTestingSmtp(false);
    }
  };

  const runtimeCardStyle = { height: "100%" };
  const cardBodySmall = { padding: 12 };
  const descCommon = {
    size: "small",
    column: 1,
    bordered: true,
    labelStyle: { fontSize: 12, width: 140 },
    contentStyle: { fontSize: 12 },
  };

  // Client session/runtime monitoring
  const [clientRuntime, setClientRuntime] = useState(() => {
    const tokenSess = secureSessionGet("token");
    const tokenLocal = secureRetrieve("token");
    // Generate per-tab id once and keep in sessionStorage
    let tabId = null;
    try {
      tabId = secureSessionGet("__tab_id");
      if (!tabId) {
        tabId = `tab-${Math.random().toString(36).slice(2, 10)}`;
        secureSessionStore("__tab_id", tabId);
      }
    } catch {}
    return {
      storage: tokenSess ? "sessionStorage" : tokenLocal ? "localStorage (legacy)" : "none",
      tokenPresent: Boolean(tokenSess || tokenLocal),
      tabId,
      socketConnected: socket?.connected || false,
      socketTransport: (() => {
        try { return socket?.io?.engine?.transport?.name || "n/a"; } catch { return "n/a"; }
      })(),
    };
  });

  useEffect(() => {
    const update = () => {
      const tokenSess = secureSessionGet("token");
      const tokenLocal = secureRetrieve("token");
      setClientRuntime((prev) => ({
        ...prev,
        storage: tokenSess ? "sessionStorage" : tokenLocal ? "localStorage (legacy)" : "none",
        tokenPresent: Boolean(tokenSess || tokenLocal),
        socketConnected: socket?.connected || false,
        socketTransport: (() => {
          try { return socket?.io?.engine?.transport?.name || "n/a"; } catch { return "n/a"; }
        })(),
      }));
    };
    const onConnect = () => update();
    const onDisconnect = () => update();
    try {
      socket?.on?.("connect", onConnect);
      socket?.on?.("disconnect", onDisconnect);
    } catch {}
    const id = window.setInterval(update, 2000);
    return () => {
      try { socket?.off?.("connect", onConnect); } catch {}
      try { socket?.off?.("disconnect", onDisconnect); } catch {}
      window.clearInterval(id);
    };
  }, []);

  const runtimeTab = (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Row gutter={[12, 12]}>
        <Col xs={24} md={12}>
          <Card
            size="small"
            title={
              <Space size={8} align="center">
                <AppstoreOutlined />
                <span>Application</span>
              </Space>
            }
            style={runtimeCardStyle}
            bodyStyle={cardBodySmall}
            extra={
              <Space size={8} wrap>
                {loading || !devInfo ? null : (
                  <Tag>{String(devInfo.app.env || "").toUpperCase() || "ENV"}</Tag>
                )}
                <Button size="small" icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
                  Reload
                </Button>
              </Space>
            }
          >
            {loading || !devInfo ? (
              <Card loading size="small" />
            ) : (
              <Descriptions {...descCommon}>
                <Descriptions.Item label="Node">{devInfo.app.node}</Descriptions.Item>
                <Descriptions.Item label="Env">{devInfo.app.env}</Descriptions.Item>
                <Descriptions.Item label="Server Host">{devInfo.app.serverHost}</Descriptions.Item>
                <Descriptions.Item label="Server Port">{devInfo.app.serverPort}</Descriptions.Item>
                <Descriptions.Item label="Client Origin">
                  {devInfo.app.clientOrigin || <Tag>not set</Tag>}
                </Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            size="small"
            title={
              <Space size={8} align="center">
                <DatabaseOutlined />
                <span>Database</span>
              </Space>
            }
            style={runtimeCardStyle}
            bodyStyle={cardBodySmall}
            extra={
              loading || !devInfo ? null : (
                <Tag color={devInfo.db.connected ? "green" : "red"}>
                  {devInfo.db.connected ? "Connected" : "Disconnected"}
                </Tag>
              )
            }
          >
            {loading || !devInfo ? (
              <Card loading size="small" />
            ) : (
              <Descriptions {...descCommon}>
                <Descriptions.Item label="Name">
                  {devInfo.db.name || <Tag>unknown</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="Host">
                  {devInfo.db.host || <Tag>unknown</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="Port">
                  {devInfo.db.port || <Tag>unknown</Tag>}
                </Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} md={12}>
          <Card
            size="small"
            title={
              <Space size={8} align="center">
                <MailOutlined />
                <span>Email (SMTP)</span>
              </Space>
            }
            style={runtimeCardStyle}
            bodyStyle={cardBodySmall}
          >
            {loading || !settings ? (
              <Card loading size="small" />
            ) : (
              <Form
                form={smtpForm}
                size="small"
                layout="vertical"
                initialValues={{
                  host: settings?.smtp?.host,
                  port: settings?.smtp?.port,
                  secure: settings?.smtp?.secure,
                  user: settings?.smtp?.user,
                  fromEmail: settings?.smtp?.fromEmail,
                  fromName: settings?.smtp?.fromName,
                }}
                onFinish={onSaveSmtp}
              >
                <Row gutter={[8, 8]}>
                  <Col span={16}>
                    <Form.Item
                      name="host"
                      label="Host"
                      rules={[
                        {
                          validator: (_, v) => {
                            if (!v) return Promise.resolve();
                            const ok = /^[A-Za-z0-9.-]+$/.test(v);
                            return ok
                              ? Promise.resolve()
                              : Promise.reject(new Error("Invalid host name"));
                          },
                        },
                      ]}
                    >
                      <Input placeholder="smtp.gmail.com" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="port"
                      label="Port"
                      rules={[
                        {
                          validator: (_, v) => {
                            if (v == null || v === "") return Promise.resolve();
                            const n = Number(v);
                            if (!Number.isFinite(n) || n <= 0 || n > 65535)
                              return Promise.reject(
                                new Error("Port must be 1-65535")
                              );
                            return Promise.resolve();
                          },
                        },
                      ]}
                    >
                      <InputNumber
                        style={{ width: "100%" }}
                        placeholder={465}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="secure"
                      label="Secure (SSL/TLS)"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="user"
                      label="User"
                      rules={[
                        {
                          type: "email",
                          message: "Provide a valid email user",
                        },
                      ]}
                    >
                      <Input placeholder="email user (no password here)" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="fromName" label="From Name">
                      <Input placeholder="EMBR3 System" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="fromEmail"
                      label="From Email"
                      rules={[
                        { type: "email", message: "Invalid email address" },
                      ]}
                    >
                      <Input placeholder="noreply@domain" />
                    </Form.Item>
                  </Col>
                </Row>
                <Space>
                  <Button type="primary" htmlType="submit" size="small">
                    Save SMTP
                  </Button>
                  <Button size="small" onClick={testSmtp} loading={testingSmtp}>
                    Test SMTP
                  </Button>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Password stays in server env (EMAIL_PASS).
                  </Text>
                </Space>
                {settings?.smtp?.updatedAt && (
                  <Text
                    type="secondary"
                    style={{ fontSize: 11, display: "block", marginTop: 4 }}
                  >
                    Last Updated:{" "}
                    {dayjs(settings.smtp.updatedAt).format("MMM D, YYYY HH:mm")}{" "}
                    | Effective From:{" "}
                    {settings.smtp.fromName ||
                      settings.general?.appName ||
                      "EMBR3 System"}{" "}
                    &lt;
                    {settings.smtp.fromEmail || settings.smtp.user || "not set"}
                    &gt;
                  </Text>
                )}
              </Form>
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            size="small"
            title={
              <Space size={8} align="center">
                <CloudOutlined />
                <span>Google Drive</span>
              </Space>
            }
            style={runtimeCardStyle}
            bodyStyle={cardBodySmall}
            extra={
              loading || !devInfo ? null : devInfo.google.configured ? (
                <Tag icon={<CheckCircleOutlined />} color="green">
                  Configured
                </Tag>
              ) : (
                <Tag icon={<CloseCircleOutlined />} color="red">
                  Not Configured
                </Tag>
              )
            }
          >
            {loading || !devInfo ? (
              <Card loading size="small" />
            ) : (
              <>
                <Descriptions {...descCommon}>
                  <Descriptions.Item label="Service Account Key">
                    {devInfo.google.serviceAccountKey || <Tag>not set</Tag>}
                  </Descriptions.Item>
                  <Descriptions.Item label="Configured">
                    {devInfo.google.configured ? (
                      <Tag color="green">yes</Tag>
                    ) : (
                      <Tag color="red">no</Tag>
                    )}
                  </Descriptions.Item>
                </Descriptions>
                <Divider style={{ margin: "8px 0" }} />
                <Space style={{ marginBottom: 8, flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    onClick={navigateDriveRoot}
                    loading={driveLoading}
                  >
                    Load Files
                  </Button>
                  {(isDriveProvider ? driveFolderStack.length > 0 : !!drivePath) && (
                    <Button
                      size="small"
                      onClick={navigateDriveUp}
                      disabled={driveLoading}
                    >
                      Up
                    </Button>
                  )}
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {isDriveProvider
                      ? `/ ${driveFolderStack.map((f) => f.name).join(' / ') || '(root)'}`
                      : `Folder: ${drivePath || '(root)'}`}
                  </Text>
                </Space>
                <Table
                  className="compact-table"
                  size="small"
                  dataSource={driveFiles}
                  loading={driveLoading}
                  rowKey={(r) => r.id || r._id || r.localPath || r.name}
                  pagination={{
                    current: drivePage,
                    pageSize: drivePageSize,
                    total: (driveFiles || []).length,
                    showSizeChanger: true,
                    pageSizeOptions: [5, 10, 20, 50],
                    onChange: (page, pageSize) => {
                      const nextSize = pageSize || drivePageSize;
                      const sizeChanged = nextSize !== drivePageSize;
                      setDrivePageSize(nextSize);
                      setDrivePage(sizeChanged ? 1 : page);
                    },
                  }}
                  columns={[
                    {
                      title: "Name",
                      dataIndex: "name",
                      key: "name",
                      render: (v, r) => {
                        const isDriveFolder = r.mimeType === 'application/vnd.google-apps.folder';
                        // Drive folder — click to navigate into it
                        if (isDriveFolder && r.id) {
                          return (
                            <a onClick={() => navigateDriveFolder(r.id, v || r.id)} style={{ cursor: 'pointer' }}>{v || r.id}</a>
                          );
                        }
                        // Drive file link
                        if (r.webViewLink) {
                          return (
                            <a href={r.webViewLink} target="_blank" rel="noreferrer">{v || r.id}</a>
                          );
                        }
                        // Local directory navigation
                        if (r.isDirectory && r.localPath) {
                          const next = r.localPath.replace(/^uploads\//, '');
                          return (
                            <a onClick={() => { setDrivePath(next); fetchDriveFiles(next); }} style={{ cursor: 'pointer' }}>{v}</a>
                          );
                        }
                        return v || r.id;
                      },
                    },
                    {
                      title: "Type",
                      dataIndex: "mimeType",
                      key: "mimeType",
                      width: 180,
                      render: (v, r) => {
                        if (r?.isDirectory || v === 'application/vnd.google-apps.folder') return 'folder';
                        return v || (r?.localPath ? (r.name?.split('.').pop() || 'file') : '');
                      },
                    },
                    {
                      title: "Size",
                      dataIndex: "size",
                      key: "size",
                      width: 100,
                      render: (s, r) => (r?.isDirectory || r?.mimeType === 'application/vnd.google-apps.folder') ? '-' : (s ? `${Number(s).toLocaleString()} B` : ''),
                    },
                    {
                      title: "Created",
                      dataIndex: "createdTime",
                      key: "createdTime",
                      width: 160,
                      render: (v) => v ? dayjs(v).format("YYYY-MM-DD HH:mm") : "",
                    },
                    {
                      title: "Action",
                      key: "action",
                      width: 140,
                      render: (_, r) => (
                        <Space>
                          {r.webViewLink && (
                            <Button
                              size="small"
                              onClick={() =>
                                window.open(r.webViewLink, "_blank")
                              }
                            >
                              Open
                            </Button>
                          )}
                          {r.id && (
                            <Button
                              size="small"
                              onClick={() =>
                                window.open(`/api/uploads/${r.id}`, "_blank")
                              }
                            >
                              Download
                            </Button>
                          )}
                          {/* Local provider: show download for files (skip likely directories with size 0) */}
                          {!r.webViewLink && !r.id && r.localPath && (Number(r.size) || 0) > 0 && (
                            <Button
                              size="small"
                              onClick={() =>
                                window.open(`/uploads/${r.localPath}`, "_blank")
                              }
                            >
                              Download
                            </Button>
                          )}
                        </Space>
                      ),
                    },
                  ]}
                />
                <Text
                  type="secondary"
                  style={{ fontSize: 11, display: "block", marginTop: 6 }}
                >
                  To enable listing, use a Google Service Account and share the
                  folder with it; avoid putting a Google account password in
                  .env.
                </Text>
              </>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} md={12}>
          <Card
            size="small"
            title={
              <Space size={8} align="center">
                <ApiOutlined />
                <span>Socket.IO</span>
              </Space>
            }
            style={runtimeCardStyle}
            bodyStyle={cardBodySmall}
          >
            {loading || !devInfo ? (
              <Card loading size="small" />
            ) : (
              <Descriptions {...descCommon}>
                <Descriptions.Item label="Path">
                  {devInfo.socket.path}
                </Descriptions.Item>
                <Descriptions.Item label="Ping Interval">
                  {devInfo.socket.pingInterval} ms
                </Descriptions.Item>
                <Descriptions.Item label="Ping Timeout">
                  {devInfo.socket.pingTimeout} ms
                </Descriptions.Item>
                <Descriptions.Item label="CORS Origin">
                  {String(devInfo.socket.corsOrigin)}
                </Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            size="small"
            title={
              <Space size={8} align="center">
                <DesktopOutlined />
                <span>Client Session</span>
              </Space>
            }
            style={runtimeCardStyle}
            bodyStyle={cardBodySmall}
            extra={
              <Space size={4}>
                <Tag color={clientRuntime.socketConnected ? "green" : "red"}>
                  Socket {clientRuntime.socketConnected ? "Connected" : "Disconnected"}
                </Tag>
                <Button
                  size="small"
                  type={clientRuntime.socketConnected ? "default" : "primary"}
                  danger={clientRuntime.socketConnected}
                  icon={clientRuntime.socketConnected ? <CloseCircleOutlined /> : <ApiOutlined />}
                  onClick={() => {
                    if (clientRuntime.socketConnected) {
                      socket.disconnect();
                      swalInfo("Socket disconnected.");
                    } else {
                      socket.connect();
                      socket.once("connect", () => {
                        if (user) socket.emit("store-user", user);
                        swalSuccess("Socket reconnected!");
                      });
                    }
                  }}
                >
                  {clientRuntime.socketConnected ? "Disconnect" : "Connect"}
                </Button>
              </Space>
            }
          >
            <Descriptions {...descCommon}>
              <Descriptions.Item label="Auth Storage">
                {clientRuntime.storage}
              </Descriptions.Item>
              <Descriptions.Item label="Token Present">
                {clientRuntime.tokenPresent ? <Tag color="green">yes</Tag> : <Tag color="red">no</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Tab ID">
                {clientRuntime.tabId || <Tag>n/a</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Socket Connected">
                {clientRuntime.socketConnected ? <Tag color="green">yes</Tag> : <Tag color="red">no</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Socket Transport">
                {clientRuntime.socketTransport}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} md={24}>
          <Card
            size="small"
            title={
              <Space size={8} align="center">
                <InfoCircleOutlined />
                <span>Notes</span>
              </Space>
            }
            style={runtimeCardStyle}
            bodyStyle={cardBodySmall}
          >
            <Space direction="vertical" style={{ width: "100%" }}>
              <Alert
                type="info"
                showIcon
                message="Sensitive values are intentionally omitted"
                description={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Passwords, tokens, and full URIs are not shown in this view.
                  </Text>
                }
              />
              <Button size="small" onClick={() => setDeploymentModalOpen(true)}>
                Deployment (UAT) Notes
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  );

  // Deployment notes modal state
  const [deploymentModalOpen, setDeploymentModalOpen] = useState(false);
  const [deploymentNotes, setDeploymentNotes] = useState("");
  const [loadingDeployment, setLoadingDeployment] = useState(false);
  useEffect(() => {
    const loadNotes = async () => {
      if (!deploymentModalOpen) return;
      try {
        setLoadingDeployment(true);
        const res = await axiosInstance.get("/dev/deployment-notes");
        if (res.data?.success) setDeploymentNotes(res.data.content || "");
        else setDeploymentNotes(res.data?.message || "Not available");
      } catch (e) {
        setDeploymentNotes(
          e?.response?.data?.message || "Failed to load notes"
        );
      } finally {
        setLoadingDeployment(false);
      }
    };
    loadNotes();
  }, [deploymentModalOpen]);

  const fetchAttendancePreview = async (range) => {
    try {
      setAttendanceLoading(true);
      // Use provided range or fallback to saved attendanceRange in state
      const r = range || attendanceRange;
      if (!r || r.length !== 2) {
        swalWarning("Please select a start and end date to preview.");
        setAttendanceData([]);
        return;
      }

      const params = {
        startDate: r[0].startOf("day").toISOString(),
        endDate: r[1].endOf("day").toISOString(),
      };

      console.debug("Attendance preview params:", params);
      const res = await axiosInstance.get("/dtr/recent-daily-attendance", {
        params,
      });

      console.debug("Attendance preview response:", res);
      const payload = res?.data;
      let rows = [];
      if (payload) {
        if (Array.isArray(payload)) rows = payload;
        else if (payload.data && Array.isArray(payload.data))
          rows = payload.data;
      }

      // Normalize and format values for display
      const formatted = rows.map((row) => ({
        empId: row.empId || row.empId || row.acNo || "-",
        name: row.name || "-",
        date: row.date ? dayjs(row.date).format("MM/DD/YYYY") : row.date || "-",
        timeIn:
          row.timeIn && row.timeIn !== "---"
            ? dayjs(row.timeIn).format("h:mm")
            : row.timeIn || "-",
        breakOut:
          row.breakOut && row.breakOut !== "---"
            ? dayjs(row.breakOut).format("h:mm")
            : row.breakOut || "-",
        breakIn:
          row.breakIn && row.breakIn !== "---"
            ? dayjs(row.breakIn).format("h:mm")
            : row.breakIn || "-",
        timeOut:
          row.timeOut && row.timeOut !== "---"
            ? dayjs(row.timeOut).format("h:mm")
            : row.timeOut || "-",
      }));

      // Server now verifies presence of raw logs and hides phantom rows.
      setAttendanceData(formatted);
      setAttendanceTotal(formatted.length);
      setAttendancePage(1);
      if (!formatted.length) {
        swalInfo("No attendance rows found for the selected range.");
      } else {
        swalSuccess(`Loaded ${formatted.length} attendance rows`);
      }
    } catch (err) {
      console.error("Attendance preview error:", err);
      const em =
        err?.response?.data?.message ||
        err.message ||
        "Failed to load attendance preview";
      swalError(em);
      setAttendanceData([]);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const publishOverride = async (enable) => {
    try {
      setSettingsLoading(true);
      const payload = {
        ...(settings || {}),
        dtr: { ...(settings?.dtr || {}) },
      };
      if (enable) {
        payload.dtr.overrideCutoff = {
          enabled: true,
          startDate: attendanceRange[0].startOf("day").toISOString(),
          endDate: attendanceRange[1].endOf("day").toISOString(),
        };
      } else {
        payload.dtr.overrideCutoff = { enabled: false };
      }
      const res = await axiosInstance.put("/settings", payload);
      setSettings(res.data);
      swalSuccess("Developer override updated");

      // Trigger global refresh listeners (ThemeContext, Dashboard, etc.)
      try {
        window.dispatchEvent(new Event("app-settings-updated"));
      } catch (_) {}
    } catch (err) {
      swalError(
        err?.response?.data?.message || "Failed to update settings"
      );
    } finally {
      setSettingsLoading(false);
    }
  };

  const attendanceColumns = [
    { title: "Emp ID", dataIndex: "empId", key: "empId" },
    { title: "Name", dataIndex: "name", key: "name" },
    { title: "Date", dataIndex: "date", key: "date" },
    { title: "Time In", dataIndex: "timeIn", key: "timeIn" },
    { title: "Break Out", dataIndex: "breakOut", key: "breakOut" },
    { title: "Break In", dataIndex: "breakIn", key: "breakIn" },
    { title: "Time Out", dataIndex: "timeOut", key: "timeOut" },
  ];

  const attendanceTab = (
    <>
      <Section title="Attendance Preview (Developer)">
        <Space direction="vertical" style={{ width: "100%" }}>
          <Row gutter={[12, 12]} align="middle">
            <Col>
              <DatePicker.RangePicker
                format="MM/DD/YYYY"
                onChange={(vals) => {
                  setAttendanceRange(vals);
                }}
              />
            </Col>
            <Col>
              <Input
                placeholder="Filter by employee name"
                value={attendanceNameFilter}
                onChange={(e) => {
                  setAttendanceNameFilter(e.target.value);
                  setAttendancePage(1);
                }}
                style={{ width: 220 }}
                allowClear
              />
            </Col>
            <Col>
              <Button
                onClick={() => fetchAttendancePreview(attendanceRange)}
                loading={attendanceLoading}
                disabled={!attendanceRange || attendanceRange.length !== 2}
              >
                Preview
              </Button>
            </Col>
            <Col>
              <Button
                type="primary"
                onClick={() => publishOverride(true)}
                disabled={!attendanceRange || attendanceRange.length !== 2}
              >
                Publish as Override
              </Button>
            </Col>
            <Col>
              <Button danger onClick={() => publishOverride(false)}>
                Disable Override
              </Button>
            </Col>
              <Col>
                <Button
                  onClick={() => exportAttendanceCsv()}
                  disabled={!attendanceData || !attendanceData.length}
                >
                  Export CSV
                </Button>
              </Col>
          </Row>
          
          <Table
            className="compact-table"
            columns={attendanceColumns}
            dataSource={filteredAttendance}
            loading={attendanceLoading}
            size="small"
            rowKey={(r) => `${r.empId}-${r.date}`}
            pagination={{
              current: attendancePage,
              pageSize: attendancePageSize,
              total: attendanceTotal,
              showSizeChanger: true,
              pageSizeOptions: [5, 10, 20, 50],
              onChange: (page, pageSize) => {
                const nextSize = pageSize || attendancePageSize;
                const sizeChanged = nextSize !== attendancePageSize;
                setAttendancePageSize(nextSize);
                setAttendancePage(sizeChanged ? 1 : page);
              },
            }}
          />
        </Space>
      </Section>
    </>
  );

  const exportAttendanceCsv = () => {
    try {
      const rows = filteredAttendance || [];
      if (!rows.length) return swalInfo("No attendance rows to export");

      const header = ["Emp ID", "Name", "Date", "Time In", "Break Out", "Break In", "Time Out"];
      const lines = [header.join(",")].concat(
        rows.map((r) =>
          [
            JSON.stringify(r.empId || ""),
            JSON.stringify(r.name || ""),
            JSON.stringify(r.date || ""),
            JSON.stringify(r.timeIn || ""),
            JSON.stringify(r.breakOut || ""),
            JSON.stringify(r.breakIn || ""),
            JSON.stringify(r.timeOut || ""),
          ].join(",")
        )
      );
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-preview-${dayjs().format("YYYYMMDD-HHmmss")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      swalError("Failed to export attendance CSV");
    }
  };

  // DB & Maintenance tab
  const loadCollections = async () => {
    try {
      setCollectionsLoading(true);
      const res = await axiosInstance.get("/dev/collections");
      if (res.data && res.data.success) setCollections(res.data.data || []);
    } catch (err) {
      swalError("Failed to load collections");
    } finally {
      setCollectionsLoading(false);
    }
  };

  const handleBackup = async () => {
    if (!selectedCollection) return swalWarning("Select collection");
    try {
      // create async job
      const res = await axiosInstance.post("/dev/backup-jobs", {
        collection: selectedCollection,
        format: backupFormat,
      });
      swalSuccess("Backup job queued");
      fetchJobs();
    } catch (err) {
      swalError("Failed to queue backup job");
    }
  };

  const fetchJobs = async () => {
    try {
      setJobsLoading(true);
      const res = await axiosInstance.get("/dev/backup-jobs");
      if (res.data && res.data.data) setBackupJobs(res.data.data);
    } catch (err) {
      swalError("Failed to load backup jobs");
    } finally {
      setJobsLoading(false);
    }
  };

  const deleteJob = async (jobId) => {
    try {
      await axiosInstance.delete(`/dev/backup-jobs/${jobId}`);
      swalSuccess("Job deleted");
      fetchJobs();
    } catch (err) {
      swalError("Failed to delete job");
    }
  };

  const clearJobs = async (status = "done") => {
    try {
      await axiosInstance.delete(`/dev/backup-jobs`, { params: { status } });
      swalSuccess("Jobs cleared");
      fetchJobs();
    } catch (err) {
      swalError("Failed to clear jobs");
    }
  };

  // Direct download without queueing, using /dev/backup
  const downloadCollectionNow = async () => {
    if (!selectedCollection) return swalWarning("Select collection");
    try {
      const res = await axiosInstance.get("/dev/backup", {
        params: { collection: selectedCollection, format: backupFormat },
        responseType: "blob",
      });

      // Try to parse filename
      let fileName = `${selectedCollection}.${backupFormat}`;
      const disp =
        res.headers?.["content-disposition"] ||
        res.headers?.["Content-Disposition"];
      if (disp) {
        const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(
          disp
        );
        const raw = decodeURIComponent(match?.[1] || match?.[2] || "");
        if (raw) fileName = raw;
      }

      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      swalError("Failed to download backup");
    }
  };

  // Download a completed backup job using authenticated request
  const downloadBackupJob = async (row) => {
    try {
      const url = `/dev/backup-jobs/${row._id}/download`;
      const res = await axiosInstance.get(url, { responseType: "blob" });

      // Try to get filename from response headers; fallback to sensible default
      let fileName = `backup_${row.collection || "collection"}.${
        row.format || "json"
      }`;
      const disp =
        res.headers?.["content-disposition"] ||
        res.headers?.["Content-Disposition"];
      if (disp) {
        const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(
          disp
        );
        const raw = decodeURIComponent(match?.[1] || match?.[2] || "");
        if (raw) fileName = raw;
      }

      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      swalError("Failed to download backup");
    }
  };

  const saveMaintenance = async (enable) => {
    try {
      setMaintenanceLoading(true);
      const payload = {
        ...(settings || {}),
        maintenance: { ...(settings?.maintenance || {}) },
      };
      if (enable) {
        payload.maintenance = {
          enabled: true,
          startDate:
            maintenanceRange && maintenanceRange.length === 2
              ? maintenanceRange[0].startOf("day").toISOString()
              : undefined,
          endDate:
            maintenanceRange && maintenanceRange.length === 2
              ? maintenanceRange[1].endOf("day").toISOString()
              : undefined,
          message: maintenanceMessage,
        };
      } else {
        payload.maintenance = { enabled: false };
      }
      const res = await axiosInstance.put("/settings", payload);
      setSettings(res.data);
      swalSuccess("Maintenance settings updated");
      setMaintenanceEnabled(!!payload.maintenance.enabled);
    } catch (err) {
      swalError("Failed to update maintenance settings");
    } finally {
      setMaintenanceLoading(false);
    }
  };

  // Backup content and Resigned Employees content are defined AFTER all referenced
  // functions to avoid TDZ errors when JSX captures them.
  const backupContent = (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Row gutter={[12, 12]}>
        <Col xs={24} md={12}>
          <Card
            size="small"
            title="Database Status"
            bodyStyle={{ fontSize: 12 }}
          >
            {loading || !devInfo ? (
              <Card loading />
            ) : (
              <Descriptions
                size="small"
                column={1}
                labelStyle={{ fontSize: 12 }}
                contentStyle={{ fontSize: 12 }}
              >
                <Descriptions.Item label="Connected">
                  <Tag color={devInfo.db.connected ? "green" : "red"}>
                    {devInfo.db.connected ? "yes" : "no"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="DB Name">
                  {devInfo.db.name || "unknown"}
                </Descriptions.Item>
                <Descriptions.Item label="Host">
                  {devInfo.db.host || "unknown"}
                </Descriptions.Item>
                <Descriptions.Item label="Port">
                  {devInfo.db.port || "unknown"}
                </Descriptions.Item>
                <Descriptions.Item label="Runtime">
                  {devInfo.app.node}
                </Descriptions.Item>
              </Descriptions>
            )}
            <Button
              size="small"
              style={{ marginTop: 12 }}
              onClick={loadCollections}
              loading={collectionsLoading}
            >
              Load Collections
            </Button>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            size="small"
            title="Maintenance Mode"
            bodyStyle={{ fontSize: 12 }}
          >
            <Space direction="vertical" style={{ width: "100%" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                }}
              >
                <Switch
                  checked={maintenanceEnabled}
                  onChange={(v) => setMaintenanceEnabled(v)}
                />
                <span>Enable Maintenance Mode (developers excluded)</span>
              </div>
              <DatePicker.RangePicker
                size="small"
                value={maintenanceRange}
                onChange={(vals) => setMaintenanceRange(vals)}
              />
              <Input.TextArea
                rows={3}
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                placeholder="Maintenance message shown to users"
              />
              <Space>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => saveMaintenance(true)}
                  loading={maintenanceLoading}
                  disabled={!maintenanceRange || maintenanceRange.length !== 2}
                >
                  Enable
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() => saveMaintenance(false)}
                  loading={maintenanceLoading}
                >
                  Disable
                </Button>
                <Button
                  size="small"
                  onClick={() => setIsMaintPreviewOpen(true)}
                >
                  Preview (Non-developer view)
                </Button>
              </Space>
              <Modal
                title="Preview • Non-developer view"
                open={isMaintPreviewOpen}
                onCancel={() => setIsMaintPreviewOpen(false)}
                footer={null}
                width={720}
                bodyStyle={{ maxHeight: 520, overflow: "auto" }}
                destroyOnHidden
              >
                <Space direction="vertical" style={{ width: "100%" }} size={12}>
                  <Alert
                    type="info"
                    showIcon
                    message={
                      <span style={{ fontSize: 12 }}>
                        This is how regular users will see the maintenance
                        notice.
                      </span>
                    }
                  />
                  <div
                    style={{
                      padding: 16,
                      background: "var(--ant-color-bg-container)",
                      border: "1px solid var(--ant-color-border)",
                      borderRadius: 8,
                    }}
                  >
                    <h3 style={{ marginTop: 0, fontSize: 16, marginBottom: 8 }}>
                      Maintenance
                    </h3>
                    <p style={{ marginBottom: 8, fontSize: 13 }}>
                      {maintenanceMessage || "No message set"}
                    </p>
                    {maintenanceRange && maintenanceRange.length === 2 && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {maintenanceRange[0].format("MM/DD/YYYY hh:mm A")} -{" "}
                        {maintenanceRange[1].format("MM/DD/YYYY hh:mm A")}
                      </Text>
                    )}
                    {!maintenanceRange && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        No active window selected
                      </Text>
                    )}
                  </div>
                </Space>
              </Modal>
            </Space>
          </Card>
        </Col>
      </Row>
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24}>
          <Card
            size="small"
            title="Backup Collections"
            bodyStyle={{ fontSize: 12 }}
          >
            <Space direction="vertical" style={{ width: "100%" }}>
              <Space wrap size={8} align="center">
                <Select
                  size="small"
                  placeholder="Select collection"
                  value={selectedCollection}
                  onChange={setSelectedCollection}
                  options={collections.map((c) => ({
                    label: c.name,
                    value: c.name,
                  }))}
                  loading={collectionsLoading}
                  style={{ minWidth: 240, maxWidth: 360 }}
                />
                <Select
                  size="small"
                  value={backupFormat}
                  onChange={setBackupFormat}
                  options={[
                    { label: "JSON", value: "json" },
                    { label: "CSV", value: "csv" },
                  ]}
                  style={{ width: 140, maxWidth: 180 }}
                />
                <Space size={8} wrap>
                  <Button
                    size="small"
                    onClick={downloadCollectionNow}
                    disabled={!selectedCollection}
                  >
                    Download
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    onClick={handleBackup}
                    disabled={!selectedCollection}
                  >
                    Queue
                  </Button>
                  <Button
                    size="small"
                    onClick={fetchJobs}
                    loading={jobsLoading}
                  >
                    Refresh Jobs
                  </Button>
                  <Button size="small" danger onClick={async () => { const r = await swalConfirm({ title: "Clear completed/failed jobs?", dangerMode: true }); if (r.isConfirmed) clearJobs("done"); }}>
                      Clear Completed
                    </Button>
                </Space>
              </Space>

              {/* Refresh/Clear actions moved next to Queue button above */}

              <Row gutter={[8, 8]}>
                <Col xs={24} sm={12} md={8}>
                  <Select
                    size="small"
                    value={jobStatusFilter}
                    onChange={(v) => {
                      setJobStatusFilter(v);
                      setJobsPage(1);
                    }}
                    options={[
                      { label: "All Statuses", value: "all" },
                      { label: "Queued", value: "queued" },
                      { label: "Processing", value: "processing" },
                      { label: "Completed", value: "completed" },
                      { label: "Failed", value: "failed" },
                    ]}
                    style={{ width: "100%" }}
                  />
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Select
                    size="small"
                    value={jobCollectionFilter}
                    onChange={(v) => {
                      setJobCollectionFilter(v);
                      setJobsPage(1);
                    }}
                    options={[
                      { label: "All Collections", value: "all" },
                      ...jobCollections.map((c) => ({ label: c, value: c })),
                    ]}
                    style={{ width: "100%" }}
                  />
                </Col>
              </Row>

              <Table
                className="compact-table"
                size="small"
                dataSource={filteredJobs}
                loading={jobsLoading}
                rowKey={(r) => r._id}
                pagination={{
                  current: jobsPage,
                  pageSize: jobsPageSize,
                    total: (filteredJobs || []).length,
                  showSizeChanger: true,
                  pageSizeOptions: [5, 10, 20, 50],
                    onChange: (page, pageSize) => {
                      const nextSize = pageSize || jobsPageSize;
                      const sizeChanged = nextSize !== jobsPageSize;
                      setJobsPageSize(nextSize);
                      setJobsPage(sizeChanged ? 1 : page);
                    },
                }}
                columns={[
                  {
                    title: "Collection",
                    dataIndex: "collection",
                    key: "collection",
                  },
                  { title: "Format", dataIndex: "format", key: "format" },
                  {
                    title: "Status",
                    dataIndex: "status",
                    key: "status",
                    render: (v) => (
                      <Tag
                        color={
                          v === "completed"
                            ? "green"
                            : v === "failed"
                            ? "red"
                            : "blue"
                        }
                      >
                        {v}
                      </Tag>
                    ),
                  },
                  {
                    title: "Requested By",
                    dataIndex: "requestedByName",
                    key: "requestedByName",
                  },
                  {
                    title: "Created",
                    dataIndex: "createdAt",
                    key: "createdAt",
                    render: (v) =>
                      v ? dayjs(v).format("MM/DD/YYYY hh:mm A") : "",
                  },
                  {
                    title: "Action",
                    key: "action",
                    render: (_, row) => (
                      <Space>
                        {row.status === "completed" && row.resultPath ? (
                          <Button
                            size="small"
                            onClick={() => downloadBackupJob(row)}
                          >
                            Download
                          </Button>
                        ) : row.status === "failed" ? (
                          <Text type="danger">Failed</Text>
                        ) : (
                          <Text type="secondary">{row.status}</Text>
                        )}
                        <Button size="small" danger onClick={async () => { const r = await swalConfirm({ title: "Delete this job?", dangerMode: true }); if (r.isConfirmed) deleteJob(row._id); }}>
                            Delete
                          </Button>
                      </Space>
                    ),
                  },
                ]}
              />
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  );

  const resignedContent = (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Space>
        <Button onClick={loadResignedEmployees} loading={resignedLoading}>
          Refresh
        </Button>
      </Space>
      <Table
        className="compact-table"
        size="small"
        loading={resignedLoading}
        dataSource={resignedEmployees}
        rowKey={(r) => r._id}
        locale={{ emptyText: "No resigned employees found" }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: [5, 10, 20, 50],
        }}
        columns={[
          { title: "Emp ID", dataIndex: "empId", key: "empId" },
          { title: "Emp No", dataIndex: "empNo", key: "empNo" },
          { title: "Name", dataIndex: "name", key: "name" },
          { title: "Type", dataIndex: "empType", key: "empType" },
          { title: "Division", dataIndex: "division", key: "division" },
          {
            title: "Section/Unit",
            dataIndex: "sectionOrUnit",
            key: "sectionOrUnit",
          },
          {
            title: "Resigned At",
            dataIndex: "resignedAt",
            key: "resignedAt",
            render: (v) => (v ? dayjs(v).format("MM/DD/YYYY") : ""),
          },
          {
            title: "Action",
            key: "action",
            render: (_, r) => (
              <Space>
                <Button size="small" onClick={() => openResignedDetails(r)}>
                  View Details
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        width={960}
        styles={{ body: { maxHeight: 600, overflowY: "auto" } }}
        title={
          resignedSelected
            ? `Resigned: ${resignedSelected.name}`
            : "Resigned Employee"
        }
        open={resignedDetailsOpen}
        onCancel={() => {
          setResignedDetailsOpen(false);
          setResignedSelected(null);
          setEmpRecords(null);
          setBioRange(null);
        }}
        footer={null}
      >
        {resignedSelected && (
          <div style={{ fontSize: 12, lineHeight: 1.4 }}>
            <Space direction="vertical" style={{ width: "100%" }} size={8}>
              <Card
                size="small"
                bodyStyle={{ padding: 8 }}
                title={<span style={{ fontSize: 13 }}>Basic Info</span>}
              >
                <Descriptions
                  size="small"
                  column={3}
                  bordered
                  labelStyle={{ fontSize: 11 }}
                  contentStyle={{ fontSize: 11 }}
                >
                  <Descriptions.Item label="Emp ID">
                    {resignedSelected.empId}
                  </Descriptions.Item>
                  <Descriptions.Item label="Emp No">
                    {resignedSelected.empNo}
                  </Descriptions.Item>
                  <Descriptions.Item label="Type">
                    {resignedSelected.empType}
                  </Descriptions.Item>
                  <Descriptions.Item label="Division">
                    {resignedSelected.division}
                  </Descriptions.Item>
                  <Descriptions.Item label="Section/Unit">
                    {resignedSelected.sectionOrUnit}
                  </Descriptions.Item>
                  <Descriptions.Item label="Resigned At">
                    {resignedSelected.resignedAt
                      ? dayjs(resignedSelected.resignedAt).format("YYYY-MM-DD")
                      : ""}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
              <Alert
                type="warning"
                style={{ fontSize: 11 }}
                showIcon
                message={
                  <span style={{ fontSize: 12 }}>
                    Deletion will remove employee, salary, payslip requests,
                    generation logs, documents, and training participation.
                  </span>
                }
              />
              <Space style={{ justifyContent: "space-between", width: "100%" }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Employee Records (collapsible)
                </Text>
                <Space>
                  <Button size="small" type="primary" onClick={async () => { const r = await swalConfirm({ title: "Restore this employee?", confirmText: "Restore", icon: "question" }); if (r.isConfirmed) restoreResignedEmployee(resignedSelected); }}>
                      Restore
                    </Button>
                  <Button size="small" danger onClick={async () => { const r = await swalConfirm({ title: "Delete this employee?", text: "This action cannot be undone.", confirmText: "Delete", dangerMode: true }); if (r.isConfirmed) deleteResignedEmployee(resignedSelected); }}>
                      Delete
                    </Button>
                </Space>
              </Space>
              <Card
                size="small"
                bodyStyle={{ padding: 8 }}
                title={<span style={{ fontSize: 13 }}>Summary</span>}
                loading={empRecordsLoading}
              >
                {empRecords && (
                  <Space size={16} wrap>
                    <Tag
                      color="blue"
                      style={{ fontSize: 11, padding: "2px 6px" }}
                    >
                      Docs: {(empRecords.docs || []).length}
                    </Tag>
                    <Tag
                      color="green"
                      style={{ fontSize: 11, padding: "2px 6px" }}
                    >
                      Payslip Requests:{" "}
                      {(empRecords.payslipRequests || []).length}
                    </Tag>
                    <Tag
                      color="geekblue"
                      style={{ fontSize: 11, padding: "2px 6px" }}
                    >
                      DTR Logs: {(empRecords.dtrGenerationLogs || []).length}
                    </Tag>
                    <Tag
                      color="blue"
                      style={{ fontSize: 11, padding: "2px 6px" }}
                    >
                      Biometric Logs:{" "}
                      {empRecords?.biometricMeta?.total ??
                        (empRecords.biometricLogs || []).length}
                    </Tag>
                    <Tag
                      color="purple"
                      style={{ fontSize: 11, padding: "2px 6px" }}
                    >
                      Trainings: {(empRecords.trainings || []).length}
                    </Tag>
                    <Tag
                      color={empRecords.salary ? "gold" : "default"}
                      style={{ fontSize: 11, padding: "2px 6px" }}
                    >
                      Salary: {empRecords.salary ? "Yes" : "No"}
                    </Tag>
                  </Space>
                )}
              </Card>
              <Collapse size="small" accordion>
                <Collapse.Panel
                  header={<span style={{ fontSize: 12 }}>Documents</span>}
                  key="docs"
                >
                  <Table
                    className="compact-table"
                    size="small"
                    scroll={{ y: 200 }}
                    pagination={false}
                    rowKey={(r) => r._id}
                    dataSource={empRecords?.docs || []}
                    columns={[
                      {
                        title: "Type",
                        dataIndex: "docType",
                        key: "docType",
                        width: 140,
                        render: (t) => <Tag color={docTagColor(t)}>{t}</Tag>,
                      },
                      {
                        title: "Reference / Period",
                        key: "ref-period",
                        render: (_, r) => {
                          const isLink = r.reference && /^https?:\/\//i.test(r.reference);
                          return (
                            <Space direction="vertical" size={2} style={{ maxWidth: 420 }}>
                              <span>
                                {isLink ? (
                                  <a href={r.reference} target="_blank" rel="noopener noreferrer">
                                    <Text ellipsis={{ tooltip: r.reference }} style={{ maxWidth: 400, display: "inline-block" }}>
                                      {r.reference}
                                    </Text>
                                    <LinkOutlined style={{ marginLeft: 6, color: "var(--ant-color-text-tertiary)" }} />
                                  </a>
                                ) : (
                                  <Text ellipsis={{ tooltip: r.reference }}>{r.reference || "-"}</Text>
                                )}
                              </span>
                              <Text type="secondary">
                                <CalendarOutlined style={{ marginRight: 6 }} />
                                {r.period || "-"}
                              </Text>
                            </Space>
                          );
                        },
                      },
                      {
                        title: "Created",
                        dataIndex: "createdAt",
                        key: "createdAt",
                        width: 130,
                        render: (v) => (v ? dayjs(v).format("YYYY-MM-DD HH:mm") : ""),
                      },
                      {
                        title: "Action",
                        key: "action",
                        fixed: "right",
                        width: 120,
                        render: (_, row) => (
                          <Space>
                            <Button
                              size="small"
                              type="primary"
                              title="View"
                              icon={<EyeOutlined />}
                              onClick={() => handleOpenDoc(row)}
                            />
                            <Button
                              size="small"
                              type="primary"
                              title="Download"
                              icon={<DownloadOutlined />}
                              onClick={() => handleDownloadDoc(row)}
                              disabled={!row.downloadUrl}
                            />
                            <Button
                                size="small"
                                type="primary"
                                danger
                                title="Delete"
                                icon={<DeleteOutlined />}
                                onClick={async () => { const r = await swalConfirm({ title: "Delete this document?", confirmText: "Delete", dangerMode: true }); if (r.isConfirmed) handleDeleteDoc(row); }}
                              />
                          </Space>
                        ),
                      },
                    ]}
                  />
                </Collapse.Panel>
                <Collapse.Panel
                  header={
                    <span style={{ fontSize: 12 }}>Payslip Requests</span>
                  }
                  key="payslips"
                >
                  <Table
                    className="compact-table"
                    size="small"
                    scroll={{ y: 200 }}
                    pagination={false}
                    rowKey={(r) => r._id}
                    dataSource={empRecords?.payslipRequests || []}
                    columns={[
                      {
                        title: "Period",
                        dataIndex: "period",
                        key: "period",
                        width: 120,
                      },
                      { title: "Email", dataIndex: "email", key: "email" },
                      {
                        title: "Status",
                        dataIndex: "status",
                        key: "status",
                        width: 100,
                      },
                      {
                        title: "Created",
                        dataIndex: "createdAt",
                        key: "createdAt",
                        width: 110,
                        render: (v) => (v ? dayjs(v).format("YYYY-MM-DD") : ""),
                      },
                    ]}
                  />
                </Collapse.Panel>
                <Collapse.Panel
                  header={
                    <span style={{ fontSize: 12 }}>DTR Generation Logs</span>
                  }
                  key="dtr"
                >
                  <Table
                    className="compact-table"
                    size="small"
                    scroll={{ y: 200 }}
                    pagination={false}
                    rowKey={(r) => r._id}
                    dataSource={empRecords?.dtrGenerationLogs || []}
                    columns={[
                      {
                        title: "Period",
                        dataIndex: "period",
                        key: "period",
                        width: 120,
                      },
                      {
                        title: "Generated By",
                        dataIndex: "generatedBy",
                        key: "generatedBy",
                      },
                      {
                        title: "Created",
                        dataIndex: "createdAt",
                        key: "createdAt",
                        width: 110,
                        render: (v) => (v ? dayjs(v).format("YYYY-MM-DD") : ""),
                      },
                    ]}
                  />
                </Collapse.Panel>
                <Collapse.Panel
                  header={<span style={{ fontSize: 12 }}>Biometrics Logs</span>}
                  key="biometrics"
                >
                  <div style={{ fontSize: 11, lineHeight: 1.3 }}>
                    <Space
                      size={6}
                      style={{ marginBottom: 8, flexWrap: "wrap" }}
                    >
                      <DatePicker.RangePicker
                        size="small"
                        onChange={(v) => setBioRange(v)}
                        value={bioRange}
                        style={{ width: 260 }}
                        allowClear
                      />
                      <TimePicker
                        size="small"
                        format="HH:mm"
                        value={bioTimeFrom}
                        onChange={setBioTimeFrom}
                        placeholder="Start time"
                      />
                      <TimePicker
                        size="small"
                        format="HH:mm"
                        value={bioTimeTo}
                        onChange={setBioTimeTo}
                        placeholder="End time"
                      />
                      <Button
                        size="small"
                        onClick={refreshBiometricLogs}
                        loading={bioLoading}
                      >
                        Apply
                      </Button>
                      <Button
                        size="small"
                        onClick={() => {
                          setBioRange(null);
                          setBioTimeFrom(null);
                          setBioTimeTo(null);
                          refreshBiometricLogs();
                        }}
                      >
                        Reset
                      </Button>
                      <Button
                        size="small"
                        onClick={exportBiometricsCSV}
                        disabled={(bioLogs || []).length === 0}
                      >
                        Export CSV
                      </Button>
                      {bioMeta && (
                        <Tag color="processing" style={{ marginLeft: 6 }}>
                          Total: {bioMeta.total} • Showing {bioLogs.length}
                        </Tag>
                      )}
                    </Space>
                    <div className="bio-tight">
                      <Table
                        className="compact-table"
                        size="small"
                        scroll={{ y: 220 }}
                        pagination={false}
                        rowKey={(r) => r._id}
                        dataSource={(bioLogs || []).filter((r) => {
                          const t = r?.Time ? dayjs(r.Time) : null;
                          if (!t) return false;
                          // Date filter (client side safeguard)
                          if (bioRange && bioRange[0] && bioRange[1]) {
                            if (
                              !t.isBetween(
                                bioRange[0],
                                bioRange[1],
                                "day",
                                "[]"
                              )
                            )
                              return false;
                          }
                          // Time-of-day filter
                          if (bioTimeFrom || bioTimeTo) {
                            const minutes = t.hour() * 60 + t.minute();
                            const startM = bioTimeFrom
                              ? bioTimeFrom.hour() * 60 + bioTimeFrom.minute()
                              : null;
                            const endM = bioTimeTo
                              ? bioTimeTo.hour() * 60 + bioTimeTo.minute()
                              : null;
                            if (startM !== null && minutes < startM)
                              return false;
                            if (endM !== null && minutes > endM) return false;
                          }
                          return true;
                        })}
                        columns={[
                          {
                            title: <span style={{ fontSize: 11 }}>AC-No</span>,
                            dataIndex: "AC-No",
                            key: "acno",
                            width: 110,
                            render: (v) => (
                              <span style={{ fontSize: 11 }}>{v}</span>
                            ),
                          },
                          {
                            title: <span style={{ fontSize: 11 }}>Name</span>,
                            dataIndex: "Name",
                            key: "name",
                            render: (v) => (
                              <span style={{ fontSize: 11 }}>{v}</span>
                            ),
                          },
                          {
                            title: <span style={{ fontSize: 11 }}>Time</span>,
                            dataIndex: "Time",
                            key: "time",
                            width: 150,
                            render: (v) => (
                              <span style={{ fontSize: 11 }}>
                                {v ? dayjs(v).format("YYYY-MM-DD HH:mm") : ""}
                              </span>
                            ),
                          },
                          {
                            title: <span style={{ fontSize: 11 }}>State</span>,
                            dataIndex: "State",
                            key: "state",
                            width: 90,
                            render: (v) => (
                              <span style={{ fontSize: 11 }}>{v}</span>
                            ),
                          },
                        ]}
                      />
                      <div
                        style={{
                          marginTop: 8,
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <Button
                          size="small"
                          onClick={loadMoreBiometrics}
                          disabled={!bioMeta?.hasMore}
                          loading={bioLoading}
                        >
                          {bioMeta?.hasMore ? "Load more" : "No more"}
                        </Button>
                        {bioMeta && (
                          <Text type="secondary">
                            Page {bioMeta.page} • Returned {bioMeta.returned}
                          </Text>
                        )}
                      </div>
                    </div>
                    <style>
                      {`
                        .bio-tight .ant-table-tbody > tr > td { padding: 4px 6px !important; }
                        .bio-tight .ant-table-thead > tr > th { padding: 6px 6px !important; }
                      `}
                    </style>
                  </div>
                </Collapse.Panel>
                <Collapse.Panel
                  header={<span style={{ fontSize: 12 }}>Trainings</span>}
                  key="trainings"
                >
                  <Table
                    className="compact-table"
                    size="small"
                    scroll={{ y: 200 }}
                    pagination={false}
                    rowKey={(r) => r._id}
                    dataSource={empRecords?.trainings || []}
                    columns={[
                      { title: "Name", dataIndex: "name", key: "name" },
                      {
                        title: "Host",
                        dataIndex: "host",
                        key: "host",
                        width: 120,
                      },
                      {
                        title: "Venue",
                        dataIndex: "venue",
                        key: "venue",
                        width: 120,
                      },
                      {
                        title: "Date",
                        dataIndex: "trainingDate",
                        key: "trainingDate",
                        width: 110,
                        render: (v) => (v ? dayjs(v).format("YYYY-MM-DD") : ""),
                      },
                    ]}
                  />
                </Collapse.Panel>
                <Collapse.Panel
                  header={<span style={{ fontSize: 12 }}>Salary</span>}
                  key="salary"
                >
                  {empRecords?.salary ? (
                    <Descriptions
                      size="small"
                      column={3}
                      bordered
                      labelStyle={{ fontSize: 11 }}
                      contentStyle={{ fontSize: 11 }}
                    >
                      <Descriptions.Item label="Type">
                        {empRecords.salary.salaryType}
                      </Descriptions.Item>
                      <Descriptions.Item label="Payroll Type">
                        {empRecords.salary.payrollType}
                      </Descriptions.Item>
                      <Descriptions.Item label="Basic Salary">
                        {empRecords.salary.basicSalary}
                      </Descriptions.Item>
                      <Descriptions.Item label="Rate/Month">
                        {empRecords.salary.ratePerMonth}
                      </Descriptions.Item>
                    </Descriptions>
                  ) : (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      No salary record
                    </Text>
                  )}
                </Collapse.Panel>
              </Collapse>
            </Space>
          </div>
        )}
      </Modal>
    </Space>
  );

  const dbMaintenanceTab = (
    <Section title="Database & Maintenance">
      <Tabs
        defaultActiveKey="backup"
        items={[
          { key: "backup", label: "Backup", children: backupContent },
          {
            key: "resigned",
            label: "Resigned Employees",
            children: resignedContent,
          },
        ]}
        onChange={(k) => {
          if (k === "resigned") loadResignedEmployees();
        }}
      />
    </Section>
  );

  const employeesTab = (
    <>
      <Section title="Employees">
        <Space direction="vertical" style={{ width: "100%" }} size={8}>
          <Row gutter={[8, 8]}>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Input
                allowClear
                placeholder="Search Name"
                value={empFilterName}
                onChange={(e) => setEmpFilterName(e.target.value)}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Input
                allowClear
                placeholder="Search Emp ID"
                value={empFilterEmpId}
                onChange={(e) => setEmpFilterEmpId(e.target.value)}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Input
                allowClear
                placeholder="Search Emp No"
                value={empFilterEmpNo}
                onChange={(e) => setEmpFilterEmpNo(e.target.value)}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Select
                style={{ width: "100%" }}
                options={employeeDivisionOptions}
                value={empFilterDivision}
                onChange={setEmpFilterDivision}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Select
                style={{ width: "100%" }}
                options={employeeSectionOptions}
                value={empFilterSection}
                onChange={setEmpFilterSection}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Select
                style={{ width: "100%" }}
                options={employeeTypeOptions}
                value={empFilterType}
                onChange={setEmpFilterType}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Select
                style={{ width: "100%" }}
                options={[
                  { label: "All Status", value: "all" },
                  { label: "Active", value: "active" },
                  { label: "Resigned", value: "resigned" },
                ]}
                value={empFilterStatus}
                onChange={setEmpFilterStatus}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Space wrap>
                <Button onClick={loadAllEmployees} loading={employeesLoading}>
                  Refresh
                </Button>
                <Button
                  onClick={() => {
                    setEmpFilterName("");
                    setEmpFilterEmpId("");
                    setEmpFilterEmpNo("");
                    setEmpFilterDivision("all");
                    setEmpFilterSection("all");
                    setEmpFilterType("all");
                    setEmpFilterStatus("all");
                  }}
                >
                  Clear Filters
                </Button>
              </Space>
            </Col>
          </Row>
        </Space>
        <Table
          className="compact-table"
          size="small"
          loading={employeesLoading}
          dataSource={filteredEmployees}
          rowKey={(r) => r._id}
          pagination={{
            current: employeesPage,
            pageSize: employeesPageSize,
            total: (filteredEmployees || []).length,
            showSizeChanger: true,
            pageSizeOptions: [5, 10, 20, 50],
            onChange: (page, pageSize) => {
              const nextSize = pageSize || employeesPageSize;
              const sizeChanged = nextSize !== employeesPageSize;
              setEmployeesPageSize(nextSize);
              setEmployeesPage(sizeChanged ? 1 : page);
            },
          }}
          columns={[
            { title: "Emp ID", dataIndex: "empId", key: "empId" },
            { title: "Emp No", dataIndex: "empNo", key: "empNo" },
            { title: "Name", dataIndex: "name", key: "name" },
            { title: "Type", dataIndex: "empType", key: "empType" },
            { title: "Division", dataIndex: "division", key: "division" },
            {
              title: "Section/Unit",
              dataIndex: "sectionOrUnit",
              key: "sectionOrUnit",
            },
            {
              title: "Status",
              key: "status",
              render: (_, r) =>
                r.isResigned ? (
                  <Tag color="default">Resigned</Tag>
                ) : (
                  <Tag color="green">Active</Tag>
                ),
            },
            {
              title: "Resigned At",
              dataIndex: "resignedAt",
              key: "resignedAt",
              render: (v) => (v ? dayjs(v).format("MM/DD/YYYY") : ""),
            },
            {
              title: "Action",
              key: "action",
              render: (_, r) => (
                <Space>
                  {!r.isResigned ? (
                    <Button
                      size="small"
                      danger
                      onClick={() => openResignModal(r)}
                    >
                      Mark Resigned
                    </Button>
                  ) : (
                    <Button size="small" onClick={() => handleUndoResign(r)}>
                      Undo Resign
                    </Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Section>
      <Modal
        title={
          selectedEmployee
            ? `Resign: ${selectedEmployee.name}`
            : "Resign Employee"
        }
        open={resignModalOpen}
        onCancel={() => {
          setResignModalOpen(false);
          setSelectedEmployee(null);
        }}
        onOk={handleResignSubmit}
        okText="Confirm Resign"
      >
        <Form form={resignForm} layout="vertical">
          <Form.Item
            name="resignedAt"
            label="Effective Date"
            rules={[{ required: true, message: "Select date" }]}
          >
            <DatePicker format="MM/DD/YYYY" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="reason" label="Reason">
            <Input.TextArea rows={3} placeholder="Optional reason" />
          </Form.Item>
          <Alert
            type="warning"
            showIcon
            message="This will remove the employee from active lists and graylist their trainings for non-developer users."
          />
        </Form>
      </Modal>
    </>
  );

  // Application Settings tab
  const appSettingsTab = (
    <>
      <Form form={form} layout="vertical" onFinish={onSaveSettings}>
        <Section title="Appearance">
          <Row gutter={[12, 12]}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name={["general", "themeColor"]}
                label="Theme Color"
                getValueFromEvent={(color, hex) => hex}
                style={{ marginBottom: 0 }}
              >
                <ColorPicker
                  format="hex"
                  showText
                  presets={[
                    { label: "Ant Blue", colors: ["#1677ff", "#1890ff"] },
                    { label: "Greens", colors: ["#52c41a", "#389e0d"] },
                    { label: "Reds", colors: ["#f5222d", "#cf1322"] },
                    { label: "Purples", colors: ["#722ed1", "#531dab"] },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name={["general", "headerColor"]}
                label="Header Color"
                getValueFromEvent={(color, hex) => hex}
                style={{ marginBottom: 0 }}
              >
                <ColorPicker format="hex" showText />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name={["general", "siderColor"]}
                label="Sider Color"
                getValueFromEvent={(color, hex) => hex}
                style={{ marginBottom: 0 }}
              >
                <ColorPicker format="hex" showText />
              </Form.Item>
            </Col>
          </Row>
        </Section>

        <Section title="DTR Defaults">
          <Space size={12} wrap>
            <Form.Item
              name={["dtr", "defaultStartTime"]}
              label="Default Start Time"
            >
              <Input placeholder="08:00" />
            </Form.Item>
            <Form.Item
              name={["dtr", "defaultEndTime"]}
              label="Default End Time"
            >
              <Input placeholder="17:00" />
            </Form.Item>
            <Form.Item
              name={["dtr", "autoFillBreakOut"]}
              label="Auto-fill Break Out"
            >
              <Input placeholder="12:00" />
            </Form.Item>
            <Form.Item
              name={["dtr", "autoFillBreakIn"]}
              label="Auto-fill Break In"
            >
              <Input placeholder="13:00" />
            </Form.Item>
          </Space>
        </Section>

        <Section title="Security">
          <Space size={12} wrap>
            <Form.Item
              name={["security", "sessionTimeout"]}
              label="Session Timeout (minutes)"
            >
              <InputNumber min={1} />
            </Form.Item>
            <Form.Item
              name={["security", "passwordMinLength"]}
              label="Password Min Length"
            >
              <InputNumber min={6} />
            </Form.Item>
            <Form.Item
              name={["security", "passwordRequiresNumber"]}
              label="Require Number"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              name={["security", "passwordRequiresSymbol"]}
              label="Require Symbol"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Space>
        </Section>

        <Space>
          <Button type="primary" htmlType="submit" loading={settingsLoading}>
            Save Settings
          </Button>
          <Button
            onClick={async () => {
              try {
                setSettingsLoading(true);
                const res = await axiosInstance.get("/settings");
                setSettings(res.data);
                if (activeTab === "app-settings") {
                  form.setFieldsValue(res.data);
                }
              } finally {
                setSettingsLoading(false);
              }
            }}
          >
            Reset
          </Button>
        </Space>
      </Form>
    </>
  );

  // ── Sider menu items for Developer Settings ──────────────────────────
  const devSiderItems = [
    { key: "runtime", icon: <DashboardOutlined />, label: "Runtime" },
    { key: "employees", icon: <TeamOutlined />, label: "Employees" },
    { key: "attendance-preview", icon: <FieldTimeOutlined />, label: "Attendance" },
    { key: "db-maintenance", icon: <DatabaseOutlined />, label: "Database" },
    { key: "app-settings", icon: <SettingOutlined />, label: "App Settings" },
    { key: "feature-maintenance", icon: <ToolOutlined />, label: "Feature Maint." },
    { key: "demo-mode", icon: <ExperimentOutlined />, label: "Demo Mode" },
    { key: "inbox-settings", icon: <InboxOutlined />, label: "Inbox Settings" },
    { key: "secure-storage", icon: <LockOutlined />, label: "Secure Storage" },
    { key: "audit-logs", icon: <FileSearchOutlined />, label: "Audit Logs" },
    { key: "notifications", icon: <BellOutlined />, label: "Notifications" },
    { key: "bug-reports", icon: <BugOutlined />, label: "Bug Reports" },
  ];

  // ── Feature Maintenance Tab content ──────────────────────────────────
  const featureMaintenanceTab = (
    <Section title="Per-Feature Maintenance" extra={
      <Button type="primary" size="small" onClick={saveFeatureMaintenance} loading={featureMaintSaving}>
        Save All
      </Button>
    }>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Control individual features without taking the entire system offline."
        description="Enable = shows 'Maintenance' tag and disables the menu item. Hidden = removes the menu item entirely. Developers always see everything."
      />
      <Table
        className="compact-table"
        size="small"
        dataSource={FEATURE_LIST}
        rowKey="key"
        pagination={false}
        columns={[
          {
            title: "Feature",
            dataIndex: "label",
            key: "label",
            render: (label, r) => (
              <span>
                {label}
                <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>({r.key})</Text>
              </span>
            ),
          },
          {
            title: "Enabled",
            key: "enabled",
            width: 80,
            render: (_, r) => (
              <Switch
                size="small"
                checked={!!featureMaintenanceMap[r.key]?.enabled}
                onChange={(v) => updateFeatureMaint(r.key, "enabled", v)}
              />
            ),
          },
          {
            title: "Hidden",
            key: "hidden",
            width: 80,
            render: (_, r) => (
              <Switch
                size="small"
                checked={!!featureMaintenanceMap[r.key]?.hidden}
                onChange={(v) => updateFeatureMaint(r.key, "hidden", v)}
                disabled={!featureMaintenanceMap[r.key]?.enabled}
              />
            ),
          },
          {
            title: "Message",
            key: "message",
            render: (_, r) => (
              <Input
                size="small"
                placeholder="Custom maintenance message"
                value={featureMaintenanceMap[r.key]?.message || ""}
                onChange={(e) => updateFeatureMaint(r.key, "message", e.target.value)}
                disabled={!featureMaintenanceMap[r.key]?.enabled}
              />
            ),
          },
        ]}
      />
    </Section>
  );

  // ── Inbox Settings Tab content ───────────────────────────────────────
  const inboxSettingsTab = (
    <Space direction="vertical" style={{ width: "100%" }} size={16}>
      <Section title="Messaging Configuration">
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Configure messaging and inbox settings for the system."
        />
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="Encryption">
            <Tag color="green">AES-256-GCM</Tag>
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
              Messages are encrypted at rest using server-side key
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="Email Notifications">
            <Tag color={settings?.smtp?.host ? "green" : "orange"}>
              {settings?.smtp?.host ? "Configured" : "Not configured"}
            </Tag>
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
              Offline users receive email when they get a new message
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="Real-time Delivery">
            <Tag color="green">Socket.IO</Tag>
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
              Messages delivered in real-time via WebSocket
            </Text>
          </Descriptions.Item>
        </Descriptions>
      </Section>
      <Section title="SMTP / Email Transport">
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Email settings are configured in Application Settings tab. Messages will use these SMTP settings for offline notifications."
        />
        <Descriptions size="small" column={1}>
          <Descriptions.Item label="SMTP Host">
            {settings?.smtp?.host || <Text type="secondary">Not set</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="Port">
            {settings?.smtp?.port || <Text type="secondary">Not set</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="From Email">
            {settings?.smtp?.fromEmail || <Text type="secondary">Not set</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="From Name">
            {settings?.smtp?.fromName || <Text type="secondary">Not set</Text>}
          </Descriptions.Item>
        </Descriptions>
      </Section>
    </Space>
  );

  // ── Render active panel content ──────────────────────────────────────
  const renderActivePanel = () => {
    switch (activeTab) {
      case "runtime": return runtimeTab;
      case "employees": return employeesTab;
      case "attendance-preview": return attendanceTab;
      case "db-maintenance": return dbMaintenanceTab;
      case "app-settings": return appSettingsTab;
      case "feature-maintenance": return featureMaintenanceTab;
      case "inbox-settings": return inboxSettingsTab;
      case "demo-mode": return (
              <Space direction="vertical" style={{ width: "100%" }} size={16}>
                <Section
                  title="Demo Mode Configuration"
                  extra={
                    settings?.demo?.enabled ? (
                      <Tag color="blue">Active</Tag>
                    ) : (
                      <Tag>Disabled</Tag>
                    )
                  }
                >
                  <DemoModeSettings
                    settings={settings}
                    onUpdated={(next) => {
                      setSettings(next);
                      window.dispatchEvent(new Event("app-settings-updated"));
                    }}
                  />
                </Section>
                <Section
                  title="Per-User Demo Access"
                  extra={
                    <Space>
                      <Checkbox
                        checked={showOnlyDemoUsers}
                        onChange={(e) => setShowOnlyDemoUsers(e.target.checked)}
                      >
                        Show only demo users
                      </Checkbox>
                      <Button
                        size="small"
                        onClick={fetchDemoUsers}
                        loading={demoUsersLoading}
                      >
                        Refresh
                      </Button>
                    </Space>
                  }
                >
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="Toggle which accounts are treated as demo users when Demo Mode is active."
                    description="Demo users are restricted by Demo Mode settings unless submissions are allowed or the account is a developer/admin."
                  />
                  <Table
                    size="small"
                    className="compact-table"
                    rowKey={(r) => r._id}
                    loading={demoUsersLoading}
                    dataSource={(demoUsers || []).filter(
                      (r) => !showOnlyDemoUsers || r.isDemo
                    )}
                    pagination={{
                      current: demoUsersPage,
                      pageSize: demoUsersPageSize,
                      total: (demoUsers || []).filter(
                        (r) => !showOnlyDemoUsers || r.isDemo
                      ).length,
                      showSizeChanger: true,
                      pageSizeOptions: [5, 8, 15, 30],
                      onChange: (page, pageSize) => {
                        const nextSize = pageSize || demoUsersPageSize;
                        const sizeChanged = nextSize !== demoUsersPageSize;
                        setDemoUsersPageSize(nextSize);
                        setDemoUsersPage(sizeChanged ? 1 : page);
                      },
                    }}
                    columns={[
                      {
                        title: "Name",
                        dataIndex: "name",
                        key: "name",
                        render: (v, r) => (
                          <span>
                            {v}
                            {r._id === user?._id && (
                              <Tag color="geekblue" style={{ marginLeft: 4 }}>
                                You
                              </Tag>
                            )}
                          </span>
                        ),
                      },
                      {
                        title: "Username",
                        dataIndex: "username",
                        key: "username",
                      },
                      {
                        title: "Type",
                        dataIndex: "userType",
                        key: "userType",
                        render: (v) => v || "guest",
                      },
                      {
                        title: "Demo User",
                        key: "demo",
                        render: (_, r) => (
                          <Switch
                            checked={!!r.isDemo}
                            onChange={(val) => toggleUserDemo(r, val)}
                            disabled={savingDemoIds.has(r._id)}
                          />
                        ),
                      },
                    ]}
                  />
                </Section>
              </Space>
      );
      case "secure-storage": return (
        <Section title="Secure Storage Diagnostics">
          <SecureStorageDiagnostics />
        </Section>
      );
      case "audit-logs": return (
        <Section title="Audit Logs">
          <Space wrap size={8} style={{ marginBottom: 8 }}>
            <Button onClick={() => fetchAuditLogs(1, auditPageSize)} loading={auditLoading}>Refresh</Button>
            <Button onClick={exportAuditCsv}>Export Current Page</Button>
            <Button onClick={() => exportAuditCsvServer()}>Export CSV (All/Filtered)</Button>
            <Select mode="multiple" allowClear placeholder="Actions" size="small" value={auditActionsFilter}
              onChange={(vals) => { setAuditActionsFilter(vals); fetchAuditLogs(1, auditPageSize, { actions: vals }); }}
              options={auditActionOptions} style={{ minWidth: 240 }} />
            <Select size="small" value={auditUserFilter}
              onChange={(v) => { setAuditUserFilter(v); fetchAuditLogs(1, auditPageSize, { user: v }); }}
              options={auditUserOptions} style={{ minWidth: 180 }} />
            <Input.Search allowClear size="small" placeholder="Search in details…" value={auditDetailsQuery}
              onChange={(e) => setAuditDetailsQuery(e.target.value)}
              onSearch={(val) => { setAuditDetailsQuery(val); fetchAuditLogs(1, auditPageSize, { detailsFragment: val }); }}
              style={{ width: 220 }} />
            <DatePicker.RangePicker size="small" value={auditDateRange}
              onChange={(vals) => { setAuditDateRange(vals); fetchAuditLogs(1, auditPageSize, { dateRange: vals }); }}
              showTime={{ format: "HH:mm" }} />
            <Button size="small" onClick={() => {
              setAuditActionsFilter([]); setAuditUserFilter("all"); setAuditDateRange(null); setAuditDetailsQuery("");
              fetchAuditLogs(1, auditPageSize, { actions: [], user: "all", dateRange: null, detailsFragment: "" });
            }}>Reset Filters</Button>
          </Space>
          <Table className="compact-table" size="small" dataSource={filteredAuditLogs} loading={auditLoading}
            rowKey={(r) => r._id}
            pagination={{
              current: auditPage, pageSize: auditPageSize, total: auditTotal || filteredAuditLogs.length,
              showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100],
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
              onShowSizeChange: (p, s) => { if (s !== auditPageSize) { setAuditPageSize(s); fetchAuditLogs(1, s); } },
              onChange: (p, s) => { if (s !== auditPageSize) { setAuditPageSize(s); fetchAuditLogs(1, s); } else { fetchAuditLogs(p, s); } },
            }}
            onChange={(_, __, sorter) => {
              const sb = sorter?.field || sorter?.columnKey || "createdAt";
              const so = sorter?.order || "descend";
              setAuditSortBy(sb); setAuditSortOrder(so);
              fetchAuditLogs(1, auditPageSize, { sortBy: sb, sortOrder: so });
            }}
            columns={[
              { title: "Action", dataIndex: "action", key: "action", sorter: true, sortOrder: auditSortBy === "action" ? auditSortOrder : null, render: (v) => <Tag color={tagColorForAction(v)}>{v}</Tag> },
              { title: "By", dataIndex: "performedByName", key: "performedByName", sorter: true, sortOrder: auditSortBy === "performedByName" ? auditSortOrder : null },
              { title: "When", dataIndex: "createdAt", key: "createdAt", sorter: true, sortOrder: auditSortBy === "createdAt" ? auditSortOrder : null, render: (v) => v ? dayjs(v).format("MM/DD/YYYY HH:mm") : "" },
              { title: "Details", dataIndex: "details", key: "details", render: (d) => (
                <Space>
                  <code style={{ fontSize: 11, maxWidth: 320 }}>{JSON.stringify(d).slice(0, 60)}{JSON.stringify(d).length > 60 ? "…" : ""}</code>
                  <Button size="small" onClick={() => { setAuditDetailObj(d || {}); setAuditDetailOpen(true); }}>View</Button>
                </Space>
              )},
            ]}
          />
          <Modal open={auditDetailOpen} onCancel={() => setAuditDetailOpen(false)} footer={null} width={720} title="Audit Details">
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, background: "var(--ant-color-bg-container)", border: "1px solid var(--ant-color-border)", borderRadius: 8, padding: 12 }}>
              {auditDetailObj ? JSON.stringify(auditDetailObj, null, 2) : ""}
            </pre>
          </Modal>
        </Section>
      );
      case "notifications": return (
        <Section title="Notifications">
          <Space style={{ marginBottom: 12 }}><Button onClick={fetchNotifications}>Refresh</Button></Space>
          <Table className="compact-table" size="small" dataSource={notifications} loading={notifLoading} rowKey={(r) => r._id}
            pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [5, 10, 20, 50] }}
            columns={[
              { title: "Title", dataIndex: "title", key: "title", render: (t, r) => t || r.title || "" },
              { title: "Body", dataIndex: "body", key: "body", render: (b, r) => {
                if (r._source === "dev") { if (r.dataVisible === false) return <Text type="secondary">[hidden]</Text>; }
                const text = b || r.body || ""; return text.length > 100 ? text.slice(0, 100) + "..." : text;
              }},
              { title: "Visible", dataIndex: "dataVisible", key: "dataVisible", render: (v, r) => {
                if (r._source === "dev") return <Switch checked={!!r.dataVisible} onChange={() => toggleDataVisibility(r)} disabled={!canSeeDev} />;
                return <Switch checked={!r.hidden} onChange={() => toggleNotificationHidden(r)} disabled={!canSeeDev} />;
              }},
              { title: "Source", dataIndex: "_source", key: "_source", render: (s) => s || "dev" },
              { title: "Created", dataIndex: "createdAt", key: "createdAt", render: (v) => v ? dayjs(v).format("MM/DD/YYYY HH:mm") : "" },
              {},
              { title: "Action", key: "action", render: (_, row) => (
                <Space>
                  {row._source === "dev" && (<>
                    <Button size="small" onClick={() => toggleNotificationHidden(row)}>{row.hidden ? "Show" : "Hide"}</Button>
                    <Button size="small" onClick={() => openEditModal(row)}>Edit</Button>
                    <Button size="small" danger onClick={() => removeNotification(row)}>Delete</Button>
                  </>)}
                  {(row._source === "payslip" || row._source === "dtr") && (<>
                    <Button size="small" onClick={() => markDataRequestRead(row)} disabled={row.read}>Mark read</Button>
                    <Button size="small" danger onClick={async () => {
                      try {
                        if (row._source === "payslip") await axiosInstance.delete(`/payslip-requests/${row._id || row.id}`);
                        else if (row._source === "dtr") await axiosInstance.delete(`/dtr-requests/${row._id || row.id}`);
                        swalSuccess("Deleted"); fetchNotifications();
                      } catch { swalError("Failed to delete"); }
                    }} disabled={!canSeeDev}>Delete</Button>
                  </>)}
                </Space>
              )},
            ]}
          />
        </Section>
      );
      case "bug-reports": return (
        <Section title="Bug Reports">
          <Space style={{ marginBottom: 12 }} wrap>
            <Select size="small" value={bugStatusFilter} style={{ width: 140 }}
              onChange={(v) => { setBugStatusFilter(v); fetchBugReports(1, bugPageSize, { status: v }); }}
              options={[{ label: "Open", value: "open" }, { label: "Resolved", value: "resolved" }, { label: "All", value: "all" }]} />
            <Input.Search size="small" placeholder="Search title/description" allowClear value={bugQuery}
              onChange={(e) => setBugQuery(e.target.value)}
              onSearch={(val) => { setBugQuery(val); fetchBugReports(1, bugPageSize, { q: val }); }}
              style={{ width: 220 }} />
            <Button size="small" onClick={() => fetchBugReports(bugPage, bugPageSize)}>Refresh</Button>
          </Space>
          <Table className="compact-table" size="small" dataSource={bugReports} loading={bugLoading} rowKey={(r) => r._id}
            pagination={{ current: bugPage, pageSize: bugPageSize, total: bugTotal, showSizeChanger: true, pageSizeOptions: [5, 10, 20, 50],
              onChange: (p, s) => fetchBugReports(p, s) }}
            columns={[
              { title: "Title", dataIndex: "title", key: "title", render: (t) => t || "(no title)", width: 180 },
              { title: "Status", dataIndex: "status", key: "status", render: (s) => <Tag color={s === "resolved" ? "green" : "volcano"}>{s || "open"}</Tag>, width: 90 },
              { title: "Reporter", key: "reporter", render: (_, r) => r.reporterName || r.employeeId || "-", width: 140 },
              { title: "Email", dataIndex: "reporterEmail", key: "reporterEmail", render: (e) => e || "-", width: 160 },
              { title: "Page URL", dataIndex: "pageUrl", key: "pageUrl", render: (p) => (p && p.length > 40 ? p.slice(0, 40) + "…" : p || "-"), width: 200 },
              { title: "Created", dataIndex: "createdAt", key: "createdAt", render: (v) => v ? dayjs(v).format("MM/DD/YYYY HH:mm") : "", width: 150 },
              { title: "Action", key: "action", render: (_, row) => (
                <Space>
                  <Button size="small" onClick={() => { setBugDetailObj(row); setBugDetailOpen(true); }}>View</Button>
                  <Button size="small" type={row.status === "resolved" ? "default" : "primary"} onClick={() => toggleBugResolved(row)}>{row.status === "resolved" ? "Reopen" : "Resolve"}</Button>
                  <Button size="small" danger onClick={() => removeBugReport(row)}>Delete</Button>
                </Space>
              ), width: 200 },
            ]}
          />
          <Modal open={bugDetailOpen} onCancel={() => setBugDetailOpen(false)} footer={null} width={640} title={bugDetailObj?.title || "Bug Report Detail"}>
            {bugDetailObj && (
              <Space direction="vertical" style={{ width: "100%" }} size="small">
                <Text type="secondary">Status: {bugDetailObj.status || "open"} • Submitted {bugDetailObj.createdAt ? dayjs(bugDetailObj.createdAt).format("MM/DD/YYYY HH:mm") : ""}</Text>
                {bugDetailObj.reporterName && <Text>Reporter: {bugDetailObj.reporterName}</Text>}
                {bugDetailObj.reporterEmail && <Text>Email: {bugDetailObj.reporterEmail}</Text>}
                {bugDetailObj.pageUrl && <Text>Page: {bugDetailObj.pageUrl}</Text>}
                {bugDetailObj.description && (
                  <div style={{ fontSize: 12, background: "var(--ant-color-bg-container)", border: "1px solid var(--ant-color-border)", borderRadius: 6, padding: 12, whiteSpace: "pre-wrap" }}>
                    {bugDetailObj.description}
                  </div>
                )}
                {bugDetailObj.hasScreenshot && <Alert type="info" message="Screenshot was included with this report." />}
                <Space>
                  <Button size="small" onClick={() => toggleBugResolved(bugDetailObj)}>{bugDetailObj.status === "resolved" ? "Reopen" : "Resolve"}</Button>
                  <Button size="small" danger onClick={() => { removeBugReport(bugDetailObj); setBugDetailOpen(false); }}>Delete</Button>
                </Space>
              </Space>
            )}
          </Modal>
        </Section>
      );
      default: return runtimeTab;
    }
  };

  return (
    <div style={{ width: "100%" }}>
      {!canSeeDev && (
        <Alert type="warning" message="Insufficient permissions" description="You don't have access to Developer Settings." showIcon style={{ marginBottom: 16 }} />
      )}
      {error && (
        <Alert type="error" message="Failed to load runtime info" description={error} showIcon style={{ marginBottom: 16 }} />
      )}

      <Layout className="dev-settings-layout" style={{ minHeight: 600, background: "transparent" }}>
        <Sider
          width={210}
          theme="light"
          collapsed={siderCollapsed}
          onCollapse={setSiderCollapsed}
          collapsible
          trigger={null}
          style={{
            borderRight: "1px solid var(--app-border-color, #f0f0f0)",
            background: "transparent",
            position: "sticky",
            top: 0,
            alignSelf: "flex-start",
            maxHeight: "100vh",
            overflowY: "auto",
          }}
          collapsedWidth={60}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 12px 4px" }}>
            {!siderCollapsed && (
              <Title level={5} style={{ margin: 0, fontSize: 14, whiteSpace: "nowrap" }}>Developer Settings</Title>
            )}
            <Button
              type="text"
              size="small"
              icon={siderCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setSiderCollapsed(!siderCollapsed)}
            />
          </div>
          <Menu
            mode="inline"
            selectedKeys={[activeTab]}
            onClick={({ key }) => setActiveTab(key)}
            items={devSiderItems}
            style={{ borderRight: "none", background: "transparent", fontSize: 13, padding: 0 }}
          />
        </Sider>
        <Content style={{ padding: "0 0 0 4px", minHeight: 500 }}>
          {renderActivePanel()}
        </Content>
      </Layout>

      {/* ── Shared Modals ─────────────────────────────────────────────── */}
      <Modal title="Edit Notification" open={editModalVisible} onCancel={closeEditModal} onOk={handleUpdateNotification} okText="Update">
        <Form form={editForm} layout="vertical">
          <Form.Item name="title" label="Title" rules={[{ required: true, message: "Title is required" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="body" label="Body" rules={[{ required: true, message: "Body is required" }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal title="UAT Deployment Notes" open={deploymentModalOpen} onCancel={() => setDeploymentModalOpen(false)}
        footer={<Button onClick={() => setDeploymentModalOpen(false)}>Close</Button>}
        width={800} styles={{ body: { maxHeight: 600, overflowY: "auto" } }}>
        {loadingDeployment ? (
          <Card loading size="small" />
        ) : (
          <div style={{ fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap" }}>{deploymentNotes}</div>
        )}
      </Modal>
    </div>
  );
};

export default DevSettings;

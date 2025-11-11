import React, { useEffect, useMemo, useState, useContext } from "react";
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
  App as AntApp,
  Row,
  Col,
  Popconfirm,
  DatePicker,
  TimePicker,
  Select,
  Table,
  Modal,
} from "antd";
import dayjs from "dayjs";
import useAuth from "../../../hooks/useAuth";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import { NotificationsContext } from "../../../context/NotificationsContext";
import SecureStorageDiagnostics from "./SecureStorageDiagnostics";
import axiosInstance from "../../../api/axiosInstance";
import DemoModeSettings from "./DemoModeSettings";

const { Title, Text } = Typography;

const Section = ({ title, children, extra }) => (
  <Card title={title} extra={extra} size="small" style={{ marginBottom: 16 }}>
    {children}
  </Card>
);

const DevSettings = () => {
  const { user, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [devInfo, setDevInfo] = useState(null);

  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState(null);
  const [settings, setSettings] = useState(null);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState("runtime");
  const { message } = AntApp.useApp();

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

  // Audit logs and Notifications state
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const notificationsContext = useContext(NotificationsContext);
  const [notifLoading, setNotifLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [editForm] = Form.useForm();

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
      message.error("Failed to load employees");
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
      message.error("Failed to load resigned employees");
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
      message.error("Failed to load employee records");
    } finally {
      setEmpRecordsLoading(false);
    }
  };

  const refreshBiometricLogs = async () => {
    if (!resignedSelected) return;
    try {
      setBioLoading(true);
      const params = { page: 1, pageSize: bioPageSize };
      if (bioRange && bioRange[0] && bioRange[1]) {
        params.dateFrom = bioRange[0].startOf('day').toISOString();
        params.dateTo = bioRange[1].endOf('day').toISOString();
      }
      const res = await axiosInstance.get(`/employees/${resignedSelected._id}/records`, { params });
      const data = res?.data?.data || {};
      setEmpRecords((prev) => ({ ...(prev||{}), ...data }));
      setBioLogs(data?.biometricLogs || []);
      setBioMeta(data?.biometricMeta || null);
      setBioPage(1);
    } catch (e) {
      message.error('Failed to refresh biometrics');
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
        params.dateFrom = bioRange[0].startOf('day').toISOString();
        params.dateTo = bioRange[1].endOf('day').toISOString();
      }
      const res = await axiosInstance.get(`/employees/${resignedSelected._id}/records`, { params });
      const data = res?.data?.data || {};
      const more = data?.biometricLogs || [];
      setBioLogs((prev)=> [...prev, ...more]);
      setBioMeta(data?.biometricMeta || null);
      setBioPage(nextPage);
    } catch (e) {
      message.error('Failed to load more biometrics');
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
          if (!t.isBetween(bioRange[0], bioRange[1], 'day', '[]')) return false;
        }
        // Time-of-day filter
        if (bioTimeFrom || bioTimeTo) {
          const minutes = t.hour()*60 + t.minute();
          const startM = bioTimeFrom ? (bioTimeFrom.hour()*60 + bioTimeFrom.minute()) : null;
          const endM = bioTimeTo ? (bioTimeTo.hour()*60 + bioTimeTo.minute()) : null;
          if (startM !== null && minutes < startM) return false;
          if (endM !== null && minutes > endM) return false;
        }
        return true;
      });
      const header = ['AC-No','Name','Time','State'];
      const lines = [header.join(',')].concat(rows.map(r=>[
        JSON.stringify(r['AC-No']||''),
        JSON.stringify(r['Name']||''),
        JSON.stringify(r['Time']?dayjs(r['Time']).format('YYYY-MM-DD HH:mm'):'') ,
        JSON.stringify(r['State']||'')
      ].join(',')));
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(resignedSelected?.empId||'employee')}-biometrics.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      message.error('Failed to export CSV');
    }
  };

  const restoreResignedEmployee = async (emp) => {
    try {
      await axiosInstance.put(`/employees/${emp._id}/undo-resign`);
      message.success("Employee restored (with records)");
      // refresh lists
      loadResignedEmployees();
      if (activeTab === "employees") loadAllEmployees();
      setResignedDetailsOpen(false);
      setResignedSelected(null);
    } catch (err) {
      message.error("Failed to restore employee");
    }
  };

  const deleteResignedEmployee = async (emp) => {
    try {
      // Fetch a fresh summary right before deleting
      const summaryRes = await axiosInstance.get(`/employees/${emp._id}/records`);
      const s = summaryRes?.data?.data || {};
      Modal.confirm({
        width: 700,
        title: `Delete ${emp.name}?`,
        okText: 'Yes, delete', okButtonProps: { danger: true }, cancelText: 'Cancel',
        content: (
          <div style={{ fontSize: 12 }}>
            <Alert type="warning" showIcon style={{ marginBottom: 8 }} message="This will permanently remove the employee and all linked records. Emp No will be reordered." />
            <Space size={8} wrap>
              <Tag>Docs: {(s.docs||[]).length}</Tag>
              <Tag color="green">Payslip Requests: {(s.payslipRequests||[]).length}</Tag>
              <Tag color="geekblue">DTR Gen Logs: {(s.dtrGenerationLogs||[]).length}</Tag>
              <Tag color="blue">Biometric Logs: {(s.biometricLogs||[]).length}</Tag>
              <Tag color="purple">DTR Requests: {(s.dtrRequests||[]).length}</Tag>
              <Tag color={s.salary? 'gold':'default'}>Salary: {s.salary? 'Yes':'No'}</Tag>
              <Tag color="magenta">Trainings: {(s.trainings||[]).length}</Tag>
            </Space>
          </div>
        ),
        onOk: async () => {
          await axiosInstance.delete(`/employees/${emp._id}`);
          message.success('Employee and related records deleted; Emp No reordered');
          loadResignedEmployees();
          if (activeTab === 'employees') loadAllEmployees();
          setResignedDetailsOpen(false);
          setResignedSelected(null);
        }
      });
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to delete employee');
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
      message.success("Employee marked as resigned");
      setResignModalOpen(false);
      setSelectedEmployee(null);
      resignForm.resetFields();
      // Refresh lists
      loadAllEmployees();
      // Also refresh resigned tab data in case it is viewed next
      loadResignedEmployees();
    } catch (err) {
      message.error(
        err?.response?.data?.message || "Failed to mark employee as resigned"
      );
    }
  };

  const handleUndoResign = async (emp) => {
    try {
      const target = emp || selectedEmployee;
      if (!target) return;
      await axiosInstance.put(`/employees/${target._id}/undo-resign`);
      message.success("Employee restored");
      // Refresh lists
      loadAllEmployees();
      loadResignedEmployees();
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to undo resign");
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
      message.success("Notification updated");
      closeEditModal();
      fetchNotifications();
    } catch (err) {
      message.error("Failed to update notification");
    }
  };

  const removeNotification = async (row) => {
    try {
      await axiosInstance.delete(`/dev/notifications/${row._id}`);
      message.success("Notification deleted");
      fetchNotifications();
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
      message.error("Failed to delete notification");
    }
  };

  const markDataRequestRead = async (row) => {
    try {
      if (row._source === "payslip") {
        await axiosInstance.put(`/payslip-requests/${row._id}/read`);
      } else if (row._source === "dtr") {
        await axiosInstance.put(`/dtr-requests/${row._id}/read`);
      }
      message.success("Marked as read");
      fetchNotifications();
    } catch (err) {
      message.error("Failed to mark as read");
    }
  };

  // Audit logs
  const fetchAuditLogs = async () => {
    try {
      setAuditLoading(true);
      const res = await axiosInstance.get("/dev/audit-logs");
      const rows = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];
      setAuditLogs(rows);
    } catch (err) {
      message.error("Failed to load audit logs");
    } finally {
      setAuditLoading(false);
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
      message.error("Failed to load requests");
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
      message.success("Visibility updated");
      fetchNotifications();
    } catch (err) {
      message.error("Failed to update visibility");
    }
  };

  const toggleDataVisibility = async (row) => {
    try {
      await axiosInstance.put(`/dev/notifications/${row._id}`, {
        dataVisible: !row.dataVisible,
      });
      message.success("Data visibility updated");
      fetchNotifications();
    } catch (err) {
      message.error("Failed to update data visibility");
    }
  };

  const openEditModal = (row) => {
    setEditingRow(row);
    editForm.setFieldsValue({ title: row.title || "", body: row.body || "" });
    setEditModalVisible(true);
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
      message.success("Settings updated");
      setSettings(values);
      // Notify ThemeContext to re-fetch and apply CSS variables
      window.dispatchEvent(new Event("app-settings-updated"));
    } catch (err) {
      message.error(
        err?.response?.data?.message ||
          err.message ||
          "Failed to update settings"
      );
    }
  };

  const runtimeTab = (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Section
        title="Application"
        extra={
          <Button onClick={() => window.location.reload()}>Reload App</Button>
        }
      >
        {loading || !devInfo ? (
          <Card loading />
        ) : (
          <Descriptions size="small" column={1}>
            <Descriptions.Item label="Node Version">
              {devInfo.app.node}
            </Descriptions.Item>
            <Descriptions.Item label="Environment">
              {devInfo.app.env}
            </Descriptions.Item>
            <Descriptions.Item label="Server Host">
              {devInfo.app.serverHost}
            </Descriptions.Item>
            <Descriptions.Item label="Server Port">
              {devInfo.app.serverPort}
            </Descriptions.Item>
            <Descriptions.Item label="Client Origin">
              {devInfo.app.clientOrigin || <Tag>not set</Tag>}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Section>

      <Section title="Database">
        {loading || !devInfo ? (
          <Card loading />
        ) : (
          <Descriptions
            size="small"
            column={1}
            extra={
              <Tag color={devInfo.db.connected ? "green" : "red"}>
                {devInfo.db.connected ? "Connected" : "Disconnected"}
              </Tag>
            }
          >
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
      </Section>

      <Section title="Email">
        {loading || !devInfo ? (
          <Card loading />
        ) : (
          <Descriptions size="small" column={1}>
            <Descriptions.Item label="Configured">
              {devInfo.email.configured ? (
                <Tag color="green">yes</Tag>
              ) : (
                <Tag color="red">no</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="User">
              {devInfo.email.user || <Tag>not set</Tag>}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Section>

      <Section title="Google Drive">
        {loading || !devInfo ? (
          <Card loading />
        ) : (
          <Descriptions size="small" column={1}>
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
        )}
      </Section>

      <Section title="Socket.IO">
        {loading || !devInfo ? (
          <Card loading />
        ) : (
          <Descriptions size="small" column={1}>
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
      </Section>

      <Divider />
      <Text type="secondary">
        Tip: sensitive values (passwords, tokens, URIs) are intentionally
        omitted here.
      </Text>
    </Space>
  );

  const fetchAttendancePreview = async (range) => {
    try {
      setAttendanceLoading(true);
      // Use provided range or fallback to saved attendanceRange in state
      const r = range || attendanceRange;
      if (!r || r.length !== 2) {
        message.warning("Please select a start and end date to preview.");
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

      setAttendanceData(formatted);
      if (!formatted.length) {
        message.info("No attendance rows found for the selected range.");
      } else {
        message.success(`Loaded ${formatted.length} attendance rows`);
      }
    } catch (err) {
      console.error("Attendance preview error:", err);
      const em =
        err?.response?.data?.message ||
        err.message ||
        "Failed to load attendance preview";
      message.error(em);
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
      message.success("Developer override updated");
    } catch (err) {
      message.error("Failed to update settings");
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
          </Row>

          <Table
            className="compact-table"
            columns={attendanceColumns}
            dataSource={attendanceData}
            loading={attendanceLoading}
            size="small"
            rowKey={(r) => `${r.empId}-${r.date}`}
            pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [5,10,20,50] }}
          />
        </Space>
      </Section>
    </>
  );

  // DB & Maintenance tab
  const loadCollections = async () => {
    try {
      setCollectionsLoading(true);
      const res = await axiosInstance.get("/dev/collections");
      if (res.data && res.data.success) setCollections(res.data.data || []);
    } catch (err) {
      message.error("Failed to load collections");
    } finally {
      setCollectionsLoading(false);
    }
  };

  const handleBackup = async () => {
    if (!selectedCollection) return message.warning("Select collection");
    try {
      // create async job
      const res = await axiosInstance.post("/dev/backup-jobs", {
        collection: selectedCollection,
        format: backupFormat,
      });
      message.success("Backup job queued");
      fetchJobs();
    } catch (err) {
      message.error("Failed to queue backup job");
    }
  };

  const fetchJobs = async () => {
    try {
      setJobsLoading(true);
      const res = await axiosInstance.get("/dev/backup-jobs");
      if (res.data && res.data.data) setBackupJobs(res.data.data);
    } catch (err) {
      message.error("Failed to load backup jobs");
    } finally {
      setJobsLoading(false);
    }
  };

  const deleteJob = async (jobId) => {
    try {
      await axiosInstance.delete(`/dev/backup-jobs/${jobId}`);
      message.success("Job deleted");
      fetchJobs();
    } catch (err) {
      message.error("Failed to delete job");
    }
  };

  const clearJobs = async (status = "done") => {
    try {
      await axiosInstance.delete(`/dev/backup-jobs`, { params: { status } });
      message.success("Jobs cleared");
      fetchJobs();
    } catch (err) {
      message.error("Failed to clear jobs");
    }
  };

  // Direct download without queueing, using /dev/backup
  const downloadCollectionNow = async () => {
    if (!selectedCollection) return message.warning("Select collection");
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
      message.error("Failed to download backup");
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
      message.error("Failed to download backup");
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
      message.success("Maintenance settings updated");
      setMaintenanceEnabled(!!payload.maintenance.enabled);
    } catch (err) {
      message.error("Failed to update maintenance settings");
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
          <Card size="small" title="Database Status" bodyStyle={{ fontSize: 12 }}>
            {loading || !devInfo ? (
              <Card loading />
            ) : (
              <Descriptions size="small" column={1} labelStyle={{ fontSize: 12 }} contentStyle={{ fontSize: 12 }}>
                <Descriptions.Item label="Connected">
                  <Tag color={devInfo.db.connected ? "green" : "red"}>{devInfo.db.connected ? "yes" : "no"}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="DB Name">{devInfo.db.name || "unknown"}</Descriptions.Item>
                <Descriptions.Item label="Host">{devInfo.db.host || "unknown"}</Descriptions.Item>
                <Descriptions.Item label="Port">{devInfo.db.port || "unknown"}</Descriptions.Item>
                <Descriptions.Item label="Runtime">{devInfo.app.node}</Descriptions.Item>
              </Descriptions>
            )}
            <Button size="small" style={{ marginTop: 12 }} onClick={loadCollections} loading={collectionsLoading}>
              Load Collections
            </Button>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card size="small" title="Maintenance Mode" bodyStyle={{ fontSize: 12 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <Switch checked={maintenanceEnabled} onChange={(v) => setMaintenanceEnabled(v)} />
                <span>Enable Maintenance Mode (developers excluded)</span>
              </div>
              <DatePicker.RangePicker size="small" value={maintenanceRange} onChange={(vals) => setMaintenanceRange(vals)} />
              <Input.TextArea rows={3} value={maintenanceMessage} onChange={(e) => setMaintenanceMessage(e.target.value)} placeholder="Maintenance message shown to users" />
              <Space>
                <Button size="small" type="primary" onClick={() => saveMaintenance(true)} loading={maintenanceLoading} disabled={!maintenanceRange || maintenanceRange.length !== 2}>
                  Enable
                </Button>
                <Button size="small" danger onClick={() => saveMaintenance(false)} loading={maintenanceLoading}>
                  Disable
                </Button>
              </Space>
              <Card size="small" title="Preview (Non-developer view)">
                <div style={{ padding: 12, background: "#fff", fontSize: 12 }}>
                  <h3 style={{ marginTop: 0, fontSize: 14 }}>Maintenance</h3>
                  <p style={{ marginBottom: 4 }}>{maintenanceMessage || "No message set"}</p>
                  {maintenanceRange && maintenanceRange.length === 2 && (
                    <p style={{ color: "#999", fontSize: 11 }}>
                      {maintenanceRange[0].format("MM/DD/YYYY hh:mm A")} - {maintenanceRange[1].format("MM/DD/YYYY hh:mm A")}
                    </p>
                  )}
                </div>
              </Card>
            </Space>
          </Card>
        </Col>
      </Row>
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24}>
          <Card size="small" title="Backup Collections" bodyStyle={{ fontSize: 12 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Row gutter={[8, 8]} align="middle">
                <Col xs={24} md={12}>
                  <Select
                    size="small"
                    placeholder="Select collection"
                    value={selectedCollection}
                    onChange={setSelectedCollection}
                    options={collections.map((c) => ({ label: c.name, value: c.name }))}
                    loading={collectionsLoading}
                    style={{ width: "100%" }}
                  />
                </Col>
                <Col xs={12} md={6}>
                  <Select
                    size="small"
                    value={backupFormat}
                    onChange={setBackupFormat}
                    options={[{ label: "JSON", value: "json" }, { label: "CSV", value: "csv" }]}
                    style={{ width: "100%" }}
                  />
                </Col>
                <Col xs={12} md={6}>
                  <Space wrap>
                    <Button size="small" onClick={downloadCollectionNow} disabled={!selectedCollection}>Download</Button>
                    <Button size="small" type="primary" onClick={handleBackup} disabled={!selectedCollection}>Queue</Button>
                  </Space>
                </Col>
              </Row>

              <Row gutter={[8, 8]} align="middle">
                <Col>
                  <Space wrap>
                    <Button size="small" onClick={fetchJobs} loading={jobsLoading}>Refresh Jobs</Button>
                    <Popconfirm title="Clear completed/failed jobs?" onConfirm={() => clearJobs("done")}>
                      <Button size="small" danger>Clear Completed</Button>
                    </Popconfirm>
                  </Space>
                </Col>
              </Row>

              <Row gutter={[8, 8]}>
                <Col xs={24} sm={12} md={8}>
                  <Select
                    size="small"
                    value={jobStatusFilter}
                    onChange={setJobStatusFilter}
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
                    onChange={setJobCollectionFilter}
                    options={[{ label: "All Collections", value: "all" }, ...jobCollections.map((c) => ({ label: c, value: c }))]}
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
                pagination={{ pageSize: 5, showSizeChanger: true, pageSizeOptions: [5,10,20,50] }}
                columns={[
                  { title: "Collection", dataIndex: "collection", key: "collection" },
                  { title: "Format", dataIndex: "format", key: "format" },
                  {
                    title: "Status",
                    dataIndex: "status",
                    key: "status",
                    render: (v) => (
                      <Tag color={v === "completed" ? "green" : v === "failed" ? "red" : "blue"}>{v}</Tag>
                    ),
                  },
                  { title: "Requested By", dataIndex: "requestedByName", key: "requestedByName" },
                  {
                    title: "Created",
                    dataIndex: "createdAt",
                    key: "createdAt",
                    render: (v) => (v ? dayjs(v).format("MM/DD/YYYY hh:mm A") : ""),
                  },
                  {
                    title: "Action",
                    key: "action",
                    render: (_, row) => (
                      <Space>
                        {row.status === "completed" && row.resultPath ? (
                          <Button size="small" onClick={() => downloadBackupJob(row)}>Download</Button>
                        ) : row.status === "failed" ? (
                          <Text type="danger">Failed</Text>
                        ) : (
                          <Text type="secondary">{row.status}</Text>
                        )}
                        <Popconfirm title="Delete this job?" onConfirm={() => deleteJob(row._id)}>
                          <Button size="small" danger>Delete</Button>
                        </Popconfirm>
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
        pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [5,10,20,50] }}
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
        styles={{ body: { maxHeight: 600, overflowY: 'auto' } }}
        title={resignedSelected ? `Resigned: ${resignedSelected.name}` : 'Resigned Employee'}
        open={resignedDetailsOpen}
        onCancel={() => { setResignedDetailsOpen(false); setResignedSelected(null); setEmpRecords(null); setBioRange(null); }}
        footer={null}
      >
        {resignedSelected && (
          <div style={{ fontSize: 12, lineHeight: 1.4 }}>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <Card size="small" bodyStyle={{ padding: 8 }} title={<span style={{ fontSize: 13 }}>Basic Info</span>}>
                <Descriptions size="small" column={3} bordered labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 11 }}>
                  <Descriptions.Item label="Emp ID">{resignedSelected.empId}</Descriptions.Item>
                  <Descriptions.Item label="Emp No">{resignedSelected.empNo}</Descriptions.Item>
                  <Descriptions.Item label="Type">{resignedSelected.empType}</Descriptions.Item>
                  <Descriptions.Item label="Division">{resignedSelected.division}</Descriptions.Item>
                  <Descriptions.Item label="Section/Unit">{resignedSelected.sectionOrUnit}</Descriptions.Item>
                  <Descriptions.Item label="Resigned At">{resignedSelected.resignedAt ? dayjs(resignedSelected.resignedAt).format('YYYY-MM-DD') : ''}</Descriptions.Item>
                </Descriptions>
              </Card>
              <Alert type="warning" style={{ fontSize: 11 }} showIcon message={<span style={{ fontSize: 12 }}>Deletion will remove employee, salary, payslip requests, generation logs, documents, and training participation.</span>} />
              <Space style={{ justifyContent:'space-between', width:'100%' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>Employee Records (collapsible)</Text>
                <Space>
                  <Popconfirm title="Restore this employee?" okText="Restore" cancelText="Cancel" onConfirm={() => restoreResignedEmployee(resignedSelected)}>
                    <Button size="small" type="primary">Restore</Button>
                  </Popconfirm>
                  <Popconfirm title="Delete this employee?" okText="Delete" okButtonProps={{ danger:true }} cancelText="Cancel" description="This action cannot be undone." onConfirm={() => deleteResignedEmployee(resignedSelected)}>
                    <Button size="small" danger>Delete</Button>
                  </Popconfirm>
                </Space>
              </Space>
              <Card size="small" bodyStyle={{ padding: 8 }} title={<span style={{ fontSize: 13 }}>Summary</span>} loading={empRecordsLoading}>
                {empRecords && (
                  <Space size={16} wrap>
                    <Tag color="blue" style={{ fontSize:11, padding:'2px 6px' }}>Docs: {(empRecords.docs||[]).length}</Tag>
                    <Tag color="green" style={{ fontSize:11, padding:'2px 6px' }}>Payslip Requests: {(empRecords.payslipRequests||[]).length}</Tag>
                    <Tag color="geekblue" style={{ fontSize:11, padding:'2px 6px' }}>DTR Logs: {(empRecords.dtrGenerationLogs||[]).length}</Tag>
                    <Tag color="blue" style={{ fontSize:11, padding:'2px 6px' }}>Biometric Logs: {empRecords?.biometricMeta?.total ?? (empRecords.biometricLogs||[]).length}</Tag>
                    <Tag color="purple" style={{ fontSize:11, padding:'2px 6px' }}>Trainings: {(empRecords.trainings||[]).length}</Tag>
                    <Tag color={empRecords.salary? 'gold':'default'} style={{ fontSize:11, padding:'2px 6px' }}>Salary: {empRecords.salary? 'Yes':'No'}</Tag>
                  </Space>
                )}
              </Card>
              <Collapse size="small" accordion>
                <Collapse.Panel header={<span style={{ fontSize:12 }}>Documents</span>} key="docs">
                  <Table className="compact-table" size="small" scroll={{y:200}} pagination={false} rowKey={r=>r._id} dataSource={empRecords?.docs||[]} columns={[
                    { title:'Type', dataIndex:'docType', key:'docType', width:120 },
                    { title:'Reference', dataIndex:'reference', key:'reference' },
                    { title:'Period', dataIndex:'period', key:'period', width:110 },
                    { title:'Issued', dataIndex:'dateIssued', key:'dateIssued', width:110, render:v=>v?dayjs(v).format('YYYY-MM-DD'):'' },
                  ]} />
                </Collapse.Panel>
                <Collapse.Panel header={<span style={{ fontSize:12 }}>Payslip Requests</span>} key="payslips">
                  <Table className="compact-table" size="small" scroll={{y:200}} pagination={false} rowKey={r=>r._id} dataSource={empRecords?.payslipRequests||[]} columns={[
                    { title:'Period', dataIndex:'period', key:'period', width:120 },
                    { title:'Email', dataIndex:'email', key:'email' },
                    { title:'Status', dataIndex:'status', key:'status', width:100 },
                    { title:'Created', dataIndex:'createdAt', key:'createdAt', width:110, render:v=>v?dayjs(v).format('YYYY-MM-DD'):'' },
                  ]} />
                </Collapse.Panel>
                <Collapse.Panel header={<span style={{ fontSize:12 }}>DTR Generation Logs</span>} key="dtr">
                  <Table className="compact-table" size="small" scroll={{y:200}} pagination={false} rowKey={r=>r._id} dataSource={empRecords?.dtrGenerationLogs||[]} columns={[
                    { title:'Period', dataIndex:'period', key:'period', width:120 },
                    { title:'Generated By', dataIndex:'generatedBy', key:'generatedBy' },
                    { title:'Created', dataIndex:'createdAt', key:'createdAt', width:110, render:v=>v?dayjs(v).format('YYYY-MM-DD'):'' },
                  ]} />
                </Collapse.Panel>
                <Collapse.Panel header={<span style={{ fontSize:12 }}>Biometrics Logs</span>} key="biometrics">
                  <div style={{ fontSize: 11, lineHeight: 1.3 }}>
                    <Space size={6} style={{ marginBottom: 8, flexWrap:'wrap' }}>
                      <DatePicker.RangePicker
                        size="small"
                        onChange={(v)=> setBioRange(v)}
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
                      <Button size="small" onClick={refreshBiometricLogs} loading={bioLoading}>Apply</Button>
                      <Button size="small" onClick={()=>{ setBioRange(null); setBioTimeFrom(null); setBioTimeTo(null); refreshBiometricLogs(); }}>Reset</Button>
                      <Button size="small" onClick={exportBiometricsCSV} disabled={(bioLogs||[]).length===0}>Export CSV</Button>
                      {bioMeta && (
                        <Tag color="processing" style={{ marginLeft: 6 }}>Total: {bioMeta.total} • Showing {bioLogs.length}</Tag>
                      )}
                    </Space>
                    <div className="bio-tight">
                      <Table
                        className="compact-table"
                        size="small"
                        scroll={{ y: 220 }}
                        pagination={false}
                        rowKey={r=>r._id}
                        dataSource={(bioLogs||[]).filter(r=>{
                          const t = r?.Time ? dayjs(r.Time) : null;
                          if (!t) return false;
                          // Date filter (client side safeguard)
                          if (bioRange && bioRange[0] && bioRange[1]) {
                            if (!t.isBetween(bioRange[0], bioRange[1], 'day', '[]')) return false;
                          }
                          // Time-of-day filter
                          if (bioTimeFrom || bioTimeTo) {
                            const minutes = t.hour()*60 + t.minute();
                            const startM = bioTimeFrom ? (bioTimeFrom.hour()*60 + bioTimeFrom.minute()) : null;
                            const endM = bioTimeTo ? (bioTimeTo.hour()*60 + bioTimeTo.minute()) : null;
                            if (startM !== null && minutes < startM) return false;
                            if (endM !== null && minutes > endM) return false;
                          }
                          return true;
                        })}
                        columns={[
                          { title:<span style={{fontSize:11}}>AC-No</span>, dataIndex:'AC-No', key:'acno', width:110, render:v=> <span style={{fontSize:11}}>{v}</span> },
                          { title:<span style={{fontSize:11}}>Name</span>, dataIndex:'Name', key:'name', render:v=> <span style={{fontSize:11}}>{v}</span> },
                          { title:<span style={{fontSize:11}}>Time</span>, dataIndex:'Time', key:'time', width:150, render:v=> <span style={{fontSize:11}}>{v?dayjs(v).format('YYYY-MM-DD HH:mm'):''}</span> },
                          { title:<span style={{fontSize:11}}>State</span>, dataIndex:'State', key:'state', width:90, render:v=> <span style={{fontSize:11}}>{v}</span> },
                        ]}
                      />
                      <div style={{ marginTop: 8, display:'flex', gap:8, alignItems:'center' }}>
                        <Button size="small" onClick={loadMoreBiometrics} disabled={!bioMeta?.hasMore} loading={bioLoading}>
                          {bioMeta?.hasMore ? 'Load more' : 'No more'}
                        </Button>
                        {bioMeta && <Text type="secondary">Page {bioMeta.page} • Returned {bioMeta.returned}</Text>}
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
                <Collapse.Panel header={<span style={{ fontSize:12 }}>Trainings</span>} key="trainings">
                  <Table className="compact-table" size="small" scroll={{y:200}} pagination={false} rowKey={r=>r._id} dataSource={empRecords?.trainings||[]} columns={[
                    { title:'Name', dataIndex:'name', key:'name' },
                    { title:'Host', dataIndex:'host', key:'host', width:120 },
                    { title:'Venue', dataIndex:'venue', key:'venue', width:120 },
                    { title:'Date', dataIndex:'trainingDate', key:'trainingDate', width:110, render:v=>v?dayjs(v).format('YYYY-MM-DD'):'' },
                  ]} />
                </Collapse.Panel>
                <Collapse.Panel header={<span style={{ fontSize:12 }}>Salary</span>} key="salary">
                  {empRecords?.salary ? (
                    <Descriptions size="small" column={3} bordered labelStyle={{ fontSize:11 }} contentStyle={{ fontSize:11 }}>
                      <Descriptions.Item label="Type">{empRecords.salary.salaryType}</Descriptions.Item>
                      <Descriptions.Item label="Payroll Type">{empRecords.salary.payrollType}</Descriptions.Item>
                      <Descriptions.Item label="Basic Salary">{empRecords.salary.basicSalary}</Descriptions.Item>
                      <Descriptions.Item label="Rate/Month">{empRecords.salary.ratePerMonth}</Descriptions.Item>
                    </Descriptions>
                  ) : <Text type="secondary" style={{ fontSize:11 }}>No salary record</Text>}
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
          pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [5,10,20,50] }}
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

  return (
    <Space direction="vertical" style={{ width: "100%" }}>
  <Title level={3}>Developer Settings {isDemoUser && <Tag color="blue">Demo User</Tag>}</Title>
      {!canSeeDev && (
        <Alert
          type="warning"
          message="Insufficient permissions"
          description="You don't have access to Developer Settings."
          showIcon
        />
      )}
      {error && (
        <Alert
          type="error"
          message="Failed to load runtime info"
          description={error}
          showIcon
        />
      )}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "runtime",
            label: "Runtime",
            children: runtimeTab,
          },
          {
            key: "employees",
            label: "Employees",
            children: employeesTab,
            forceRender: true,
          },
          {
            key: "attendance-preview",
            label: "Attendance Preview",
            children: attendanceTab,
            forceRender: true,
          },
          {
            key: "db-maintenance",
            label: "Database & Maintenance",
            children: dbMaintenanceTab,
            forceRender: true,
          },
          {
            key: "app-settings",
            label: "Application Settings",
            children: appSettingsTab,
            forceRender: true,
          },
          {
            key: "demo-mode",
            label: "Demo Mode",
            children: (
              <Section title="Demo Mode Configuration" extra={settings?.demo?.enabled ? <Tag color="blue">Active</Tag> : <Tag>Disabled</Tag>}>
                <DemoModeSettings settings={settings} onUpdated={(next)=>{ setSettings(next); window.dispatchEvent(new Event('app-settings-updated')); }} />
              </Section>
            ),
            forceRender: true,
          },
          {
            key: "secure-storage",
            label: "Secure Storage",
            children: (
              <Section title="Secure Storage Diagnostics">
                <SecureStorageDiagnostics />
              </Section>
            ),
            forceRender: true,
          },
          {
            key: "audit-logs",
            label: "Audit Logs",
            children: (
              <Section title="Audit Logs">
                <Button onClick={fetchAuditLogs}>Refresh</Button>
                <Table
                  className="compact-table"
                  size="small"
                  dataSource={auditLogs}
                  loading={auditLoading}
                  rowKey={(r) => r._id}
                  pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [5,10,20,50] }}
                  columns={[
                    { title: "Action", dataIndex: "action", key: "action" },
                    { title: "By", dataIndex: "performedByName", key: "by" },
                    {
                      title: "When",
                      dataIndex: "createdAt",
                      key: "createdAt",
                      render: (v) =>
                        v ? dayjs(v).format("MM/DD/YYYY HH:mm") : "",
                    },
                    {
                      title: "Details",
                      dataIndex: "details",
                      key: "details",
                      render: (d) => JSON.stringify(d),
                    },
                  ]}
                />
              </Section>
            ),
            forceRender: true,
          },
          {
            key: "notifications",
            label: "Notifications",
            children: (
              <Section title="Notifications">
                <Space style={{ marginBottom: 12 }}>
                  <Button onClick={fetchNotifications}>Refresh</Button>
                </Space>
                <Table
                  className="compact-table"
                  size="small"
                  dataSource={notifications}
                  loading={notifLoading}
                  rowKey={(r) => r._id}
                  pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [5,10,20,50] }}
                  columns={[
                    {
                      title: "Title",
                      dataIndex: "title",
                      key: "title",
                      render: (t, r) =>
                        t || r.title || (r._source === "dev" ? r.title : ""),
                    },
                    {
                      title: "Body",
                      dataIndex: "body",
                      key: "body",
                      render: (b, r) => {
                        // Respect per-notification data visibility for dev notifications
                        if (r._source === "dev") {
                          if (r.dataVisible === false)
                            return <Text type="secondary">[hidden]</Text>;
                          const text = b || r.body || "";
                          return text.length > 100
                            ? text.slice(0, 100) + "..."
                            : text;
                        }
                        const text = b || r.body || "";
                        return text && text.length > 100
                          ? text.slice(0, 100) + "..."
                          : text;
                      },
                    },
                    {
                      title: "Visible",
                      dataIndex: "dataVisible",
                      key: "dataVisible",
                      render: (v, r) => {
                        // For developer notifications, Visible maps to dataVisible
                        if (r._source === "dev") {
                          return (
                            <Switch
                              checked={!!r.dataVisible}
                              onChange={() => toggleDataVisibility(r)}
                              disabled={!canSeeDev}
                            />
                          );
                        }

                        // For other notification sources, Visible maps to !hidden
                        const hidden = !!r.hidden;
                        return (
                          <Switch
                            checked={!hidden}
                            onChange={() => toggleNotificationHidden(r)}
                            disabled={!canSeeDev}
                          />
                        );
                      },
                    },
                    {
                      title: "Source",
                      dataIndex: "_source",
                      key: "_source",
                      render: (s) => s || "dev",
                    },
                    {
                      title: "Created",
                      dataIndex: "createdAt",
                      key: "createdAt",
                      render: (v) =>
                        v ? dayjs(v).format("MM/DD/YYYY HH:mm") : "",
                    },
                    {
                      // Hidden status duplicates the Visible switch; omit to avoid redundancy
                    },
                    {
                      title: "Action",
                      key: "action",
                      render: (_, row) => (
                        <Space>
                          {row._source === "dev" && (
                            <>
                              <Button
                                size="small"
                                onClick={() => toggleNotificationHidden(row)}
                              >
                                {row.hidden ? "Show" : "Hide"}
                              </Button>
                              <Button
                                size="small"
                                onClick={() => openEditModal(row)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="small"
                                danger
                                onClick={() => removeNotification(row)}
                              >
                                Delete
                              </Button>
                            </>
                          )}
                          {(row._source === "payslip" ||
                            row._source === "dtr") && (
                            <>
                              <Button
                                size="small"
                                onClick={() => markDataRequestRead(row)}
                                disabled={row.read}
                              >
                                Mark read
                              </Button>
                              <Button
                                size="small"
                                danger
                                onClick={async () => {
                                  try {
                                    if (row._source === "payslip") {
                                      await axiosInstance.delete(
                                        `/payslip-requests/${row._id || row.id}`
                                      );
                                    } else if (row._source === "dtr") {
                                      await axiosInstance.delete(
                                        `/dtr-requests/${row._id || row.id}`
                                      );
                                    }
                                    message.success("Deleted");
                                    fetchNotifications();
                                  } catch (err) {
                                    message.error("Failed to delete");
                                  }
                                }}
                                disabled={!canSeeDev}
                              >
                                Delete
                              </Button>
                            </>
                          )}
                        </Space>
                      ),
                    },
                  ]}
                />
              </Section>
            ),
            forceRender: true,
          },
        ]}
      />
      <Modal
        title="Edit Notification"
        open={editModalVisible}
        onCancel={closeEditModal}
        onOk={handleUpdateNotification}
        okText="Update"
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: "Title is required" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="body"
            label="Body"
            rules={[{ required: true, message: "Body is required" }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default DevSettings;

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
  Select,
  Table,
  Modal,
} from "antd";
import dayjs from "dayjs";
import useAuth from "../../../hooks/useAuth";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import { NotificationsContext } from "../../../context/NotificationsContext";
import axiosInstance from "../../../api/axiosInstance";

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

  const fetchAuditLogs = async () => {
    try {
      setAuditLoading(true);
      const res = await axiosInstance.get("/dev/audit-logs?limit=100");
      if (res.data && res.data.data) setAuditLogs(res.data.data);
    } catch (err) {
      message.error("Failed to load audit logs");
    } finally {
      setAuditLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      setNotifLoading(true);
      const res = await axiosInstance.get("/dev/notifications");
      // Fetch dev notifications, payslip requests, and dtr generation logs and merge
      const devItems = res.data && res.data.data ? res.data.data : [];
      // notify HomePage about dev notifications specifically
      try {
        window.dispatchEvent(
          new CustomEvent("devNotificationsUpdated", { detail: devItems })
        );
      } catch (e) {
        // ignore
      }

      // Fetch data requests (payslip requests and dtr generation logs)
      let payslipItems = [];
      let dtrItems = [];
      try {
        const [pRes, dRes] = await Promise.all([
          axiosInstance.get("/payslip-requests"),
          axiosInstance.get("/dtrlogs"),
        ]);
        payslipItems = pRes?.data?.data || pRes?.data || [];
        dtrItems = dRes?.data?.data || dRes?.data || [];
      } catch (err) {
        // Non-fatal: show dev notifications even if these fail
        console.debug("Failed to load payslip/dtr items", err);
      }

      // Normalize and merge into unified notifications array
      const normalized = [
        ...devItems.map((n) => ({
          ...n,
          _source: "dev",
          id: n._id || n.id,
        })),
        ...payslipItems.map((p) => ({
          ...p,
          _source: "payslip",
          title: `Payslip Request - ${p.employeeId || ""}`,
          body: `Period: ${p.period || ""} • Status: ${p.status || ""}`,
          id: p._id || p.id,
        })),
        ...dtrItems.map((d) => ({
          ...d,
          _source: "dtr",
          title: `DTR Generation - ${d.employeeId || ""}`,
          body: `Period: ${d.period || ""} • By: ${
            d.generatedBy || d.generatedBy
          }`,
          id: d._id || d.id,
        })),
      ];

      setNotifications(normalized);
      // Also update global notifications context so header/popover reflects changes
      try {
        const { setNotifications: setGlobalNotifications } =
          notificationsContext || {};
        if (typeof setGlobalNotifications === "function") {
          // Only include non-hidden regular notifications in the global list
          const visibleRegular = normalized.filter(
            (n) => n._source !== "dev" && !n.hidden
          );
          setGlobalNotifications(
            visibleRegular.map((n) => ({ ...n, id: n._id || n.id }))
          );
        }
      } catch (e) {
        // ignore
      }
    } catch (err) {
      message.error("Failed to load notifications");
    } finally {
      setNotifLoading(false);
    }
  };

  // Auto-load dev notifications when the Notifications tab becomes active
  useEffect(() => {
    if (activeTab === "notifications" && canSeeDev) {
      fetchNotifications();
    }
  }, [activeTab, canSeeDev]);

  const toggleNotificationHidden = async (row) => {
    try {
      if (row._source === "dev") {
        await axiosInstance.put(`/dev/notifications/${row._id || row.id}`, {
          hidden: !row.hidden,
        });
      } else if (row._source === "payslip") {
        await axiosInstance.put(`/payslip-requests/${row._id || row.id}`, {
          hidden: !row.hidden,
        });
      } else if (row._source === "dtr") {
        await axiosInstance.put(`/dtrlogs/${row._id || row.id}`, {
          hidden: !row.hidden,
        });
      } else {
        // fallback to dev notifications endpoint
        await axiosInstance.put(`/dev/notifications/${row._id || row.id}`, {
          hidden: !row.hidden,
        });
      }
      message.success("Notification updated");
      fetchNotifications();
      // Update global notifications context: remove or update the affected item
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
      console.error(
        "toggleNotificationHidden error",
        err?.response?.data || err.message || err
      );
      message.error("Failed to update notification");
    }
  };

  const toggleDataVisibility = async (row) => {
    try {
      await axiosInstance.put(`/dev/notifications/${row._id}`, {
        dataVisible: !row.dataVisible,
      });
      message.success("Notification visibility updated");
      fetchNotifications();
      // update dev notifications event so header reflect change
      try {
        const { setNotifications: setGlobalNotifications } =
          notificationsContext || {};
        if (typeof setGlobalNotifications === "function") {
          // if this dev item is present in global notifications, update title/body placeholder
          setGlobalNotifications((prev) =>
            prev.map((n) => {
              if ((n._id || n.id) === (row._id || row.id)) {
                return {
                  ...n,
                  title: !row.dataVisible ? "[hidden]" : n.title,
                  body: !row.dataVisible ? "[hidden]" : n.body,
                };
              }
              return n;
            })
          );
        }
      } catch (e) {}
    } catch (err) {
      message.error("Failed to update visibility");
    }
  };

  const openEditModal = (row) => {
    setEditingRow(row);
    editForm.setFieldsValue({ title: row.title, body: row.body });
    setEditModalVisible(true);
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
        await axiosInstance.put(`/dtrlogs/${row._id}/read`);
      }
      message.success("Marked as read");
      fetchNotifications();
    } catch (err) {
      message.error("Failed to mark as read");
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
            columns={attendanceColumns}
            dataSource={attendanceData}
            loading={attendanceLoading}
            size="small"
            rowKey={(r) => `${r.empId}-${r.date}`}
            pagination={{ pageSize: 10 }}
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

  // Derived collections from jobs for filter options
  const jobCollections = useMemo(() => {
    const names = (backupJobs || [])
      .map((j) => j?.collection)
      .filter(Boolean);
    return Array.from(new Set(names));
  }, [backupJobs]);

  // Apply filters to jobs list
  const filteredJobs = useMemo(() => {
    return (backupJobs || []).filter((j) => {
      const statusOk =
        jobStatusFilter === "all" || (j?.status || "").toLowerCase() === jobStatusFilter;
      const collOk =
        jobCollectionFilter === "all" || (j?.collection || "") === jobCollectionFilter;
      return statusOk && collOk;
    });
  }, [backupJobs, jobStatusFilter, jobCollectionFilter]);

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

  const dbMaintenanceTab = (
    <>
      <Section title="Database & Maintenance">
        <Space direction="vertical" style={{ width: "100%" }}>
          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Card size="small" title="Database Status">
                {loading || !devInfo ? (
                  <Card loading />
                ) : (
                  <Descriptions size="small" column={1}>
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
                  style={{ marginTop: 12 }}
                  onClick={loadCollections}
                  loading={collectionsLoading}
                >
                  Load Collections
                </Button>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card size="small" title="Maintenance Mode">
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Switch
                    checked={maintenanceEnabled}
                    onChange={(v) => setMaintenanceEnabled(v)}
                  />{" "}
                  Enable Maintenance Mode (developers excluded)
                  <DatePicker.RangePicker
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
                      type="primary"
                      onClick={() => saveMaintenance(true)}
                      loading={maintenanceLoading}
                      disabled={!maintenanceRange || maintenanceRange.length !== 2}
                    >
                      Enable
                    </Button>
                    <Button
                      danger
                      onClick={() => saveMaintenance(false)}
                      loading={maintenanceLoading}
                    >
                      Disable
                    </Button>
                  </Space>
                  <Card size="small" title="Preview (Non-developer view)">
                    <div style={{ padding: 12, background: "#fff" }}>
                      <h3 style={{ marginTop: 0 }}>Maintenance</h3>
                      <p style={{ marginBottom: 4 }}>{maintenanceMessage || "No message set"}</p>
                      {maintenanceRange && maintenanceRange.length === 2 && (
                        <p style={{ color: "#999", fontSize: 12 }}>
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
              <Card size="small" title="Backup Collections">
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Select
                    placeholder="Select collection"
                    value={selectedCollection}
                    onChange={setSelectedCollection}
                    options={collections.map((c) => ({ label: c.name, value: c.name }))}
                    loading={collectionsLoading}
                    style={{ width: "100%" }}
                  />
                  <Select
                    value={backupFormat}
                    onChange={setBackupFormat}
                    options={[{ label: "JSON", value: "json" }, { label: "CSV", value: "csv" }]}
                    style={{ width: 200 }}
                  />
                  <Space>
                    <Button onClick={downloadCollectionNow} disabled={!selectedCollection}>
                      Download Now
                    </Button>
                    <Button type="primary" onClick={handleBackup} disabled={!selectedCollection}>
                      Queue Backup
                    </Button>
                  </Space>
                  <Space>
                    <Button onClick={fetchJobs} loading={jobsLoading}>
                      Refresh Jobs
                    </Button>
                    <Popconfirm title="Clear completed/failed jobs?" onConfirm={() => clearJobs("done")}>
                      <Button danger>Clear Completed</Button>
                    </Popconfirm>
                  </Space>
                  <Row gutter={[8, 8]}>
                    <Col xs={24} sm={12} md={8}>
                      <Select
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
                        value={jobCollectionFilter}
                        onChange={setJobCollectionFilter}
                        options={[
                          { label: "All Collections", value: "all" },
                          ...jobCollections.map((c) => ({ label: c, value: c })),
                        ]}
                        style={{ width: "100%" }}
                      />
                    </Col>
                  </Row>
                  <Table
                    size="small"
                    dataSource={filteredJobs}
                    loading={jobsLoading}
                    rowKey={(r) => r._id}
                    pagination={{ pageSize: 5 }}
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
                              <Button size="small" danger>
                                Delete
                              </Button>
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
      </Section>
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
            <Form.Item name={["dtr", "defaultStartTime"]} label="Default Start Time">
              <Input placeholder="08:00" />
            </Form.Item>
            <Form.Item name={["dtr", "defaultEndTime"]} label="Default End Time">
              <Input placeholder="17:00" />
            </Form.Item>
            <Form.Item name={["dtr", "autoFillBreakOut"]} label="Auto-fill Break Out">
              <Input placeholder="12:00" />
            </Form.Item>
            <Form.Item name={["dtr", "autoFillBreakIn"]} label="Auto-fill Break In">
              <Input placeholder="13:00" />
            </Form.Item>
          </Space>
        </Section>

        <Section title="Security">
          <Space size={12} wrap>
            <Form.Item name={["security", "sessionTimeout"]} label="Session Timeout (minutes)">
              <InputNumber min={1} />
            </Form.Item>
            <Form.Item name={["security", "passwordMinLength"]} label="Password Min Length">
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
      <Title level={3}>Developer Settings</Title>
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
            key: "audit-logs",
            label: "Audit Logs",
            children: (
              <Section title="Audit Logs">
                <Button onClick={fetchAuditLogs}>Refresh</Button>
                <Table
                  size="small"
                  dataSource={auditLogs}
                  loading={auditLoading}
                  rowKey={(r) => r._id}
                  pagination={{ pageSize: 10 }}
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
                  size="small"
                  dataSource={notifications}
                  loading={notifLoading}
                  rowKey={(r) => r._id}
                  pagination={{ pageSize: 10 }}
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
                      title: "Hidden",
                      dataIndex: "hidden",
                      key: "hidden",
                      render: (v) =>
                        v ? (
                          <Tag color="red">hidden</Tag>
                        ) : (
                          <Tag color="green">visible</Tag>
                        ),
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
                                        `/dtrlogs/${row._id || row.id}`
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

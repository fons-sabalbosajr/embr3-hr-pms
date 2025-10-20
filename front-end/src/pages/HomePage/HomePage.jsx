import {
  Layout,
  Menu,
  Avatar,
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
} from "@ant-design/icons";

import { useNavigate, Routes, Route } from "react-router-dom";
import { useEffect, useState, useRef, useCallback, useContext } from "react";
import useAuth from "../../hooks/useAuth";
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

import "./hompage.css";

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

  useEffect(() => {
    localStorage.setItem("notifications", JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    // messages are reserved for future chat feature and intentionally not persisted
  }, [messages]);

   useEffect(() => {
    // 👇 2. The socket is already connected by AuthContext, so just listen for events
    socket.on("newNotification", (data) => {
      setNotifications((prev) => [
        { ...data, id: data._id || Date.now() },
        ...prev,
      ]);
    });

    // message stream is reserved for future chat feature — ignore incoming message events

    // 👇 3. Remove the return () => socket.disconnect(); from here
    //    AuthContext is now responsible for disconnecting.
  }, []);

  // Load developer notifications if user is developer/admin and listen for DevSettings updates
  useEffect(() => {
    let mounted = true;
    const fetchDev = async () => {
    if (!(hasPermission(["canAccessDeveloper"]) || (user && user.userType === 'developer'))) return;
      try {
        setDevNotificationsLoading(true);
        const { data } = await axiosInstance.get('/dev/notifications');
        if (!mounted) return;
        const items = (data?.data || []).map((n) => ({ ...n, id: n._id || Date.now() }));
        setDevNotifications(items);
      } catch (err) {
        // ignore dev notification load errors
        console.debug('Failed to load dev notifications', err);
      }
      finally {
        if (mounted) setDevNotificationsLoading(false);
      }
    };

    fetchDev();

    const handler = (e) => {
      if (!e || !e.detail) return;
      const payload = (e.detail || []).map((n) => ({ ...n, id: n._id || Date.now() }));
      setDevNotifications(payload);
    };
    window.addEventListener('devNotificationsUpdated', handler);

    return () => {
      mounted = false;
      window.removeEventListener('devNotificationsUpdated', handler);
    };
  }, [hasPermission]);

  // Load initial data from backend
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Try relative endpoints first (dependent on axiosInstance.baseURL). If that fails,
        // fall back to absolute URL using VITE_API_URL to handle different dev setups.
        let notifRes;
        let msgRes;
        try {
          [notifRes, msgRes] = await Promise.all([
            axiosInstance.get("/payslip-requests"),
            axiosInstance.get("/dtrlogs"),
          ]);
        } catch (firstErr) {
          console.debug('Initial relative fetch failed, trying absolute VITE_API_URL fallback', firstErr);
          const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
          // If VITE_API_URL isn't configured, rethrow original error
          if (!base) throw firstErr;
          [notifRes, msgRes] = await Promise.all([
            axiosInstance.get(`${base}/payslip-requests`),
            axiosInstance.get(`${base}/dtrlogs`),
          ]);
        }

        console.debug('Fetched notifications response:', notifRes && notifRes.data);
        console.debug('Fetched messages response:', msgRes && msgRes.data);

        setNotificationsLoading(true);
        setNotifications((notifRes.data?.data || notifRes.data || []).map((n) => ({ ...n, id: n._id || n.id || Date.now() })));

        // messages are reserved for future chat; do not populate messages yet
      } catch (err) {
        // Initial load failures are non-fatal; UI can still function with empty lists
        console.error("Failed to load initial data:", err);
      }
      finally {
        setNotificationsLoading(false);
      }
    };
    fetchData();
  }, []);

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
              { key: "/dtr/logs", label: "Biometric Logs", permissions: ["canViewDTR"] },
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

    const filterItems = (items) => {
      return items.reduce((acc, item) => {
        if (hasPermission(item.permissions)) {
          if (item.children) {
            const filteredChildren = filterItems(item.children);
            if (filteredChildren.length > 0) {
              acc.push({ ...item, children: filteredChildren });
            }
          } else {
            acc.push(item);
          }
        }
        return acc;
      }, []);
    };

    return filterItems(allItems);
  };

  // ---- Notifications Popover ----
  const openNotificationModal = async (n) => {
    // Mark read (optimistic) and open modal
    try {
      if (!n.read) {
        await axiosInstance.put(`/payslip-requests/${n.id}/read`);
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
        const { data } = await axiosInstance.get(`/employees/by-emp-id/${encodeURIComponent(n.employeeId)}`);
        if (data?.success) {
          setEmployeeDetails(data.data);
        } else {
          setEmployeeError(data?.message || 'Employee not found');
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasAccess("canManageNotifications") && (
          <Button
            type="link"
            size="small"
            onClick={async () => {
              try {
                await axiosInstance.put("/payslip-requests/read-all");
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
      ) : (() => {
        // Always exclude hidden dev notifications from the bell popover
        const visibleDev = devNotifications.filter((d) => !d.hidden);
        // Respect dataVisible flag: if a dev notification has dataVisible === false
        // replace its body/title with a placeholder when merging for the bell popover
        const normalizedDev = visibleDev.map((d) => ({
          ...d,
          title: d.dataVisible === false ? '[hidden]' : d.title,
          body: d.dataVisible === false ? '[hidden]' : d.body,
        }));
        // Exclude hidden regular notifications as well
        let merged = [...normalizedDev, ...notifications.filter((n) => !n.hidden)];

        if (merged.length === 0) {
          return (
            <Text type="secondary" style={{ padding: "8px 12px", display: "block" }}>
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
              <Text strong>{n.title || `Notification${n.employeeId ? ' - ' + n.employeeId : ''}`}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: "12px" }}>
                {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
              </Text>
            </div>
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
          </div>
        ));
      })()}
    </div>
  );

  const notificationModal = (
    <Modal
      open={isNotificationModalOpen}
      title={
        selectedNotification
          ? `Payslip Request - ${selectedNotification.employeeId}`
          : "Notification"
      }
      onCancel={() => setIsNotificationModalOpen(false)}
      footer={[
        <Button key="close" onClick={() => setIsNotificationModalOpen(false)}>
          Close
        </Button>,
        selectedNotification && (
          <Button
            key="process"
            type="primary"
            onClick={() => {
              // Determine target route
              const notif = selectedNotification;
              let target = null;
              // Simple heuristic: payslip requests go to benefits/payroll page, others maybe DTR
              if (notif.period || notif.reason === 'payslip' || /payslip/i.test(notif.type || '')) {
                const empQ = notif.employeeId ? `&empId=${encodeURIComponent(notif.employeeId)}` : '';
                target = `/dtr/reports?payslip=1${empQ}`;
              } else if (/dtr/i.test(notif.type || '') || notif.dtrId) {
                target = '/dtr/process';
              }
              if (!target) {
                // default fallback
                target = '/dtr/reports';
              }
              setIsNotificationModalOpen(false);
              navigate(target);
            }}
          >
            Process Request
          </Button>
        )
      ]}
    >
      {selectedNotification && (
        <Descriptions
          size="small"
          column={1}
          bordered
          labelStyle={{ width: 130 }}
          contentStyle={{ background: "transparent" }}
        >
          {selectedNotification.employeeName && (
            <Descriptions.Item label="Employee">
              {selectedNotification.employeeName} ({selectedNotification.employeeId})
            </Descriptions.Item>
          )}
          {!selectedNotification.employeeName && selectedNotification.employeeId && (
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
              <span style={{ color: 'red' }}>{employeeError}</span>
            </Descriptions.Item>
          )}
          {employeeDetails && (
            <>
              <Descriptions.Item label="Full Name">
                {employeeDetails.fullName || employeeDetails.name || `${employeeDetails.firstName || ''} ${employeeDetails.lastName || ''}`.trim()}
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
              {(employeeDetails.sectionOrUnit || employeeDetails.section || employeeDetails.unit) && (
                <Descriptions.Item label="Section / Unit">
                  {employeeDetails.sectionOrUnit || employeeDetails.section || employeeDetails.unit}
                </Descriptions.Item>
              )}
              {employeeDetails.employmentStatus && (
                <Descriptions.Item label="Employment Status">
                  {employeeDetails.employmentStatus}
                </Descriptions.Item>
              )}
              {employeeDetails.empType && !employeeDetails.employmentStatus && (
                <Descriptions.Item label="Employment Type">
                  {employeeDetails.empType}
                </Descriptions.Item>
              )}
            </>
          )}
          {selectedNotification.reason && (
            <Descriptions.Item label="Reason">
              {selectedNotification.dataVisible === false ? '[hidden]' : selectedNotification.reason}
            </Descriptions.Item>
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
              {selectedNotification.dataVisible === false ? '[hidden]' : selectedNotification.notes}
            </Descriptions.Item>
          )}
          {selectedNotification._id && (
            <Descriptions.Item label="Internal ID">
              {selectedNotification._id}
            </Descriptions.Item>
          )}
        </Descriptions>
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
          labelStyle={{ width: 130 }}
          contentStyle={{ background: "transparent" }}
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
              <span style={{ color: 'red' }}>{employeeError}</span>
            </Descriptions.Item>
          )}
          {employeeDetails && (
            <>
              <Descriptions.Item label="Full Name">
                {employeeDetails.fullName || employeeDetails.name || `${employeeDetails.firstName || ''} ${employeeDetails.lastName || ''}`.trim()}
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
    <Layout
      className="homepage-root-layout"
      style={{
        marginLeft: collapsed ? 80 : 220,
        transition: "margin-left 0.2s",
      }}
    >
      {notificationModal}
      {messageModal}
      <Sider
        width={220}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        collapsedWidth={80}
        className="sider"
        style={{ background: 'var(--app-sider-bg, #001529)' }}
      >
        <div className={`logo-container ${collapsed ? "collapsed" : ""}`}>
          <Tooltip title="EMBR3 DTR Management System" placement="right">
            <img src={emblogo} alt="EMB Logo" className="logo-img" />
          </Tooltip>
          {!collapsed && (
            <span className="logo-text">EMBR3 DTR Management System</span>
          )}
        </div>
        {hasPermission(["canManipulateBiometrics"]) && (
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
        />
      )}

  <Layout>
  <Header className="header" style={{ background: 'var(--app-header-bg, #ffffff)' }}>
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
              <Avatar className="user-avatar">
                {user?.name?.charAt(0).toUpperCase() || <UserOutlined />}
              </Avatar>
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

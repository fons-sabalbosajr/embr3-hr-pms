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
import RecordConfigSettings from "../../components/Settings/RecordConfigSettings/RecordConfigSettings";
import DeveloperSettings from "../../components/Settings/DevSettings/DevSettings";
import ProtectedRoute from "../../components/ProtectedRoute";
import ProfileModal from "./components/ProfileModal";
import FeatureModal from "./components/FeatureModal";
import { NotificationsContext } from "../../context/NotificationsContext";
import socket from "../../../utils/socket";

import io from "socket.io-client";
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

  useEffect(() => {
    localStorage.setItem("notifications", JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem("messages", JSON.stringify(messages));
  }, [messages]);

   useEffect(() => {
    // 👇 2. The socket is already connected by AuthContext, so just listen for events
    socket.on("newNotification", (data) => {
      setNotifications((prev) => [
        { ...data, id: data._id || Date.now() },
        ...prev,
      ]);
    });

    socket.on("newDTRMessage", (data) => {
      setMessages((prev) => [{ ...data, id: data._id || Date.now() }, ...prev]);
    });

    // 👇 3. Remove the return () => socket.disconnect(); from here
    //    AuthContext is now responsible for disconnecting.
  }, []);

  // Load initial data from backend
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [notifRes, msgRes] = await Promise.all([
          axiosInstance.get("/payslip-requests"),
          axiosInstance.get("/dtrlogs"),
        ]);

        setNotifications(
          (notifRes.data?.data || notifRes.data || []).map((n) => ({
            ...n,
            id: n._id || Date.now(),
          }))
        );

        setMessages(
          (msgRes.data?.data || msgRes.data || []).map((m) => ({
            ...m,
            id: m._id || Date.now(),
          }))
        );
      } catch (err) {
        console.error("Failed to load initial data:", err);
      }
    };
    fetchData();
  }, []);

  // Socket.io real-time updates
  useEffect(() => {
    const socket = io(import.meta.env.VITE_SOCKET_URL, {
      path: "/socket.io/",
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on("newNotification", (data) => {
      setNotifications((prev) => [
        { ...data, id: data._id || Date.now() },
        ...prev,
      ]);
    });

    socket.on("newDTRMessage", (data) => {
      setMessages((prev) => [{ ...data, id: data._id || Date.now() }, ...prev]);
    });

    return () => socket.disconnect();
  }, []);

  const handleLogout = () => {
    message.success("Logging out...");
    logout();
    navigate("/auth");
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
        label: "Dashboard",
        permissions: ["canViewDashboard"],
      },
      {
        key: "employees",
        icon: <TeamOutlined />,
        label: "Employees",
        permissions: ["canViewEmployees"],
        children: [
          {
            key: "/employeeinfo",
            label: "General Info",
            permissions: ["canViewEmployees"],
          },
          {
            key: "/trainings",
            label: "Trainings",
            permissions: ["canViewTrainings"],
          },
          {
            key: "/benefitsinfo",
            label: "Salary Info",
            permissions: ["canViewPayroll"],
          },
        ],
      },
      {
        key: "dtr",
        icon: <FieldTimeOutlined />,
        label: "Daily Time Record",
        permissions: ["canViewDTR"],
        children: [
          { key: "/dtr/logs", label: "DTR Logs", permissions: ["canViewDTR"] },
          {
            key: "/dtr/process",
            label: "Process DTR",
            permissions: ["canProcessDTR"],
          },
          {
            key: "/dtr/reports",
            label: "Report Management",
            permissions: ["canViewDTR"],
          },
        ],
      },
      {
        key: "settings",
        icon: <SettingOutlined />,
        label: "Settings",
        permissions: ["canAccessSettings"],
        children: [
          {
            key: "/settings/account",
            label: "Account Settings",
            permissions: ["canAccessSettings"],
          },
          {
            key: "/settings/deductions",
            label: "Deduction Settings",
            permissions: ["canChangeDeductions"],
          },
          {
            key: "/settings/access",
            label: "User Access Settings",
            permissions: ["canManageUsers"],
          },
          // {
          //   key: "/settings/record-config",
          //   label: "Record Configuration Settings",
          //   permissions: ["canAccessConfigSettings"],
          // },
          {
            key: "/settings/backup",
            label: "Backup Data",
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
      </div>
      {notifications.length > 0 ? (
        notifications.map((n) => (
          <div
            key={n.id}
            style={{
              padding: "8px 12px",
              borderBottom: "1px solid #f0f0f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              opacity: n.read ? 0.6 : 1, // 👈 dim if read
            }}
          >
            <div>
              <Text strong>{`Payslip Request - ${n.employeeId}`}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: "12px" }}>
                {new Date(n.createdAt).toLocaleString()}
              </Text>
            </div>
            <Button
              size="small"
              type="link"
              onClick={async () => {
                try {
                  await axiosInstance.put(`/payslip-requests/${n.id}/read`);
                  setNotifications((prev) =>
                    prev.map((notif) =>
                      notif.id === n.id ? { ...notif, read: true } : notif
                    )
                  );
                } catch (error) {
                  message.error("Failed to mark notification as read");
                }
              }}
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
          No new notifications
        </Text>
      )}
    </div>
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
              try {
                // ✅ Optimistically update UI
                setMessages((prev) => prev.map((m) => ({ ...m, read: true })));

                // ✅ Call backend to persist
                await axiosInstance.put("/dtrlogs/read-all");

                // ✅ Refresh to stay in sync
                const { data } = await axiosInstance.get("/dtrlogs");
                if (data.success) {
                  setMessages(data.data);
                }
              } catch (error) {
                message.error("Failed to mark all messages as read");
              }
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
              onClick={async () => {
                try {
                  // ✅ Optimistic update
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg._id === m._id ? { ...msg, read: true } : msg
                    )
                  );

                  // ✅ Persist to backend
                  await axiosInstance.put(`/dtrlogs/${m._id}/read`);

                  // ✅ Refresh list
                  const { data } = await axiosInstance.get("/dtrlogs");
                  if (data.success) {
                    setMessages(data.data);
                  }
                } catch (error) {
                  message.error("Failed to mark message as read");
                }
              }}
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
      style={{
        marginLeft: collapsed ? 80 : 220,
        transition: "margin-left 0.2s",
      }}
    >
      <Sider
        width={220}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        collapsedWidth={80}
        className="sider"
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
        <Header className="header">
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
                count={notifications.filter((n) => !n.read).length} // Correctly count unread
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

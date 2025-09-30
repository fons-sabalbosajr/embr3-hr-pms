import {
  Layout,
  Menu,
  Avatar,
  Badge,
  Space,
  Tooltip,
  Typography,
  Popover,
  Divider,
  Button,
  message,
  Modal,
  Input,
  Tag,
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
  MailOutlined,
  FieldTimeOutlined,
  IdcardOutlined,
  ClockCircleOutlined,
  CloseOutlined,
} from "@ant-design/icons";

import { useNavigate, Routes, Route } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
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
import ProtectedRoute from "../../components/ProtectedRoute";

import io from "socket.io-client";
import "./hompage.css";

const { Text } = Typography;
const { Header, Content, Sider, Footer } = Layout;

const HomePage = () => {
  const navigate = useNavigate();
  const { user, logout, hasPermission } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState(false);
  const [featureTitle, setFeatureTitle] = useState("");
  const [featureDescription, setFeatureDescription] = useState("");
  const [loadingFeature, setLoadingFeature] = useState(false);

  const [notifications, setNotifications] = useState(
    () => JSON.parse(localStorage.getItem("notifications")) || []
  );
  const [messages, setMessages] = useState(
    () => JSON.parse(localStorage.getItem("messages")) || []
  );

  useEffect(() => {
    localStorage.setItem("notifications", JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem("messages", JSON.stringify(messages));
  }, [messages]);

  const handleLogout = () => {
    message.success("Logging out...");
    logout();
    navigate("/auth");
  };

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

  const clearItem = (id, type) => {
    if (type === "notification") {
      setNotifications((prev) => prev.filter((item) => item.id !== id));
    }
    if (type === "message") {
      setMessages((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const clearAll = (type) => {
    if (type === "notification") setNotifications([]);
    if (type === "message") setMessages([]);
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
            label: "Reports",
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
            label: "User Access",
            permissions: ["canManageUsers"],
          },
          {
            key: "/settings/backup",
            label: "Backup Data",
            permissions: ["canPerformBackup"],
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

  const notificationPopover = (
    <div style={{ padding: "8px 0", maxWidth: 350 }}>
      {notifications.length > 0 ? (
        <>
          <div style={{ maxHeight: 400, overflowY: "auto", padding: "0 8px" }}>
            {notifications.map((item) => (
              <div key={item.id} className="notification-item">
                <div className="notification-content">
                  <Tag color="green">Payslip Request</Tag>
                  <Text
                    style={{ fontSize: 13 }}
                  >{`ID: ${item.employeeId} | Period: ${item.period}`}</Text>
                  <Space>
                    <Button
                      type="link"
                      size="small"
                      onClick={() =>
                        message.info("Payslip request page not yet available.")
                      }
                    >
                      View Details
                    </Button>
                    <Button
                      shape="circle"
                      size="small"
                      icon={<CloseOutlined />}
                      onClick={() => clearItem(item.id, "notification")}
                    />
                  </Space>
                </div>
              </div>
            ))}
          </div>
          <Divider style={{ margin: "8px 0" }} />
          <div style={{ textAlign: "center", padding: "0 8px" }}>
            <Button
              type="link"
              size="small"
              onClick={() => clearAll("notification")}
            >
              Clear All
            </Button>
          </div>
        </>
      ) : (
        <Text type="secondary" style={{ padding: "0 12px" }}>
          No new notifications
        </Text>
      )}
    </div>
  );

  const messagePopover = (
    <div style={{ padding: "8px 0", maxWidth: 350 }}>
      {messages.length > 0 ? (
        <>
          <div style={{ maxHeight: 400, overflowY: "auto", padding: "0 8px" }}>
            {messages.map((item) => (
              <div key={item.id} className="notification-item">
                <div className="notification-content">
                  <Tag color="blue">DTR Generated</Tag>
                  <Text
                    style={{ fontSize: 13 }}
                  >{`ID: ${item.employeeId} | By: ${item.generatedBy}`}</Text>
                  <Space>
                    <Button
                      type="link"
                      size="small"
                      onClick={() =>
                        navigate("/dtr/process", {
                          state: { employeeId: item.employeeId },
                        })
                      }
                    >
                      View Details
                    </Button>
                    <Button
                      shape="circle"
                      size="small"
                      icon={<CloseOutlined />}
                      onClick={() => clearItem(item.id, "message")}
                    />
                  </Space>
                </div>
              </div>
            ))}
          </div>
          <Divider style={{ margin: "8px 0" }} />
          <div style={{ textAlign: "center", padding: "0 8px" }}>
            <Button
              type="link"
              size="small"
              onClick={() => clearAll("message")}
            >
              Clear All
            </Button>
          </div>
        </>
      ) : (
        <Text type="secondary" style={{ padding: "0 12px" }}>
          No new messages
        </Text>
      )}
    </div>
  );

  const handleProfileModalClose = () => setIsProfileModalOpen(false);
  const handleFeatureModalClose = () => setIsFeatureModalOpen(false);

  const handleFeatureSubmit = async () => {
    if (!featureTitle || !featureDescription) {
      message.warning("Please fill in all fields before submitting.");
      return;
    }
    try {
      setLoadingFeature(true);
      await axiosInstance.post("/features/suggest", {
        title: featureTitle,
        description: featureDescription,
        emailTo: "embrhrpms@gmail.com",
        submittedBy: user?.username || "unknown",
      });
      message.success("Your suggestion has been sent!");
      setFeatureTitle("");
      setFeatureDescription("");
      handleFeatureModalClose();
    } catch (error) {
      console.error("Feature suggestion failed:", error);
      message.error("Failed to send suggestion. Try again later.");
    } finally {
      setLoadingFeature(false);
    }
  };

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

      <ImportDTRModal
        open={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        currentUser={user}
      />

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
              content={notificationPopover}
              placement="bottomRight"
              trigger="click"
              overlayClassName="user-popover"
            >
              <Badge count={notifications.length} size="small">
                <BellOutlined className="icon-trigger" />
              </Badge>
            </Popover>
            <Popover
              content={messagePopover}
              placement="bottomLeft"
              trigger="click"
              overlayClassName="user-popover"
            >
              <Badge count={messages.length} size="small">
                <MessageOutlined className="icon-trigger" />
              </Badge>
            </Popover>
            <Popover
              content={userPopover}
              placement="bottomLeft"
              trigger="hover"
              overlayClassName="user-popover"
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
            </Routes>
          </div>
        </Content>

        <Footer style={{ textAlign: "center" }}>
          © {new Date().getFullYear()} EMBR3 Payroll Management System
        </Footer>
      </Layout>

      <Modal
        title={null}
        open={isProfileModalOpen}
        onCancel={handleProfileModalClose}
        footer={null}
        centered
        width={500}
      >
        <div style={{ textAlign: "center", padding: "20px" }}>
          <Avatar
            size={100}
            style={{ backgroundColor: "#1677ff", marginBottom: 15 }}
          >
            {user?.name?.charAt(0).toUpperCase() || <UserOutlined />}
          </Avatar>
          <Typography.Title level={4} style={{ marginBottom: 0 }}>
            {user?.name || "Unknown User"}
          </Typography.Title>
          <Typography.Text type="secondary">
            @{user?.username || "unknown"}
          </Typography.Text>
          <Divider />
          <Space
            direction="vertical"
            style={{ width: "100%", textAlign: "left", marginTop: 10 }}
          >
            <Typography.Text>
              <IdcardOutlined style={{ marginRight: 8, color: "#1677ff" }} />
              Role: {user?.role || "Employee"}
            </Typography.Text>
            <Typography.Text>
              <ClockCircleOutlined
                style={{ marginRight: 8, color: "#1677ff" }}
              />
              Joined:{" "}
              {user?.createdAt
                ? new Date(user.createdAt).toDateString()
                : "N/A"}
            </Typography.Text>
            <Typography.Text>
              <MailOutlined style={{ marginRight: 8, color: "#1677ff" }} />
              Email: {user?.email || "Not Provided"}
            </Typography.Text>
          </Space>
          <Divider />
          <Button type="primary" block onClick={handleProfileModalClose}>
            Close
          </Button>
        </div>
      </Modal>

      <Modal
        title={null}
        open={isFeatureModalOpen}
        onCancel={handleFeatureModalClose}
        footer={null}
        centered
        width={500}
      >
        <div style={{ padding: "20px" }}>
          <Typography.Title
            level={4}
            style={{ textAlign: "center", marginBottom: 10 }}
          >
            <BulbOutlined style={{ marginRight: 8, color: "#faad14" }} />
            Suggest a Feature
          </Typography.Title>
          <Typography.Paragraph style={{ textAlign: "center" }}>
            Have an idea to improve the system? Share it with us!
          </Typography.Paragraph>
          <Divider />
          <Space direction="vertical" style={{ width: "100%" }}>
            <Input
              placeholder="Feature Title"
              value={featureTitle}
              onChange={(e) => setFeatureTitle(e.target.value)}
            />
            <Input.TextArea
              placeholder="Describe your feature suggestion..."
              autoSize={{ minRows: 4, maxRows: 6 }}
              value={featureDescription}
              onChange={(e) => setFeatureDescription(e.target.value)}
            />
          </Space>
          <Divider />
          <Space
            style={{
              display: "flex",
              justifyContent: "flex-end",
              width: "100%",
            }}
          >
            <Button onClick={handleFeatureModalClose}>Cancel</Button>
            <Button
              type="primary"
              loading={loadingFeature}
              onClick={handleFeatureSubmit}
            >
              Submit
            </Button>
          </Space>
        </div>
      </Modal>
    </Layout>
  );
};

export default HomePage;

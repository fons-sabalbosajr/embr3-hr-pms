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
  ImportOutlined,
  FieldTimeOutlined,
} from "@ant-design/icons";

import { useNavigate, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import { secureGet, secureRemove } from "../../../utils/secureStorage";
import emblogo from "../../assets/emblogo.svg";

import Dashboard from "../../components/Dashboard/Dashboard";
import GenInfo from "../../components/Employees/GeneralInfo/GenInfo";
import BenefitsInfo from "../../components/Employees/BenefitsInfo/BenefitsInfo";
import SalaryInfo from "../../components/Employees/SalaryInfo/SalaryInfo";
import AccountSettings from "../../components/Settings/AccountSettings/AccountsSettings";
import Backup from "../../components/Settings/Backup/Backup";
import UserAccess from "../../components/Settings/UserAccess/UserAccess";
import ImportDTRModal from "../../components/DTR/ImportDTRModal";
import DTR from "../DTR/DTR";
import DTRLogs from "../DTR/DTRLogs";
import DTRProcess from "../DTR/DTRProcess";
import DTRReports from "../DTR/DTRReports";

import io from "socket.io-client";
import "./hompage.css";

const { Text } = Typography;
const { Header, Content, Sider, Footer } = Layout;

const HomePage = () => {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const userget = secureGet("user");

  useEffect(() => {
    const socket = io(import.meta.env.VITE_SOCKET_URL);
    socket.on("newNotification", (data) => {
      setNotifications((prev) => [data, ...prev]);
    });
    return () => socket.disconnect();
  }, []);

  const handleLogout = () => {
    secureRemove("token");
    secureRemove("user");
    window.location.href = "/auth";
  };

  const handleViewProfile = () => {};
  const handleSuggestFeature = () => {};

  const menuItems = [
    {
      key: "/",
      icon: <DashboardOutlined />,
      label: "Dashboard",
    },
    {
      key: "employees",
      icon: <TeamOutlined />,
      label: "Employees",
      children: [
        { key: "/employeeinfo", label: "General Info" },
        { key: "/salaryinfo", label: "Salary Info" },
        { key: "/benefitsinfo", label: "Benefits & Leaves" },
      ],
    },
    {
      key: "dtr",
      icon: <ImportOutlined />,
      label: "Daily Time Record",
      children: [
        { key: "/dtr/logs", label: "DTR Logs" },
        { key: "/dtr/process", label: "Process DTR" },
        { key: "/dtr/reports", label: "Reports" },
      ],
    },
    {
      key: "settings",
      icon: <SettingOutlined />,
      label: "Settings",
      children: [
        { key: "/settings/account", label: "Account Settings" },
        { key: "/settings/access", label: "User Access" },
        { key: "/settings/backup", label: "Backup Data" },
      ],
    },
  ];

  const userPopover = (
    <div className="popover-content">
      <div className="popover-user">
        <Text strong>{userget?.name || "Unknown User"}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          @{userget?.username || "unknown"}
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
    <div style={{ padding: 8, maxWidth: 250 }}>
      {notifications.length ? (
        notifications.map((n, i) => (
          <div key={i} style={{ marginBottom: 6, fontSize: 13 }}>
            {n.message || "New Notification"}
          </div>
        ))
      ) : (
        <Text type="secondary">No new notifications</Text>
      )}
    </div>
  );

  const messagePopover = (
    <div style={{ padding: 8, maxWidth: 250 }}>
      <Text type="secondary">No new messages</Text>
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
        width={220} // default is 200px
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        collapsedWidth={80} // still keep small size when collapsed
        className="sider"
      >
        <div className={`logo-container ${collapsed ? "collapsed" : ""}`}>
          <Tooltip title="EMBR3 Payroll Management System" placement="right">
            <img src={emblogo} alt="EMB Logo" className="logo-img" />
          </Tooltip>
          {!collapsed && (
            <span className="logo-text">EMBR3 Payroll Management System</span>
          )}
        </div>

        {/* Import Button */}
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

        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={["/"]}
          onClick={({ key }) =>
            key === "logout" ? handleLogout() : navigate(key)
          }
          items={menuItems}
        />
      </Sider>

      {/* Import Modal */}
      <ImportDTRModal
        open={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        currentUser={userget}
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
              trigger="hover"
              classNames={{ root: "user-popover" }}
            >
              <Badge count={notifications.length} offset={[-2, 2]}>
                <BellOutlined style={{ fontSize: 18 }} />
              </Badge>
            </Popover>

            <Popover
              content={messagePopover}
              placement="bottomRight"
              trigger="hover"
              classNames={{ root: "user-popover" }}
            >
              <Badge dot offset={[-2, 2]}>
                <MessageOutlined style={{ fontSize: 18 }} />
              </Badge>
            </Popover>

            <Popover
              content={userPopover}
              placement="bottomRight"
              trigger="hover"
              classNames={{ root: "user-popover" }}
            >
              <Avatar style={{ backgroundColor: "#87d068", cursor: "pointer" }}>
                {userget?.name?.charAt(0).toUpperCase() || <UserOutlined />}
              </Avatar>
            </Popover>
          </div>
        </Header>

        <Content style={{ margin: "16px", paddingBottom: 0 }}>
          <div className="content-wrapper">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/employeeinfo" element={<GenInfo />} />

              <Route path="/dtr/logs" element={<DTRLogs />} />
              <Route path="/dtr/process" element={<DTRProcess />} />
              <Route path="/dtr/reports" element={<DTRReports />} />
              <Route path="/salaryinfo" element={<SalaryInfo />} />
              <Route path="/benefitsinfo" element={<BenefitsInfo />} />
              <Route path="/settings/account" element={<AccountSettings />} />
              <Route path="/settings/access" element={<UserAccess />} />
              <Route path="/settings/backup" element={<Backup />} />
            </Routes>
          </div>
        </Content>

        <Footer style={{ textAlign: "center" }}>
          © {new Date().getFullYear()} EMBR3 Payroll Management System
        </Footer>
      </Layout>
    </Layout>
  );
};

export default HomePage;

import { Layout, Menu, Avatar, Dropdown, Badge, Space, Tooltip } from "antd";
import {
  HomeOutlined,
  UserOutlined,
  DollarOutlined,
  LogoutOutlined,
  BellOutlined,
  MessageOutlined,
  DashboardOutlined,
  SettingOutlined,
  TeamOutlined,
  CloudUploadOutlined,
  SafetyOutlined,
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

import io from "socket.io-client";
import "./hompage.css";

const { Header, Content, Sider, Footer } = Layout;

const HomePage = () => {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [user, setUser] = useState(null);
  const userget = secureGet("user");

  useEffect(() => {
    const userData = secureGet("user");
    setUser(userData);

    const socket = io(import.meta.env.VITE_SOCKET_URL);

    socket.on("connect", () => {
      //console.log("Connected to socket");
    });

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

  const userMenu = {
    items: [
      {
        key: "logout",
        icon: <LogoutOutlined />,
        label: "Logout",
        onClick: handleLogout,
      },
    ],
  };

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
        {
          key: "/employeeinfo",
          label: "General Info",
          //icon: <UserOutlined />,
        },
        {
          key: "/salaryinfo",
          label: "Salary Info",
          //icon: <DollarOutlined />,
        },
        {
          key: "/benefitsinfo",
          label: "Benefits & Leaves",
          //icon: <HomeOutlined />,
        },
      ],
    },
    {
      key: "settings",
      icon: <SettingOutlined />,
      label: "Settings",
      children: [
        {
          key: "/settings/account",
          label: "Account Settings",
          //icon: <UserOutlined />,
        },
        {
          key: "/settings/access",
          label: "User Access",
          //icon: <SafetyOutlined />,
        },
        {
          key: "/settings/backup",
          label: "Backup Data",
          //icon: <CloudUploadOutlined />,
        },
      ],
    },
  ];

  return (
    <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: "margin-left 0.2s" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
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

        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={["/"]}
          onClick={({ key }) => {
            if (key === "logout") {
              handleLogout();
            } else {
              navigate(key);
            }
          }}
          items={menuItems}
        />
      </Sider>

      <Layout>
        <Header className="header">
          <div />
          <Space size="large">
            <Badge count={notifications.length}>
              <BellOutlined style={{ fontSize: 18 }} />
            </Badge>
            <Badge dot>
              <MessageOutlined style={{ fontSize: 18 }} />
            </Badge>

            <Dropdown menu={userMenu}>
              <Space style={{ cursor: "pointer" }}>
                <Avatar style={{ backgroundColor: "#87d068" }}>
                  {userget?.name?.charAt(0) || <UserOutlined />}
                </Avatar>
                <span style={{ fontWeight: 500 }}>
                  {userget?.name || "Unknown User"}
                </span>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ margin: "16px", paddingBottom: 0 }}>
          <div className="content-wrapper">
            <Routes>
              <Route path="/" element={<Dashboard />} />

              {/* Employees Subroutes */}
              <Route path="/employeeinfo" element={<GenInfo />} />
              <Route path="/salaryinfo" element={<SalaryInfo />} />
              <Route path="/benefitsinfo" element={<BenefitsInfo />} />

              {/* Settings Subroutes */}
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

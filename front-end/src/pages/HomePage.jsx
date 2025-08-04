import { Layout, Menu } from "antd";
import { UserOutlined, DollarOutlined, HomeOutlined } from "@ant-design/icons";
import { useNavigate, Routes, Route } from "react-router-dom";
import { secureRemove } from "../utils/secureStorage"; // utility to handle secure storage
import EmployeesPage from "./EmployeesPage";
import PayrollPage from "./PayrollPage";

const { Header, Content, Sider } = Layout;

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider>
        <div style={{ color: "#fff", padding: "16px", fontWeight: "bold" }}>
          Payroll System
        </div>

        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={["/"]}
          onClick={({ key }) => {
            if (key === "logout") {
              secureRemove("token"); // 🔐 secure logout
              window.location.href = "/login";
            } else {
              navigate(key);
            }
          }}
        >
          <Menu.Item key="/" icon={<HomeOutlined />}>
            Home
          </Menu.Item>
          <Menu.Item key="/employees" icon={<UserOutlined />}>
            Employees
          </Menu.Item>
          <Menu.Item key="/payroll" icon={<DollarOutlined />}>
            Payroll
          </Menu.Item>
          <Menu.Item key="logout" danger>
            Logout
          </Menu.Item>
        </Menu>
      </Sider>

      <Layout>
        <Header style={{ background: "#fff", padding: 0 }} />
        <Content style={{ margin: "16px" }}>
          <Routes>
            <Route path="/" element={<h1>Welcome to Payroll Management</h1>} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/payroll" element={<PayrollPage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
};

export default HomePage;

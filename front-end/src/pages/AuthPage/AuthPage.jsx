import { useState, useEffect } from "react";
import { Tabs, Form, Input, Button, Typography, Card, Alert, Space, Tag, Collapse } from "antd";
import { useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import bgImage from "../../assets/bgemb.webp";
import axios from "../../api/axiosInstance";
import "./authpage.css";
import Swal from "sweetalert2";
import { swalSuccess, swalError, swalWarning } from "../../utils/swalHelper";
import {
  RocketOutlined,
  BellOutlined,
  ToolOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

const TYPE_META = {
  announcement: { icon: <BellOutlined />, color: "#1890ff", label: "Announcement" },
  "app-update": { icon: <RocketOutlined />, color: "#52c41a", label: "App Update" },
  maintenance: { icon: <ToolOutlined />, color: "#fa8c16", label: "Maintenance" },
  general: { icon: <InfoCircleOutlined />, color: "#8c8c8c", label: "General" },
};

const AuthPage = () => {
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("login");
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState("1");
  const { login } = useAuth();
  const [demoInfo, setDemoInfo] = useState(null);
  const [securityRules, setSecurityRules] = useState({ passwordMinLength: 8, passwordRequiresNumber: true, passwordRequiresSymbol: true });
  const [loginAnnouncements, setLoginAnnouncements] = useState([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await axios.get('/public/demo-info');
        if (mounted) setDemoInfo(res.data);
      } catch (_) {
        if (mounted) setDemoInfo(null);
      }
      try {
        const secRes = await axios.get('/public/security-settings');
        if (mounted && secRes.data) setSecurityRules(secRes.data);
      } catch (_) {}
      // Fetch login-page announcements (public, no auth)
      try {
        const annRes = await axios.get('/announcements/login');
        if (mounted) setLoginAnnouncements(annRes.data?.data || []);
      } catch (_) {}
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("verified") === "true") {
      setActiveTab("1"); // force login tab after email verified
    }
  }, [location.search]);

  const onLogin = async (values) => {
    try {
      setLoading(true);
      await login(values);
      navigate("/", { replace: true }); // goes to HomePage
    } catch (err) {
      const code = err.response?.data?.code;
      const msg = err.response?.data?.message || "Login failed";
      if (code === "PENDING_APPROVAL") {
        Swal.fire({
          title: "Account Pending Approval",
          text: msg,
          icon: "info",
          confirmButtonText: "OK",
        });
      } else if (code === "REJECTED") {
        Swal.fire({
          title: "Account Not Approved",
          text: msg,
          icon: "error",
          confirmButtonText: "OK",
        });
      } else {
        swalError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // --- Signup handler
  const onSignup = async (values) => {
    if (values.password !== values.confirmPassword) {
      return swalError("Passwords do not match");
    }
    try {
      setLoading(true);
      const { confirmPassword, ...userData } = values;
      const res = await axios.post("/users/signup", userData);

      Swal.fire({
        title: "Signup Successful!",
        text: "A verification email has been sent. Your account is pending approval by an administrator. You will be notified once approved.",
        icon: "success",
        confirmButtonText: "OK",
      }).then(() => {
        form.resetFields(); // ✅ Clear fields
        setTab("login"); // ✅ Go back to login tab
      });
    } catch (err) {
      swalError(err.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  // --- Resend Verification
  const handleResend = async (email) => {
    try {
      await axios.post("/users/resend", { email });
      swalSuccess("Verification email resent.");
    } catch (err) {
      swalError(err.response?.data?.message || "Resend failed");
    }
  };

  return (
    <div
      className="auth-container theme-exempt"
      style={{
        backgroundImage: `linear-gradient(
      135deg,
      rgba(0, 75, 128, 0.85),
      rgba(154, 205, 50, 0.85),
      rgba(245, 216, 163, 0.85)
    ), url(${bgImage})`,
      }}
    >
      <div className="auth-layout-wrapper">
        {/* ── What's New — above login card ── */}
        {loginAnnouncements.length > 0 && (
          <div className="auth-announcements-panel">
            <div className="auth-announcements-header">
              <RocketOutlined className="auth-announcements-header-icon" />
              <span>What's New</span>
            </div>
            <Collapse
              accordion
              defaultActiveKey={loginAnnouncements[0]?._id}
              size="small"
              className="auth-announcements-collapse"
              expandIconPosition="end"
              items={loginAnnouncements.map((a) => {
                const meta = TYPE_META[a.type] || TYPE_META.general;
                return {
                  key: a._id,
                  label: (
                    <div className="auth-announcement-label">
                      <span className="auth-announcement-label-icon" style={{ color: meta.color }}>{meta.icon}</span>
                      <span className="auth-announcement-label-title">{a.title}</span>
                      <Tag
                        color={meta.color === "#52c41a" ? "green" : meta.color === "#fa8c16" ? "orange" : meta.color === "#1890ff" ? "blue" : "default"}
                        className="auth-announcement-label-tag"
                      >
                        {meta.label}
                      </Tag>
                    </div>
                  ),
                  children: (
                    <div className="auth-announcement-body">
                      <div
                        className="auth-announcement-content"
                        dangerouslySetInnerHTML={{ __html: a.body }}
                      />
                      <div className="auth-announcement-meta">
                        {a.createdBy && <span>Posted by {a.createdBy} &bull; </span>}
                        {new Date(a.createdAt).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
                      </div>
                    </div>
                  ),
                };
              })}
            />
          </div>
        )}

        {/* ── Login Card ── */}
        <Card className="auth-card">
        <Title level={3} className="auth-title">
          EMBR3 DTR Management System
        </Title>
        {demoInfo?.enabled && (
          <Alert
            type="info"
            showIcon
            className="demo-mode-alert"
            message={
              <Space direction="vertical" size={2}>
                <span><strong>Demo Mode Active</strong> — UAT/QA exploration prior to deployment.</span>
                <span>
                  Effectivity: {demoInfo.startDate ? new Date(demoInfo.startDate).toLocaleDateString() : 'N/A'}
                  {' '}– {demoInfo.endDate ? new Date(demoInfo.endDate).toLocaleDateString() : 'N/A'}
                </span>
                <span>Default Credentials: <Tag color="blue">demo_user</Tag> / <Tag>Demo1234</Tag></span>
                {!demoInfo.allowSubmissions && <span style={{ fontSize: 12 }}><em>Submissions disabled • read-only exploration</em></span>}
              </Space>
            }
          />
        )}

        {(() => {
          const now = new Date();
          const active = demoInfo?.enabled && (!demoInfo?.startDate || !demoInfo?.endDate || (now >= new Date(demoInfo.startDate) && now <= new Date(demoInfo.endDate)));
          const items = [
            {
              label: "Login",
              key: "login",
              children: (
                <Form
                  layout="vertical"
                  onFinish={onLogin}
                  className="login-form"
                >
                  <Form.Item
                    name="username"
                    label="Username"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="Enter username" />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    label="Password"
                    rules={[{ required: true }]}
                  >
                    <Input.Password placeholder="Enter password" />
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      block
                      loading={loading}
                      className="login-button fixed-primary-btn"
                    >
                      Log in
                    </Button>
                  </Form.Item>

                  {/* ✅ Center the Forgot Password */}
                  <Form.Item style={{ textAlign: "center", marginBottom: 0 }}>
                    <Button
                      type="link"
                      onClick={async () => {
                        const { value: identifier } = await Swal.fire({
                          title: "Forgot Password",
                          input: "text",
                          inputLabel: "Enter your email or username",
                          inputPlaceholder: "you@example.com or yourusername",
                          confirmButtonText: "Send Reset Link",
                          showCancelButton: true,
                          inputValidator: (value) => {
                            if (!value) return "Email or username is required";
                          },
                        });

                        if (identifier) {
                          try {
                            // Show loading spinner
                            Swal.fire({
                              title: "Sending Reset Link...",
                              allowOutsideClick: false,
                              allowEscapeKey: false,
                              didOpen: () => {
                                Swal.showLoading();
                              },
                            });

                            const payload = identifier.includes('@')
                              ? { email: identifier }
                              : { username: identifier };
                            await axios.post("/users/forgot-password", payload);
                            Swal.fire({
                              icon: "success",
                              title: "Reset Link Sent",
                              text: "Check your email for the reset instructions.",
                            });
                          } catch (err) {
                            Swal.fire({
                              icon: "error",
                              title: "Failed",
                              text:
                                err.response?.data?.message ||
                                "Something went wrong. Try again later.",
                            });
                          }
                        }
                      }}
                    >
                      Forgot Password?
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
          ];
          if (!active) {
            items.push({
              label: "Sign Up",
              key: "signup",
              children: (
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={onSignup}
                  className="signup-form"
                >
                  <Form.Item
                    name="name"
                    label="Name"
                    rules={[{ required: true }]}
                  >
                    <Input />
                  </Form.Item>

                  <Form.Item
                    name="username"
                    label="Username"
                    rules={[{ required: true }]}
                  >
                    <Input />
                  </Form.Item>

                  <Form.Item
                    name="designation"
                    label="Designation"
                    rules={[{ required: true }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item
                    name="position"
                    label="Position"
                    rules={[{ required: true }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item
                    name="email"
                    label="Email"
                    rules={[{ required: true, type: "email" }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item
                    name="password"
                    label="Password"
                    rules={[
                      { required: true },
                      { min: securityRules.passwordMinLength, message: `Password must be at least ${securityRules.passwordMinLength} characters` },
                      ...(securityRules.passwordRequiresNumber ? [{ pattern: /\d/, message: "Password must contain at least one number" }] : []),
                      ...(securityRules.passwordRequiresSymbol ? [{ pattern: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/, message: "Password must contain at least one special character" }] : []),
                    ]}
                  >
                    <Input.Password />
                  </Form.Item>
                  <Form.Item
                    name="confirmPassword"
                    label="Confirm Password"
                    dependencies={["password"]}
                    rules={[
                      {
                        required: true,
                        message: "Please confirm your password",
                      },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          return !value || getFieldValue("password") === value
                            ? Promise.resolve()
                            : Promise.reject("Passwords do not match");
                        },
                      }),
                    ]}
                  >
                    <Input.Password />
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      block
                      loading={loading}
                      className="signup-button fixed-primary-btn"
                    >
                      Register
                    </Button>
                  </Form.Item>

                  {/* ✅ Resend Email centered */}
                  <div style={{ textAlign: "center" }}>
                    <Text type="secondary">Didn’t receive verification?</Text>{" "}
                    <Button
                      type="link"
                      onClick={() => {
                        const email = document.querySelector(
                          'input[name="email"]'
                        ).value;
                        if (email) {
                          handleResend(email);
                        } else {
                          swalWarning("Enter email first");
                        }
                      }}
                    >
                      Resend Email
                    </Button>
                  </div>
                </Form>
              ),
            });
          }
          return (
            <Tabs
              activeKey={tab}
              onChange={(key) => setTab(key)}
              centered
              items={items}
            />
          );
        })()}
      </Card>
      </div>
    </div>
  );
};

export default AuthPage;

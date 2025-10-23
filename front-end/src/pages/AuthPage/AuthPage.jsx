import { useState, useEffect } from "react";
import { Tabs, Form, Input, Button, Typography, Card, message } from "antd";
import { useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import bgImage from "../../assets/bgemb.webp";
import axios from "../../api/axiosInstance";
import "./authpage.css";
import Swal from "sweetalert2";

const { Title, Text } = Typography;

const AuthPage = () => {
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("login");
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState("1");
  const { login } = useAuth();

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
      message.error(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // --- Signup handler
  const onSignup = async (values) => {
    if (values.password !== values.confirmPassword) {
      return message.error("Passwords do not match");
    }
    try {
      setLoading(true);
      const { confirmPassword, ...userData } = values;
      const res = await axios.post("/users/signup", userData);

      Swal.fire({
        title: "Signup Successful!",
        text: "A verification email has been sent. Please check your inbox.",
        icon: "success",
        confirmButtonText: "OK",
      }).then(() => {
        form.resetFields(); // ✅ Clear fields
        setTab("login"); // ✅ Go back to login tab
      });
    } catch (err) {
      message.error(err.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  // --- Resend Verification
  const handleResend = async (email) => {
    try {
      await axios.post("/users/resend", { email });
      message.success("Verification email resent.");
    } catch (err) {
      message.error(err.response?.data?.message || "Resend failed");
    }
  };

  return (
    <div
      className="auth-container"
      style={{
        backgroundImage: `linear-gradient(
      135deg,
      rgba(0, 75, 128, 0.85),
      rgba(154, 205, 50, 0.85),
      rgba(245, 216, 163, 0.85)
    ), url(${bgImage})`,
      }}
    >
      <Card className="auth-card">
        <Title level={3} className="auth-title">
          EMBR3 DTR Management System
        </Title>

        <Tabs
          activeKey={tab}
          onChange={(key) => setTab(key)}
          centered
          items={[
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
                      className="login-button"
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
            {
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
                    rules={[{ required: true, min: 6 }]}
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
                      className="signup-button"
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
                          message.warning("Enter email first");
                        }
                      }}
                    >
                      Resend Email
                    </Button>
                  </div>
                </Form>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default AuthPage;

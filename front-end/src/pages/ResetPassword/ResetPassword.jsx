import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, Form, Input, Button, Typography } from "antd";
import Swal from "sweetalert2";
import axios from "../../api/axiosInstance";
import "./resetpassword.css"; // For fade animation

const { Title, Text } = Typography;

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    const { password, confirm } = values;

    if (password !== confirm) {
      Swal.fire({
        icon: "error",
        title: "Password Mismatch",
        text: "Passwords do not match.",
      });
      return;
    }

    setLoading(true);
    try {
      await axios.post(`/users/reset-password/${token}`, { password });

      await Swal.fire({
        icon: "success",
        title: "Password Updated",
        text: "You can now log in with your new password.",
      });

      navigate("/auth");
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Reset Failed",
        text: err.response?.data?.message || "Token expired or invalid.",
      });

      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reset-container fade-in">
      <Card
        title={<Title level={3} style={{ marginBottom: 0 }}>Reset Your Password</Title>}
        style={{ width: 400 }}
      >
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="password"
            label="New Password"
            rules={[
              { required: true, message: "Please enter your new password" },
              { min: 6, message: "Password must be at least 6 characters" },
            ]}
          >
            <Input.Password placeholder="Enter new password" visibilityToggle />
          </Form.Item>

          <Form.Item
            name="confirm"
            label="Confirm Password"
            dependencies={["password"]}
            rules={[
              { required: true, message: "Please confirm your password" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("Passwords do not match"));
                },
              }),
            ]}
          >
            <Input.Password placeholder="Confirm new password" visibilityToggle />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
            >
              Reset Password
            </Button>
          </Form.Item>

          <Text type="secondary">
            Remembered your password?{" "}
            <Link to="/auth">Back to Login</Link>
          </Text>
        </Form>
      </Card>
    </div>
  );
};

export default ResetPassword;

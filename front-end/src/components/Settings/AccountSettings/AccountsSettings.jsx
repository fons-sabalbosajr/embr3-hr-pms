import React, { useState, useEffect } from "react";
import {
  Form,
  Input,
  Button,
  Card,
  Row,
  Col,
  Radio,
  notification,
  Spin,
  Typography,
} from "antd";
import axiosInstance from "../../../api/axiosInstance";
import { useTheme } from "../../../context/ThemeContext";
import useAuth from "../../../hooks/useAuth";

const { Title } = Typography;

const AccountsSettings = () => {
  const [loading, setLoading] = useState(false);
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const { user, updateCurrentUser } = useAuth();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (user) {
      profileForm.setFieldsValue({ name: user.name, username: user.username });
      if (user.theme) {
        setTheme(user.theme);
      }
    }
  }, [user, profileForm, setTheme]);

  const handleProfileUpdate = async (values) => {
    setLoading(true);
    try {
      const res = await axiosInstance.put("/users/profile", values);
      updateCurrentUser({ ...user, ...res.data });
      notification.success({ message: "Profile updated successfully!" });
    } catch (error) {
      notification.error({ message: error.response?.data?.message || "Failed to update profile." });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (values) => {
    if (values.newPassword !== values.confirmPassword) {
      notification.error({ message: "New passwords do not match!" });
      return;
    }
    setLoading(true);
    try {
      await axiosInstance.put("/users/change-password", {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });
      notification.success({ message: "Password changed successfully!" });
      passwordForm.resetFields();
    } catch (error) {
      notification.error({ message: error.response?.data?.message || "Failed to change password." });
    } finally {
      setLoading(false);
    }
  };

  const handleThemeChange = async (e) => {
    const newTheme = e.target.value;
    setTheme(newTheme);
    setLoading(true);
    try {
      const res = await axiosInstance.put("/users/preferences", { theme: newTheme });
      updateCurrentUser(res.data);
      notification.success({ message: "Theme updated!" });
    } catch (error) {
      notification.error({ message: error.response?.data?.message || "Failed to save theme preference." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]}>
        {/* Profile Information Card */}
        <Col xs={24} md={12}>
          <Card title="Profile Information">
            <Form form={profileForm} layout="vertical" onFinish={handleProfileUpdate}>
              <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="username" label="Username" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">
                  Update Profile
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* Change Password Card */}
        <Col xs={24} md={12}>
          <Card title="Change Password">
            <Form form={passwordForm} layout="vertical" onFinish={handlePasswordChange}>
              <Form.Item name="oldPassword" label="Old Password" rules={[{ required: true }]}>
                <Input.Password />
              </Form.Item>
              <Form.Item name="newPassword" label="New Password" rules={[{ required: true }]}>
                <Input.Password />
              </Form.Item>
              <Form.Item name="confirmPassword" label="Confirm New Password" rules={[{ required: true }]}>
                <Input.Password />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">
                  Change Password
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* Theme Preferences Card */}
        <Col xs={24} md={24}>
            <Card title="Theme Preferences">
                 <Row align="middle" justify="space-between">
                    <Col>
                        <Title level={5}>Application Theme</Title>
                        <Typography.Text type="secondary">Choose a theme for the application.</Typography.Text>
                    </Col>
                    <Col>
                        <Radio.Group onChange={handleThemeChange} value={theme}>
                            <Radio.Button value="light">Light</Radio.Button>
                            <Radio.Button value="dark">Dark</Radio.Button>
                            <Radio.Button value="compact">Compact</Radio.Button>
                        </Radio.Group>
                    </Col>
                </Row>
            </Card>
        </Col>
      </Row>
    </Spin>
  );
};

export default AccountsSettings;

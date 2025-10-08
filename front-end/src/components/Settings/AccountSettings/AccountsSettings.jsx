import React, { useState, useEffect } from "react";
import {
  Form,
  Input,
  Button,
  Card,
  Row,
  Col,
  Radio,
  Segmented,
  Space,
  notification,
  Spin,
  Typography,
} from "antd";
import axiosInstance from "../../../api/axiosInstance";
import { useTheme } from "../../../context/ThemeContext";
import "./accountsettings.css";
import useAuth from "../../../hooks/useAuth";

const { Title } = Typography;

const AccountsSettings = () => {
  const [loading, setLoading] = useState(false);
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const { user, updateCurrentUser } = useAuth();
  const { theme, setTheme, userPrimaryPreset, setUserPrimaryPreset, applyPresetToChrome, setApplyPresetToChrome } = useTheme();

  useEffect(() => {
    if (user) {
      profileForm.setFieldsValue({ name: user.name, username: user.username });
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

  // Theme presets (fixed, no custom pickers)
  const colorPresets = [
    { key: 'default', label: 'Default' },
    { key: 'blue', label: 'Blue' },
    { key: 'green', label: 'Green' },
    { key: 'purple', label: 'Purple' },
    { key: 'yellow', label: 'Yellow' },
    { key: 'red', label: 'Red' },
    { key: 'orange', label: 'Orange' },
    { key: 'cyan', label: 'Cyan' },
    { key: 'magenta', label: 'Magenta' },
    { key: 'geekblue', label: 'Geek Blue' },
    { key: 'gold', label: 'Gold' },
    { key: 'lime', label: 'Lime' },
  ];

  const presetColorMap = {
    default: undefined,
    blue: '#1677ff',
    green: '#52c41a',
    purple: '#722ed1',
    yellow: '#fadb14',
    red: '#ff4d4f',
    orange: '#fa8c16',
    cyan: '#13c2c2',
    magenta: '#eb2f96',
    geekblue: '#2f54eb',
    gold: '#faad14',
    lime: '#a0d911',
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

        {/* Theme Preferences (User-level, fixed presets) */}
        <Col xs={24}>
          <Card title="Theme Preferences" className="theme-preferences-card">
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Form layout="vertical">
                  <Form.Item label="Mode">
                    <Segmented
                      block
                      options={[
                        { label: 'Light', value: 'light' },
                        { label: 'Dark', value: 'dark' },
                      ]}
                      value={theme}
                      onChange={(val) => setTheme(val)}
                    />
                  </Form.Item>
                  <Form.Item label="Primary color preset">
                    <Radio.Group
                      value={userPrimaryPreset}
                      onChange={(e) => setUserPrimaryPreset(e.target.value)}
                      className="preset-grid"
                    >
                      {colorPresets.map((p) => {
                        const color = presetColorMap[p.key];
                        return (
                          <Radio key={p.key} value={p.key} className="preset-item">
                            <div
                              className="preset-swatch"
                              style={{
                                background: color || 'transparent',
                                borderColor: color ? 'transparent' : 'var(--app-menu-item-color, #999)'
                              }}
                              aria-label={`Preset ${p.label}`}
                            />
                            <div className="preset-label">{p.label}</div>
                          </Radio>
                        );
                      })}
                    </Radio.Group>
                  </Form.Item>
                  <Form.Item>
                    <Radio.Group
                      value={applyPresetToChrome ? 'on' : 'off'}
                      onChange={(e) => setApplyPresetToChrome(e.target.value === 'on')}
                    >
                      <Radio value="off">Apply to content only</Radio>
                      <Radio value="on">Also apply to Header & Sider</Radio>
                    </Radio.Group>
                  </Form.Item>
                </Form>
              </Col>
              <Col xs={24} md={12}>
                <Card size="small" title="Preview" className="theme-preview-card">
                  <Space direction="vertical">
                    <Space>
                      <Button type="primary">Primary</Button>
                      <Button type="default">Default</Button>
                      <Button type="dashed">Dashed</Button>
                    </Space>
                    <Space>
                      <a>Link</a>
                      <Button type="link">Link Button</Button>
                    </Space>
                  </Space>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </Spin>
  );
};

export default AccountsSettings;

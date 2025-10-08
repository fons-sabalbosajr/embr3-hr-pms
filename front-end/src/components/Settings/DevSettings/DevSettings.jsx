import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Descriptions,
  Space,
  Tag,
  Alert,
  Typography,
  Divider,
  Button,
  Tabs,
  Form,
  Input,
  InputNumber,
  Switch,
  ColorPicker,
  App as AntApp,
  Row,
  Col,
} from "antd";
import axiosInstance from "../../../api/axiosInstance";
import useAuth from "../../../hooks/useAuth";

const { Title, Text } = Typography;

const Section = ({ title, children, extra }) => (
  <Card title={title} extra={extra} size="small" style={{ marginBottom: 16 }}>
    {children}
  </Card>
);

const DevSettings = () => {
  const { user, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [devInfo, setDevInfo] = useState(null);

  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState(null);
  const [settings, setSettings] = useState(null);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState("runtime");
  const { message } = AntApp.useApp();

  const canSeeDev = user?.isAdmin || hasPermission("canAccessDeveloper");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get("/dev/config");
        if (!mounted) return;
        setDevInfo(res.data);
      } catch (err) {
        if (!mounted) return;
        setError(
          err?.response?.data?.message ||
            err.message ||
            "Failed to load dev settings"
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };
    if (canSeeDev) load();
    return () => {
      mounted = false;
    };
  }, [canSeeDev]);

  useEffect(() => {
    let mounted = true;
    const loadSettings = async () => {
      try {
        setSettingsLoading(true);
        const res = await axiosInstance.get("/settings");
        if (!mounted) return;
        setSettings(res.data);
      } catch (err) {
        if (!mounted) return;
        setSettingsError(
          err?.response?.data?.message ||
            err.message ||
            "Failed to load application settings"
        );
      } finally {
        if (mounted) setSettingsLoading(false);
      }
    };
    if (canSeeDev) loadSettings();
    return () => {
      mounted = false;
    };
  }, [canSeeDev, form]);

  // Populate form values when the settings are loaded and the tab is active/mounted
  useEffect(() => {
    if (activeTab === "app-settings" && settings) {
      form.setFieldsValue(settings);
    }
  }, [activeTab, settings, form]);

  if (!canSeeDev) {
    return (
      <Alert
        type="warning"
        message="Insufficient permissions"
        description="You don't have access to Developer Settings."
        showIcon
      />
    );
  }

  if (error) {
    return (
      <Alert
        type="error"
        message="Failed to load Developer Settings"
        description={error}
        showIcon
      />
    );
  }

  const onSaveSettings = async (values) => {
    try {
      await axiosInstance.put("/settings", values);
      message.success("Settings updated");
      setSettings(values);
      // Notify ThemeContext to re-fetch and apply CSS variables
      window.dispatchEvent(new Event('app-settings-updated'));
    } catch (err) {
      message.error(
        err?.response?.data?.message ||
          err.message ||
          "Failed to update settings"
      );
    }
  };

  const runtimeTab = (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Section
        title="Application"
        extra={
          <Button onClick={() => window.location.reload()}>Reload App</Button>
        }
      >
        {loading || !devInfo ? (
          <Card loading />
        ) : (
          <Descriptions size="small" column={1}>
            <Descriptions.Item label="Node Version">
              {devInfo.app.node}
            </Descriptions.Item>
            <Descriptions.Item label="Environment">
              {devInfo.app.env}
            </Descriptions.Item>
            <Descriptions.Item label="Server Host">
              {devInfo.app.serverHost}
            </Descriptions.Item>
            <Descriptions.Item label="Server Port">
              {devInfo.app.serverPort}
            </Descriptions.Item>
            <Descriptions.Item label="Client Origin">
              {devInfo.app.clientOrigin || <Tag>not set</Tag>}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Section>

      <Section title="Database">
        {loading || !devInfo ? (
          <Card loading />
        ) : (
          <Descriptions
            size="small"
            column={1}
            extra={
              <Tag color={devInfo.db.connected ? "green" : "red"}>
                {devInfo.db.connected ? "Connected" : "Disconnected"}
              </Tag>
            }
          >
            <Descriptions.Item label="Name">
              {devInfo.db.name || <Tag>unknown</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="Host">
              {devInfo.db.host || <Tag>unknown</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="Port">
              {devInfo.db.port || <Tag>unknown</Tag>}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Section>

      <Section title="Email">
        {loading || !devInfo ? (
          <Card loading />
        ) : (
          <Descriptions size="small" column={1}>
            <Descriptions.Item label="Configured">
              {devInfo.email.configured ? (
                <Tag color="green">yes</Tag>
              ) : (
                <Tag color="red">no</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="User">
              {devInfo.email.user || <Tag>not set</Tag>}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Section>

      <Section title="Google Drive">
        {loading || !devInfo ? (
          <Card loading />
        ) : (
          <Descriptions size="small" column={1}>
            <Descriptions.Item label="Service Account Key">
              {devInfo.google.serviceAccountKey || <Tag>not set</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="Configured">
              {devInfo.google.configured ? (
                <Tag color="green">yes</Tag>
              ) : (
                <Tag color="red">no</Tag>
              )}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Section>

      <Section title="Socket.IO">
        {loading || !devInfo ? (
          <Card loading />
        ) : (
          <Descriptions size="small" column={1}>
            <Descriptions.Item label="Path">
              {devInfo.socket.path}
            </Descriptions.Item>
            <Descriptions.Item label="Ping Interval">
              {devInfo.socket.pingInterval} ms
            </Descriptions.Item>
            <Descriptions.Item label="Ping Timeout">
              {devInfo.socket.pingTimeout} ms
            </Descriptions.Item>
            <Descriptions.Item label="CORS Origin">
              {String(devInfo.socket.corsOrigin)}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Section>

      <Divider />
      <Text type="secondary">
        Tip: sensitive values (passwords, tokens, URIs) are intentionally
        omitted here.
      </Text>
    </Space>
  );

  const appSettingsTab = (
    <>
      {settingsError && (
        <Alert
          type="error"
          message={settingsError}
          showIcon
          style={{ marginBottom: 12 }}
        />
      )}
      <Form
        form={form}
        layout="vertical"
        onFinish={onSaveSettings}
        initialValues={settings || {}}
      >
        <Section title="General">
          <Form.Item name={["general", "appName"]} label="App Name">
            <Input placeholder="EMB3 HR PMS" />
          </Form.Item>
          <Row gutter={[12, 12]} align="middle">
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name={["general", "themeColor"]}
                label="Theme Color"
                // Map ColorPicker event to hex string for the form value
                getValueFromEvent={(color, hex) => hex}
                style={{ marginBottom: 0 }}
              >
                <ColorPicker
                  format="hex"
                  showText
                  presets={[
                    { label: "Ant Blue", colors: ["#1677ff", "#1890ff"] },
                    { label: "Greens", colors: ["#52c41a", "#389e0d"] },
                    { label: "Reds", colors: ["#f5222d", "#cf1322"] },
                    { label: "Purples", colors: ["#722ed1", "#531dab"] },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name={["general", "headerColor"]}
                label="Header Color"
                getValueFromEvent={(color, hex) => hex}
                style={{ marginBottom: 0 }}
              >
                <ColorPicker format="hex" showText />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name={["general", "siderColor"]}
                label="Sider Color"
                getValueFromEvent={(color, hex) => hex}
                style={{ marginBottom: 0 }}
              >
                <ColorPicker format="hex" showText />
              </Form.Item>
            </Col>
          </Row>
        </Section>

        <Section title="DTR">
          <Space size={12} wrap>
            <Form.Item
              name={["dtr", "defaultStartTime"]}
              label="Default Start Time"
            >
              <Input placeholder="08:00" />
            </Form.Item>
            <Form.Item
              name={["dtr", "defaultEndTime"]}
              label="Default End Time"
            >
              <Input placeholder="17:00" />
            </Form.Item>
            <Form.Item
              name={["dtr", "autoFillBreakOut"]}
              label="Auto-fill Break Out"
            >
              <Input placeholder="12:00 PM" />
            </Form.Item>
            <Form.Item
              name={["dtr", "autoFillBreakIn"]}
              label="Auto-fill Break In"
            >
              <Input placeholder="01:00 PM" />
            </Form.Item>
          </Space>
        </Section>

        <Section title="Security">
          <Space size={12} wrap>
            <Form.Item
              name={["security", "sessionTimeout"]}
              label="Session Timeout (minutes)"
            >
              <InputNumber min={1} />
            </Form.Item>
            <Form.Item
              name={["security", "passwordMinLength"]}
              label="Password Min Length"
            >
              <InputNumber min={6} />
            </Form.Item>
            <Form.Item
              name={["security", "passwordRequiresNumber"]}
              label="Require Number"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              name={["security", "passwordRequiresSymbol"]}
              label="Require Symbol"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Space>
        </Section>

        <Space>
          <Button type="primary" htmlType="submit" loading={settingsLoading}>
            Save Settings
          </Button>
          <Button
            onClick={async () => {
              try {
                setSettingsLoading(true);
                const res = await axiosInstance.get("/settings");
                setSettings(res.data);
                if (activeTab === "app-settings") {
                  form.setFieldsValue(res.data);
                }
              } finally {
                setSettingsLoading(false);
              }
            }}
          >
            Reset
          </Button>
        </Space>
      </Form>
    </>
  );

  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Title level={3}>Developer Settings</Title>
      {!canSeeDev && (
        <Alert
          type="warning"
          message="Insufficient permissions"
          description="You don't have access to Developer Settings."
          showIcon
        />
      )}
      {error && (
        <Alert
          type="error"
          message="Failed to load runtime info"
          description={error}
          showIcon
        />
      )}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "runtime",
            label: "Runtime",
            children: runtimeTab,
          },
          {
            key: "app-settings",
            label: "Application Settings",
            children: appSettingsTab,
            forceRender: true,
          },
        ]}
      />
    </Space>
  );
};

export default DevSettings;

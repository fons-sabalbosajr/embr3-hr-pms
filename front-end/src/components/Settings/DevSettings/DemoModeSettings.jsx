import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  App as AntApp,
  Alert,
  Button,
  Checkbox,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  Row,
  Space,
  Switch,
  Tag,
  Tour,
  Typography,
} from "antd";
import dayjs from "dayjs";
import axiosInstance from "../../../api/axiosInstance";

const { Title, Text } = Typography;

// Map menu choices to permission flags used through the app
const MENU_TO_PERMISSIONS = [
  { key: "dashboard", label: "Dashboard", perms: ["canViewDashboard"] },
  { key: "/employees", label: "Employees", perms: ["canViewEmployees"] },
  { key: "/dtr/logs", label: "DTR • Biometric Logs", perms: ["canViewDTR"] },
  { key: "import-biometrics", label: "DTR • Import Biometrics Button", perms: ["canManipulateBiometrics"] },
  { key: "/dtr/reports", label: "DTR • Reports", perms: ["canViewDTR"] },
  { key: "/dtr/process", label: "DTR • Generate", perms: ["canProcessDTR"] },
  {
    key: "/dtr/holidays",
    label: "DTR • Holidays & Suspensions",
    perms: ["canViewDTR"],
  },
  { key: "/trainings", label: "Training Records", perms: ["canViewTrainings"] },
  { key: "/benefitsinfo", label: "Compensation", perms: ["canViewPayroll"] },
  // Admin/Settings (typically hidden for demo)
  {
    key: "/settings/account",
    label: "Settings • Account Preferences",
    perms: ["canAccessSettings"],
  },
  {
    key: "/settings/access",
    label: "Settings • User Access",
    perms: ["canManageUsers"],
  },
  {
    key: "/settings/deductions",
    label: "Settings • Deductions",
    perms: ["canChangeDeductions"],
  },
  {
    key: "/settings/backup",
    label: "Settings • Backup",
    perms: ["canPerformBackup"],
  },
  {
    key: "/settings/developer-settings",
    label: "Settings • Developer Settings",
    perms: ["canAccessDeveloper"],
  },
];

const MAX_END = dayjs("2025-11-30T23:59:59");

const DemoModeSettings = ({ settings, onUpdated }) => {
  const [form] = Form.useForm();
  const { message } = AntApp.useApp();
  const [saving, setSaving] = useState(false);

  // Tour refs
  const refEnable = useRef(null);
  const refDates = useRef(null);
  const refMenus = useRef(null);
  const refSave = useRef(null);
  const [tourOpen, setTourOpen] = useState(false);

  const initialDemo = useMemo(() => settings?.demo || {}, [settings]);
  const allowedFromPerms = useMemo(
    () => new Set(initialDemo.allowedPermissions || []),
    [initialDemo]
  );
  const initialCheckedMenuKeys = useMemo(() => {
    const keys = [];
    MENU_TO_PERMISSIONS.forEach((opt) => {
      const on = (opt.perms || []).some((p) => allowedFromPerms.has(p));
      if (on) keys.push(opt.key);
    });
    return keys;
  }, [allowedFromPerms]);

  useEffect(() => {
    const start = initialDemo.startDate ? dayjs(initialDemo.startDate) : null;
    const end = initialDemo.endDate ? dayjs(initialDemo.endDate) : null;
    form.setFieldsValue({
      demo: {
        enabled: Boolean(initialDemo.enabled),
        dateRange: start && end ? [start, end] : null,
        credentials: {
          username: initialDemo?.credentials?.username || "demo_user",
          password: "", // never prefill
        },
        maskSensitiveData: initialDemo?.maskSensitiveData !== false,
        allowSubmissions: Boolean(initialDemo?.allowSubmissions),
        showActiveBanner: initialDemo?.showActiveBanner !== false,
        menuKeys: initialCheckedMenuKeys,
      },
    });
  }, [form, initialDemo, initialCheckedMenuKeys]);

  const disabledDate = (current) => current && current > MAX_END.endOf("day");

  const onSave = async (values) => {
    try {
      setSaving(true);
      const v = values?.demo || {};
      const dateRange = v.dateRange || [];
      const startDate = dateRange[0]
        ? dateRange[0].startOf("day").toISOString()
        : null;
      const endDate = dateRange[1]
        ? dateRange[1].endOf("day").toISOString()
        : null;

      // Map selected menus to permission keys and de-duplicate
      const selected = new Set();
      (v.menuKeys || []).forEach((k) => {
        const entry = MENU_TO_PERMISSIONS.find((m) => m.key === k);
        (entry?.perms || []).forEach((p) => selected.add(p));
      });

      const payload = {
        ...(settings || {}),
        demo: {
          enabled: Boolean(v.enabled),
          startDate,
          endDate,
          credentials: {
            username: v.credentials?.username || "demo_user",
            // If password provided, backend will hash; else omit to keep unchanged
            ...(v.credentials?.password
              ? { password: v.credentials.password }
              : {}),
          },
          allowedPermissions: Array.from(selected),
          maskSensitiveData: v.maskSensitiveData !== false,
          allowSubmissions: Boolean(v.allowSubmissions),
          showActiveBanner: v.showActiveBanner !== false,
        },
      };

      const res = await axiosInstance.put("/settings", payload);
      onUpdated?.(res.data);
      message.success("Demo mode settings saved");
    } catch (e) {
      message.error(
        e?.response?.data?.message || "Failed to save demo settings"
      );
    } finally {
      setSaving(false);
    }
  };

  const now = dayjs();
  const isActive =
    Boolean(initialDemo.enabled) &&
    (!initialDemo.startDate || now.isAfter(dayjs(initialDemo.startDate))) &&
    (!initialDemo.endDate ||
      now.isBefore(dayjs(initialDemo.endDate).add(1, "second")));

  return (
    <>
      {isActive && initialDemo.showActiveBanner !== false && (
        <Alert
          type="info"
          showIcon
          message={
            <Space>
              <Text strong>Demo Mode is currently active</Text>
              <Tag color="processing">Read-only by default</Tag>
            </Space>
          }
          style={{ marginBottom: 12 }}
        />
      )}

      <Form form={form} layout="vertical" onFinish={onSave}>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={8}>
            <div ref={refEnable}>
              <Form.Item
                name={["demo", "enabled"]}
                label="Enable Demo Mode"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </div>
            <div ref={refDates}>
              <Form.Item
                name={["demo", "dateRange"]}
                label="Effectivity (Date Range)"
              >
                <DatePicker.RangePicker
                  style={{ width: "100%" }}
                  allowEmpty={[true, true]}
                  disabledDate={disabledDate}
                />
              </Form.Item>
            </div>
            <Form.Item label="Demo Credentials" required>
              <Input.Group compact>
                <Form.Item name={["demo", "credentials", "username"]} noStyle>
                  <Input style={{ width: "50%" }} placeholder="Username" />
                </Form.Item>
                <Form.Item
                  name={["demo", "credentials", "password"]}
                  tooltip="Leave blank to keep existing password"
                  noStyle
                >
                  <Input.Password
                    style={{ width: "50%" }}
                    placeholder="Set/Reset Password"
                  />
                </Form.Item>
              </Input.Group>
              <Text type="secondary">
                Default credentials if none set: demo_user / Demo1234
              </Text>
            </Form.Item>
            <Form.Item
              name={["demo", "maskSensitiveData"]}
              label="Mask Sensitive Data (e.g., amounts)"
              valuePropName="checked"
            >
              <Switch defaultChecked />
            </Form.Item>
            <Form.Item
              name={["demo", "allowSubmissions"]}
              label="Allow Actual Submissions"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              name={["demo", "showActiveBanner"]}
              label="Show Active Banner"
              valuePropName="checked"
            >
              <Switch defaultChecked />
            </Form.Item>
          </Col>
          <Col xs={24} md={16}>
            <div ref={refMenus}>
              <Form.Item
                name={["demo", "menuKeys"]}
                label="Expose Menus in Demo"
              >
                <Checkbox.Group style={{ width: "100%" }}>
                  <Row gutter={[8, 8]}>
                    {MENU_TO_PERMISSIONS.map((opt) => (
                      <Col xs={24} sm={12} key={opt.key}>
                        <Checkbox value={opt.key}>{opt.label}</Checkbox>
                      </Col>
                    ))}
                  </Row>
                </Checkbox.Group>
              </Form.Item>
            </div>
          </Col>
        </Row>
        <Space>
          <Button
            ref={refSave}
            type="primary"
            htmlType="submit"
            loading={saving}
          >
            Save Demo Settings
          </Button>
          <Button onClick={() => setTourOpen(true)}>Show Quick Tour</Button>
        </Space>
      </Form>

      <Tour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        mask
        closable
        type="primary"
        steps={[
          {
            title: "Enable Demo Mode",
            description: "Turn this on to activate app-wide demo experience.",
            target: () => refEnable.current,
          },
          {
            title: "Effectivity",
            description: `Limit demo within a date range (max until ${MAX_END.format(
              "MMM D, YYYY"
            )}).`,
            target: () => refDates.current,
          },
          {
            title: "Expose Menus",
            description: "Choose which menu items are visible for demo users.",
            target: () => refMenus.current,
          },
          {
            title: "Save",
            description: "Click to apply settings instantly.",
            target: () => refSave.current,
          },
        ]}
      />
    </>
  );
};

export default DemoModeSettings;

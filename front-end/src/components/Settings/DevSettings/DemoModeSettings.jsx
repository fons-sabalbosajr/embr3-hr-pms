import React, { useEffect, useMemo, useRef, useState } from "react";
import {
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
  Table,
  Tooltip,
} from "antd";
import dayjs from "dayjs";
import axiosInstance from "../../../api/axiosInstance";
import { swalSuccess, swalError } from "../../../utils/swalHelper";
import demoActions from "../../../utils/demoActionsRegistry";
import { secureStore } from "../../../../utils/secureStorage";

const { Title, Text } = Typography;

// Map menu choices to permission flags used through the app
const MENU_TO_PERMISSIONS = [
  { key: "dashboard", label: "Dashboard", perms: ["canViewDashboard"] },
  { key: "/employees", label: "Employees", perms: ["canViewEmployees"] },
  { key: "/dtr/logs", label: "DTR • Biometric Logs", perms: ["canViewDTR"] },
  {
    key: "import-biometrics",
    label: "DTR • Import Biometrics Button",
    perms: ["canManipulateBiometrics"],
  },
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
  const [saving, setSaving] = useState(false);
  const autoSaveTimer = useRef(null);

  // Tour refs
  const refEnable = useRef(null);
  const refDates = useRef(null);
  const refMenus = useRef(null);
  const refSave = useRef(null);
  const [tourOpen, setTourOpen] = useState(false);

  const initialDemo = useMemo(() => settings?.demo || {}, [settings]);
  const disabledKeys = Form.useWatch(["demo", "allowedActions"], form) || [];
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
        allowedActions: initialDemo?.allowedActions || [],
        hiddenActions: initialDemo?.hiddenActions || [],
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
          allowedActions: Array.isArray(v.allowedActions)
            ? v.allowedActions
            : [],
          hiddenActions: Array.isArray(v.hiddenActions) ? v.hiddenActions : [],
        },
      };

      const res = await axiosInstance.put("/settings", payload);
      // Persist latest settings so axios interceptor picks it up immediately
      try {
        secureStore("appSettings", res.data);
      } catch (_) {}
      onUpdated?.(res.data);
      swalSuccess("Demo mode settings saved");
    } catch (e) {
      swalError(
        e?.response?.data?.message || "Failed to save demo settings"
      );
    } finally {
      setSaving(false);
    }
  };

  // Build payload from current form values (shared by manual save and auto-save)
  const buildPayload = (values) => {
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

    return {
      ...(settings || {}),
      demo: {
        enabled: Boolean(v.enabled),
        startDate,
        endDate,
        credentials: {
          username: v.credentials?.username || "demo_user",
          ...(v.credentials?.password ? { password: v.credentials.password } : {}),
        },
        allowedPermissions: Array.from(selected),
        maskSensitiveData: v.maskSensitiveData !== false,
        allowSubmissions: Boolean(v.allowSubmissions),
        showActiveBanner: v.showActiveBanner !== false,
        allowedActions: Array.isArray(v.allowedActions) ? v.allowedActions : [],
        hiddenActions: Array.isArray(v.hiddenActions) ? v.hiddenActions : [],
      },
    };
  };

  // Debounced auto-save used when toggling per-action switches so changes take effect immediately
  const scheduleAutoSave = () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        const values = form.getFieldsValue();
        const payload = buildPayload(values);
        const res = await axiosInstance.put("/settings", payload);
        try { secureStore("appSettings", res.data); } catch (_) {}
        onUpdated?.(res.data);
      } catch (_) {
        // Silent fail to avoid UI noise; manual Save remains available
      }
    }, 400);
  };

  const now = dayjs();
  const isActive =
    Boolean(initialDemo.enabled) &&
    (!initialDemo.startDate || now.isAfter(dayjs(initialDemo.startDate))) &&
    (!initialDemo.endDate ||
      now.isBefore(dayjs(initialDemo.endDate).add(1, "second")));

  const toggleDisabled = (key, on) => {
    const set = new Set(disabledKeys);
    if (on) set.add(key);
    else set.delete(key);
    form.setFieldsValue({
      demo: {
        ...(form.getFieldValue("demo") || {}),
        allowedActions: Array.from(set),
      },
    });
    scheduleAutoSave();
  };

  // Watch hiddenActions (even though we add a hidden Form.Item binding below to ensure reactivity)
  const hiddenKeys = Form.useWatch(["demo", "hiddenActions"], form) || [];
  const toggleHidden = (key, on) => {
    const set = new Set(hiddenKeys);
    if (on) set.add(key);
    else set.delete(key);
    form.setFieldsValue({
      demo: {
        ...(form.getFieldValue("demo") || {}),
        hiddenActions: Array.from(set),
      },
    });
    scheduleAutoSave();
  };

  const allActionKeys = useMemo(() => demoActions.map(a => a.key), []);
  const isAllDisabled = disabledKeys.length === allActionKeys.length && allActionKeys.length > 0;
  const isAllHidden = hiddenKeys.length === allActionKeys.length && allActionKeys.length > 0;

  const bulkToggleDisabled = (on) => {
    form.setFieldsValue({
      demo: {
        ...(form.getFieldValue('demo') || {}),
        allowedActions: on ? allActionKeys : [],
      }
    });
    scheduleAutoSave();
  };

  const bulkToggleHidden = (on) => {
    form.setFieldsValue({
      demo: {
        ...(form.getFieldValue('demo') || {}),
        hiddenActions: on ? allActionKeys : [],
      }
    });
    scheduleAutoSave();
  };

  const actionColumns = [
    { title: "Feature", dataIndex: "label", key: "label", width: 240 },
    {
      title: "Feature Description / Function",
      dataIndex: "desc",
      key: "desc",
      render: (v) => (
        <Typography.Text style={{ fontSize: 12 }}>{v}</Typography.Text>
      ),
    },
    {
      title: "Key",
      dataIndex: "key",
      key: "key",
      width: 280,
      render: (v) => (
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          {v}
        </Typography.Text>
      ),
    },
    {
      title: "Disable in Demo",
      key: "disabled",
      width: 160,
      render: (_, r) => (
        <Switch
          size="small"
          checked={disabledKeys.includes(r.key)}
          onChange={(checked) => toggleDisabled(r.key, checked)}
        />
      ),
    },
    {
      title: "Hide in Demo",
      key: "hidden",
      width: 140,
      render: (_, r) => (
        <Switch
          size="small"
          checked={hiddenKeys.includes(r.key)}
          onChange={(checked) => toggleHidden(r.key, checked)}
        />
      ),
    },
    {
      title: "Status",
      key: "status",
      width: 140,
      render: (_, r) =>
        disabledKeys.includes(r.key) ? (
          <Tag color="red">Disabled</Tag>
        ) : (
          <Tag color="green">Enabled</Tag>
        ),
    },
  ];

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
            <Form.Item label="Options">
              <Space size={12} wrap>
                <Form.Item
                  name={["demo", "maskSensitiveData"]}
                  valuePropName="checked"
                  noStyle
                >
                  <Checkbox>Mask Sensitive Data</Checkbox>
                </Form.Item>
                <Form.Item
                  name={["demo", "allowSubmissions"]}
                  valuePropName="checked"
                  noStyle
                >
                  <Checkbox>Allow Actual Submissions</Checkbox>
                </Form.Item>
                <Form.Item
                  name={["demo", "showActiveBanner"]}
                  valuePropName="checked"
                  noStyle
                >
                  <Checkbox>Show Active Banner</Checkbox>
                </Form.Item>
              </Space>
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
        {/* Full-width Disabled Actions section to maximize horizontal space */}
        {/* Hidden binding for hiddenActions so form state updates trigger watchers */}
        <Form.Item name={["demo", "hiddenActions"]} hidden>
          <Input type="hidden" />
        </Form.Item>
        <Form.Item
          label="Disabled / Hidden Actions in Demo"
          name={["demo", "allowedActions"]}
          style={{ marginTop: 8 }}
        >
          <Space direction="vertical" style={{ width: "100%" }} size={8}>
            <Space wrap size={12} align="center">
              <Tooltip title="Disable all listed actions for demo users">
                <Space size={4} align="center">
                  <Switch size="small" checked={isAllDisabled} onChange={bulkToggleDisabled} />
                  <Text type="secondary" style={{ fontSize: 12 }}>Disable All</Text>
                </Space>
              </Tooltip>
              <Tooltip title="Hide all corresponding UI elements (actions) for demo users">
                <Space size={4} align="center">
                  <Switch size="small" checked={isAllHidden} onChange={bulkToggleHidden} />
                  <Text type="secondary" style={{ fontSize: 12 }}>Hide All</Text>
                </Space>
              </Tooltip>
              <Divider type="vertical" />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Use per-row switches or bulk toggles. Disabled prevents execution; Hidden removes UI.
              </Text>
            </Space>
            <Table
              size="small"
              className="compact-table"
              pagination={{
                pageSize: 12,
                showSizeChanger: true,
                pageSizeOptions: [8, 12, 20, 30],
              }}
              rowKey={(r) => r.key}
              dataSource={demoActions}
              columns={actionColumns}
              scroll={{ x: "max-content" }}
            />
            <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
              Checked in "Disable" column blocks action execution. Checked in "Hide" column hides its UI trigger.
            </Typography.Paragraph>
          </Space>
        </Form.Item>
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

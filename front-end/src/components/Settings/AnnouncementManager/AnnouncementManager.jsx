import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  DatePicker,
  Tag,
  Tooltip,
  Typography,
  Badge,
  Card,
  Divider,
  Row,
  Col,
  Segmented,
  Empty,
  Descriptions,
  List,
  Radio,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SendOutlined,
  BellOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  MailOutlined,
  EyeOutlined,
  ReloadOutlined,
  NotificationOutlined,
  ToolOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  LinkOutlined,
  LineOutlined,
  CopyOutlined,
  FontSizeOutlined,
} from "@ant-design/icons";
import axiosInstance from "../../../api/axiosInstance";
import useLoading from "../../../hooks/useLoading";
import { swalSuccess, swalError, swalConfirm } from "../../../utils/swalHelper";
import dayjs from "dayjs";

const { TextArea } = Input;
const { Text } = Typography;

const TYPE_OPTIONS = [
  { value: "announcement", label: "Announcement" },
  { value: "app-update", label: "App Update" },
  { value: "maintenance", label: "Maintenance Notice" },
  { value: "general", label: "General" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const TYPE_COLORS = {
  announcement: "blue",
  "app-update": "green",
  maintenance: "orange",
  general: "default",
};

const TYPE_ICONS = {
  announcement: <NotificationOutlined />,
  "app-update": <ThunderboltOutlined />,
  maintenance: <ToolOutlined />,
  general: <InfoCircleOutlined />,
};

const PRIORITY_COLORS = {
  low: "default",
  normal: "processing",
  high: "warning",
  critical: "error",
};

const PUBLISH_PLACE_OPTIONS = [
  { value: "popup", label: "In-App Pop-up" },
  { value: "login", label: "Login Page" },
  { value: "both", label: "Both (Pop-up & Login)" },
];

const PUBLISH_PLACE_COLORS = {
  popup: "blue",
  login: "purple",
  both: "cyan",
};

const TARGET_MODE_LABELS = {
  all: "All Employees",
  division: "By Division",
  section: "By Section / Unit",
  specific: "Specific Employees",
};

// ─── Formatting Toolbar ───────────────────────────────────────────────────────
const FormattingToolbar = ({ textAreaRef, value, onChange }) => {
  const wrap = useCallback(
    (before, after = before) => {
      const el = textAreaRef?.current?.resizableTextArea?.textArea;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const text = value || "";
      const selected = text.slice(start, end);
      const replacement = selected
        ? `${before}${selected}${after}`
        : `${before}text${after}`;
      const newText = text.slice(0, start) + replacement + text.slice(end);
      onChange(newText);
      setTimeout(() => {
        el.focus();
        const cursorPos = selected
          ? start + replacement.length
          : start + before.length;
        const cursorEnd = selected
          ? start + replacement.length
          : start + before.length + 4;
        el.setSelectionRange(cursorPos, cursorEnd);
      }, 0);
    },
    [textAreaRef, value, onChange],
  );

  const insertAtCursor = useCallback(
    (insertion) => {
      const el = textAreaRef?.current?.resizableTextArea?.textArea;
      if (!el) return;
      const start = el.selectionStart;
      const text = value || "";
      const newText = text.slice(0, start) + insertion + text.slice(start);
      onChange(newText);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(
          start + insertion.length,
          start + insertion.length,
        );
      }, 0);
    },
    [textAreaRef, value, onChange],
  );

  const insertList = useCallback(
    (ordered) => {
      const el = textAreaRef?.current?.resizableTextArea?.textArea;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const text = value || "";
      const selected = text.slice(start, end);
      const lines = selected
        ? selected.split("\n")
        : ["Item 1", "Item 2", "Item 3"];
      const formatted = lines
        .map((line, i) =>
          ordered ? `${i + 1}. ${line.trim()}` : `• ${line.trim()}`,
        )
        .join("\n");
      const prefix = start > 0 && text[start - 1] !== "\n" ? "\n" : "";
      const suffix = end < text.length && text[end] !== "\n" ? "\n" : "";
      const newText =
        text.slice(0, start) + prefix + formatted + suffix + text.slice(end);
      onChange(newText);
      setTimeout(() => el.focus(), 0);
    },
    [textAreaRef, value, onChange],
  );

  const btnStyle = {
    padding: "2px 6px",
    minWidth: 28,
    height: 26,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        flexWrap: "wrap",
        padding: "4px 6px",
        background: "#fafafa",
        border: "1px solid #d9d9d9",
        borderBottom: "none",
        borderRadius: "6px 6px 0 0",
      }}
    >
      <Tooltip title="Bold (**text**)">
        <Button
          size="small"
          type="text"
          icon={<BoldOutlined style={{ fontSize: 13 }} />}
          style={btnStyle}
          onClick={() => wrap("**")}
        />
      </Tooltip>
      <Tooltip title="Italic (*text*)">
        <Button
          size="small"
          type="text"
          icon={<ItalicOutlined style={{ fontSize: 13 }} />}
          style={btnStyle}
          onClick={() => wrap("*")}
        />
      </Tooltip>
      <Tooltip title="Underline (__text__)">
        <Button
          size="small"
          type="text"
          icon={<UnderlineOutlined style={{ fontSize: 13 }} />}
          style={btnStyle}
          onClick={() => wrap("__")}
        />
      </Tooltip>
      <Divider type="vertical" style={{ margin: "0 2px", height: 20 }} />
      <Tooltip title="Heading">
        <Button
          size="small"
          type="text"
          icon={<FontSizeOutlined style={{ fontSize: 13 }} />}
          style={btnStyle}
          onClick={() => insertAtCursor("\n## ")}
        />
      </Tooltip>
      <Tooltip title="Bullet List">
        <Button
          size="small"
          type="text"
          icon={<UnorderedListOutlined style={{ fontSize: 13 }} />}
          style={btnStyle}
          onClick={() => insertList(false)}
        />
      </Tooltip>
      <Tooltip title="Numbered List">
        <Button
          size="small"
          type="text"
          icon={<OrderedListOutlined style={{ fontSize: 13 }} />}
          style={btnStyle}
          onClick={() => insertList(true)}
        />
      </Tooltip>
      <Divider type="vertical" style={{ margin: "0 2px", height: 20 }} />
      <Tooltip title="Horizontal Rule">
        <Button
          size="small"
          type="text"
          icon={<LineOutlined style={{ fontSize: 13 }} />}
          style={btnStyle}
          onClick={() => insertAtCursor("\n───────────────────\n")}
        />
      </Tooltip>
      <Tooltip title="Link [text](url)">
        <Button
          size="small"
          type="text"
          icon={<LinkOutlined style={{ fontSize: 13 }} />}
          style={btnStyle}
          onClick={() => wrap("[", "](https://)")}
        />
      </Tooltip>
    </div>
  );
};

// ─── Body Editor (Form-compatible) ────────────────────────────────────────────
const BodyEditorField = ({ value, onChange, bodyRef }) => {
  const localRef = useRef(null);
  const ref = bodyRef || localRef;
  return (
    <div>
      <FormattingToolbar textAreaRef={ref} value={value} onChange={onChange} />
      <TextArea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        placeholder={
          "Write the announcement content here…\n\nUse the toolbar above to add formatting like **bold**, *italic*, lists, and more."
        }
        maxLength={5000}
        showCount
        style={{ fontSize: 12, borderRadius: "0 0 6px 6px", borderTop: "none" }}
      />
    </div>
  );
};

// ─── Recipient Selector ───────────────────────────────────────────────────────
const RecipientSelector = ({
  targetMode,
  onTargetModeChange,
  targetValues,
  onTargetValuesChange,
}) => {
  const [divisions, setDivisions] = useState([]);
  const [sections, setSections] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    const fetchOptions = async () => {
      setLoadingOptions(true);
      try {
        const res = await axiosInstance.get(
          "/announcements/recipients-options",
        );
        setDivisions(res.data?.divisions || []);
        setSections(res.data?.sections || []);
      } catch {
        /* silent */
      }
      setLoadingOptions(false);
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    if (targetMode === "specific" && employees.length === 0) {
      axiosInstance
        .get("/announcements/employees-emails")
        .then((res) => setEmployees(res.data?.data || []))
        .catch(() => {});
    }
  }, [targetMode]);

  return (
    <div
      style={{
        background: "#fafafa",
        border: "1px solid #f0f0f0",
        borderRadius: 6,
        padding: "12px 16px",
        marginTop: 4,
      }}
    >
      <Text strong style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
        <TeamOutlined style={{ marginRight: 6 }} />
        Send To
      </Text>
      <Radio.Group
        value={targetMode}
        onChange={(e) => {
          onTargetModeChange(e.target.value);
          onTargetValuesChange([]);
        }}
        size="small"
        style={{ marginBottom: targetMode !== "all" ? 10 : 0 }}
      >
        <Radio.Button value="all">All Employees</Radio.Button>
        <Radio.Button value="division">By Division</Radio.Button>
        <Radio.Button value="section">By Section</Radio.Button>
        <Radio.Button value="specific">Specific</Radio.Button>
      </Radio.Group>

      {targetMode === "division" && (
        <Select
          mode="multiple"
          placeholder="Select divisions…"
          value={targetValues}
          onChange={onTargetValuesChange}
          loading={loadingOptions}
          style={{ width: "100%" }}
          size="small"
          maxTagCount={3}
          options={divisions.map((d) => ({ value: d, label: d }))}
          allowClear
        />
      )}

      {targetMode === "section" && (
        <Select
          mode="multiple"
          placeholder="Select sections / units…"
          value={targetValues}
          onChange={onTargetValuesChange}
          loading={loadingOptions}
          style={{ width: "100%" }}
          size="small"
          maxTagCount={3}
          options={sections.map((s) => ({ value: s, label: s }))}
          allowClear
        />
      )}

      {targetMode === "specific" && (
        <Select
          mode="multiple"
          placeholder="Search and select employees…"
          value={targetValues}
          onChange={onTargetValuesChange}
          style={{ width: "100%" }}
          size="small"
          maxTagCount={3}
          showSearch
          optionFilterProp="label"
          options={employees.map((emp) => ({
            value: emp.empId,
            label: `${emp.name}${emp.division ? ` — ${emp.division}` : ""}`,
          }))}
          allowClear
        />
      )}
    </div>
  );
};

// ─── Recipient List Modal ─────────────────────────────────────────────────────
const RecipientListModal = ({ record, open, onClose, onReconstructed }) => {
  const [emails, setEmails] = useState([]);
  const [reconstructing, setReconstructing] = useState(false);

  useEffect(() => {
    if (!record) {
      setEmails([]);
      return;
    }
    const list = record.emailRecipients || [];
    if (list.length > 0) {
      setEmails(list);
    } else if (record.emailSent && open) {
      // Auto-reconstruct for announcements sent before tracking was added
      setReconstructing(true);
      axiosInstance
        .patch(`/announcements/${record._id}/reconstruct-recipients`)
        .then((res) => {
          const rebuilt = res.data?.data || [];
          setEmails(rebuilt);
          if (onReconstructed) onReconstructed();
        })
        .catch(() => setEmails([]))
        .finally(() => setReconstructing(false));
    } else {
      setEmails([]);
    }
  }, [record?._id, open]);

  if (!record) return null;

  return (
    <Modal
      title={
        <Space>
          <MailOutlined />
          <span style={{ fontWeight: 600 }}>Recipients — {record.title}</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        emails.length > 0 && (
          <Button
            key="copy"
            icon={<CopyOutlined />}
            size="small"
            onClick={() => navigator.clipboard.writeText(emails.join(", "))}
          >
            Copy All
          </Button>
        ),
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
      ].filter(Boolean)}
      width={520}
    >
      <div style={{ marginBottom: 12 }}>
        <Space size={8} wrap>
          <Tag color="green">
            <CheckCircleOutlined />{" "}
            {record.emailRecipientCount || emails.length} delivered
          </Tag>
          {record.emailTargetMode && record.emailTargetMode !== "all" && (
            <Tag color="blue">
              Target:{" "}
              {TARGET_MODE_LABELS[record.emailTargetMode] ||
                record.emailTargetMode}
              {record.emailTargetValues?.length
                ? ` (${record.emailTargetValues.join(", ")})`
                : ""}
            </Tag>
          )}
          {record.emailSentAt && (
            <Tag>
              <ClockCircleOutlined />{" "}
              {dayjs(record.emailSentAt).format("MMM D, YYYY h:mm A")}
            </Tag>
          )}
        </Space>
      </div>
      {reconstructing ? (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Reconstructing recipient list…
          </Text>
        </div>
      ) : emails.length > 0 ? (
        <div
          style={{
            maxHeight: 360,
            overflow: "auto",
            border: "1px solid #f0f0f0",
            borderRadius: 6,
          }}
        >
          <List
            size="small"
            dataSource={emails}
            renderItem={(email, idx) => (
              <List.Item
                style={{
                  padding: "6px 12px",
                  background: idx % 2 === 0 ? "#fff" : "#fafafa",
                }}
              >
                <Space>
                  <MailOutlined style={{ color: "#8c8c8c", fontSize: 12 }} />
                  <Text style={{ fontSize: 12 }}>{email}</Text>
                </Space>
              </List.Item>
            )}
          />
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Text type="secondary" style={{ fontSize: 12 }}>
              No recipient details could be found for this announcement.
            </Text>
          }
        />
      )}
    </Modal>
  );
};

const AnnouncementManager = () => {
  const { withLoading } = useLoading();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [previewRecord, setPreviewRecord] = useState(null);
  const [recipientRecord, setRecipientRecord] = useState(null);
  const [filter, setFilter] = useState("all");
  const [form] = Form.useForm();
  const bodyRef = useRef(null);

  // Send-email modal state
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendRecord, setSendRecord] = useState(null);
  const [sendTargetMode, setSendTargetMode] = useState("all");
  const [sendTargetValues, setSendTargetValues] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/announcements");
      setData((res.data?.data || []).map((d) => ({ ...d, key: d._id })));
    } catch {
      swalError("Failed to load announcements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const active = data.filter((d) => d.active).length;
    const emailed = data.filter((d) => d.emailSent).length;
    const scheduled = data.filter(
      (d) => d.publishAt && dayjs(d.publishAt).isAfter(dayjs()),
    ).length;
    const critical = data.filter(
      (d) => d.priority === "critical" || d.priority === "high",
    ).length;
    return { total: data.length, active, emailed, scheduled, critical };
  }, [data]);

  const filteredData = useMemo(() => {
    if (filter === "all") return data;
    if (filter === "active") return data.filter((d) => d.active);
    if (filter === "inactive") return data.filter((d) => !d.active);
    if (filter === "emailed") return data.filter((d) => d.emailSent);
    return data;
  }, [data, filter]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      type: "announcement",
      priority: "normal",
      showPopup: true,
      publishPlace: "popup",
      active: true,
    });
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      publishPlace: record.publishPlace || "popup",
      publishAt: record.publishAt ? dayjs(record.publishAt) : null,
      expiresAt: record.expiresAt ? dayjs(record.expiresAt) : null,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        publishAt: values.publishAt ? values.publishAt.toISOString() : null,
        expiresAt: values.expiresAt ? values.expiresAt.toISOString() : null,
      };
      if (editing) {
        await axiosInstance.put(`/announcements/${editing._id}`, payload);
        swalSuccess("Announcement updated");
      } else {
        await axiosInstance.post("/announcements", payload);
        swalSuccess("Announcement created");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      swalError(err?.response?.data?.message || "Save failed");
    }
  };

  const handleDelete = async (id) => {
    try {
      await axiosInstance.delete(`/announcements/${id}`);
      swalSuccess("Deleted");
      load();
    } catch {
      swalError("Delete failed");
    }
  };

  const openSendModal = (record) => {
    setSendRecord(record);
    setSendTargetMode("all");
    setSendTargetValues([]);
    setSendModalOpen(true);
  };

  const handleConfirmSend = async () => {
    if (!sendRecord) return;
    setSendModalOpen(false);
    await withLoading(async ({ updateProgress }) => {
      try {
        updateProgress(20, "Sending announcement emails…");
        const res = await axiosInstance.post(
          `/announcements/${sendRecord._id}/send-email`,
          {
            targetMode: sendTargetMode,
            targetValues: sendTargetValues,
          },
        );
        updateProgress(100);
        swalSuccess(res.data?.message || "Emails dispatched successfully.");
        load();
      } catch (err) {
        swalError(err?.response?.data?.message || err.message);
      }
    }, "Sending announcement emails…");
  };

  // ─── Table columns ───────────────────────────────────────────────────────────
  const columns = [
    {
      title: "Announcement",
      dataIndex: "title",
      key: "title",
      ellipsis: true,
      width: 260,
      render: (text, record) => (
        <div style={{ lineHeight: 1.4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#141414" }}>
              {text}
            </span>
            {!record.active && (
              <Tag
                style={{
                  fontSize: 10,
                  lineHeight: "16px",
                  padding: "0 4px",
                  marginLeft: 2,
                }}
              >
                Inactive
              </Tag>
            )}
          </div>
          {record.body && (
            <Text
              type="secondary"
              style={{ fontSize: 11, display: "block", marginTop: 2 }}
              ellipsis={{ tooltip: record.body }}
            >
              {record.body.length > 80
                ? record.body.slice(0, 80) + "…"
                : record.body}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 140,
      filters: TYPE_OPTIONS.map((o) => ({ text: o.label, value: o.value })),
      onFilter: (value, record) => record.type === value,
      render: (t) => (
        <Tag
          icon={TYPE_ICONS[t]}
          color={TYPE_COLORS[t] || "default"}
          style={{ fontSize: 11, padding: "0 6px", lineHeight: "20px" }}
        >
          {TYPE_OPTIONS.find((o) => o.value === t)?.label || t}
        </Tag>
      ),
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      width: 100,
      filters: PRIORITY_OPTIONS.map((o) => ({ text: o.label, value: o.value })),
      onFilter: (value, record) => record.priority === value,
      sorter: (a, b) => {
        const order = { critical: 4, high: 3, normal: 2, low: 1 };
        return (order[a.priority] || 0) - (order[b.priority] || 0);
      },
      render: (p) => (
        <Badge
          status={PRIORITY_COLORS[p] || "default"}
          text={
            <span style={{ fontSize: 12 }}>
              {p?.charAt(0).toUpperCase() + p?.slice(1)}
            </span>
          }
        />
      ),
    },
    {
      title: "Visibility",
      key: "visibility",
      width: 110,
      align: "center",
      render: (_, r) => {
        const place = r.publishPlace || "popup";
        const placeLabel = PUBLISH_PLACE_OPTIONS.find((o) => o.value === place)?.label || place;
        return (
          <Space size={4} wrap>
            <Tooltip title={`Publish: ${placeLabel}`}>
              <Tag
                color={PUBLISH_PLACE_COLORS[place] || "blue"}
                style={{
                  fontSize: 10,
                  padding: "0 4px",
                  lineHeight: "18px",
                  margin: 0,
                }}
              >
                <EyeOutlined /> {place === "both" ? "Pop-up & Login" : place === "login" ? "Login" : "Pop-up"}
              </Tag>
            </Tooltip>
            {r.emailSent && (
              <Tooltip title="Click to view recipient emails">
                <Tag
                  color="green"
                  style={{
                    fontSize: 10,
                    padding: "0 4px",
                    lineHeight: "18px",
                    margin: 0,
                    cursor: "pointer",
                  }}
                  onClick={() => setRecipientRecord(r)}
                >
                  <MailOutlined /> {r.emailRecipientCount}
                </Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: "Schedule",
      key: "schedule",
      width: 150,
      render: (_, r) => {
        const isScheduled = r.publishAt && dayjs(r.publishAt).isAfter(dayjs());
        const isExpired = r.expiresAt && dayjs(r.expiresAt).isBefore(dayjs());
        return (
          <div style={{ lineHeight: 1.5 }}>
            {isScheduled ? (
              <Tooltip
                title={`Publishes ${dayjs(r.publishAt).format("MMM D, YYYY h:mm A")}`}
              >
                <Tag
                  icon={<ClockCircleOutlined />}
                  color="gold"
                  style={{ fontSize: 10, padding: "0 5px", lineHeight: "18px" }}
                >
                  Scheduled {dayjs(r.publishAt).format("MMM D")}
                </Tag>
              </Tooltip>
            ) : (
              <Text style={{ fontSize: 11 }}>
                <CheckCircleOutlined
                  style={{ color: "#52c41a", marginRight: 4, fontSize: 10 }}
                />
                {dayjs(r.createdAt).format("MMM D, YYYY")}
              </Text>
            )}
            {r.expiresAt && (
              <div style={{ marginTop: 2 }}>
                <Text
                  type={isExpired ? "danger" : "secondary"}
                  style={{ fontSize: 10 }}
                >
                  {isExpired ? "Expired" : "Expires"}{" "}
                  {dayjs(r.expiresAt).format("MMM D, YYYY")}
                </Text>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Actions",
      key: "action",
      width: 140,
      fixed: "right",
      align: "center",
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Preview">
            <Button
              size="small"
              type="text"
              icon={<EyeOutlined style={{ fontSize: 13 }} />}
              onClick={() => setPreviewRecord(record)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              size="small"
              type="text"
              icon={<EditOutlined style={{ fontSize: 13 }} />}
              onClick={() => openEdit(record)}
            />
          </Tooltip>
          <Tooltip title="Send via Email">
            <Button
              size="small"
              type="text"
              icon={<SendOutlined style={{ fontSize: 13, color: "#1677ff" }} />}
              onClick={() => openSendModal(record)}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined style={{ fontSize: 13 }} />}
              onClick={async () => {
                const result = await swalConfirm({
                  title: "Permanently delete this announcement?",
                  text: "This action cannot be undone.",
                  confirmText: "Delete",
                  dangerMode: true,
                });
                if (result.isConfirmed) handleDelete(record._id);
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <Card
      title={
        <Space direction="vertical" size={2} style={{ width: "100%" }}>
          <Typography.Title
            level={4}
            style={{ margin: 0, fontSize: 18, fontWeight: 600 }}
          >
            <BellOutlined style={{ marginRight: 8, color: "#1677ff" }} />
            Announcement Manager
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Create, schedule, and broadcast announcements and updates to all
            users via in-app pop-ups and email.
          </Typography.Text>
        </Space>
      }
      extra={
        <Space size={8}>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={load}
            loading={loading}
          />
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={openCreate}
          >
            New Announcement
          </Button>
        </Space>
      }
    >
      {/* Summary stats */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={12} sm={6} md={4}>
          <div
            style={{
              background: "#f5f5f5",
              borderRadius: 6,
              padding: "8px 12px",
              textAlign: "center",
            }}
          >
            <Text type="secondary" style={{ fontSize: 10, display: "block" }}>
              Total
            </Text>
            <Text strong style={{ fontSize: 18 }}>
              {stats.total}
            </Text>
          </div>
        </Col>
        <Col xs={12} sm={6} md={4}>
          <div
            style={{
              background: "#f6ffed",
              borderRadius: 6,
              padding: "8px 12px",
              textAlign: "center",
            }}
          >
            <Text type="secondary" style={{ fontSize: 10, display: "block" }}>
              Active
            </Text>
            <Text strong style={{ fontSize: 18, color: "#52c41a" }}>
              {stats.active}
            </Text>
          </div>
        </Col>
        <Col xs={12} sm={6} md={4}>
          <div
            style={{
              background: "#e6f4ff",
              borderRadius: 6,
              padding: "8px 12px",
              textAlign: "center",
            }}
          >
            <Text type="secondary" style={{ fontSize: 10, display: "block" }}>
              Emailed
            </Text>
            <Text strong style={{ fontSize: 18, color: "#1677ff" }}>
              {stats.emailed}
            </Text>
          </div>
        </Col>
        <Col xs={12} sm={6} md={4}>
          <div
            style={{
              background: "#fffbe6",
              borderRadius: 6,
              padding: "8px 12px",
              textAlign: "center",
            }}
          >
            <Text type="secondary" style={{ fontSize: 10, display: "block" }}>
              Scheduled
            </Text>
            <Text strong style={{ fontSize: 18, color: "#faad14" }}>
              {stats.scheduled}
            </Text>
          </div>
        </Col>
        {stats.critical > 0 && (
          <Col xs={12} sm={6} md={4}>
            <div
              style={{
                background: "#fff2f0",
                borderRadius: 6,
                padding: "8px 12px",
                textAlign: "center",
              }}
            >
              <Text type="secondary" style={{ fontSize: 10, display: "block" }}>
                High / Critical
              </Text>
              <Text strong style={{ fontSize: 18, color: "#ff4d4f" }}>
                {stats.critical}
              </Text>
            </div>
          </Col>
        )}
      </Row>

      {/* Filter toolbar */}
      <div
        className="corp-toolbar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Segmented
          size="small"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
            { value: "emailed", label: "Emailed" },
          ]}
        />
        <Tag style={{ fontSize: 11 }}>
          Showing {filteredData.length} of {data.length}
        </Tag>
      </div>

      <Table
        columns={columns}
        dataSource={filteredData}
        loading={loading}
        size="small"
        className="compact-table"
        rowKey="_id"
        scroll={{ x: 900 }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: [5, 10, 20, 50],
          showTotal: (total, range) => (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {range[0]}-{range[1]} of {total}
            </Text>
          ),
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span style={{ fontSize: 12, color: "#999" }}>
                  No announcements yet. Click{" "}
                  <strong>"New Announcement"</strong> to create one.
                </span>
              }
            />
          ),
        }}
      />

      {/* ── Create / Edit Modal ──────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            {editing ? <EditOutlined /> : <PlusOutlined />}
            <span style={{ fontWeight: 600 }}>
              {editing ? "Edit Announcement" : "New Announcement"}
            </span>
          </Space>
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText={editing ? "Update" : "Create"}
        width={680}
        destroyOnHidden
        styles={{ body: { paddingTop: 12, paddingBottom: 12 } }}
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: "Title is required" }]}
          >
            <Input
              placeholder="e.g. System Maintenance on Feb 15"
              maxLength={200}
              showCount
              style={{ fontSize: 13 }}
            />
          </Form.Item>

          <Form.Item
            name="body"
            label={
              <span>
                Content / Message{" "}
                <Text
                  type="secondary"
                  style={{ fontSize: 11, fontWeight: 400 }}
                >
                  — use the toolbar to format
                </Text>
              </span>
            }
            rules={[{ required: true, message: "Content is required" }]}
          >
            <BodyEditorField bodyRef={bodyRef} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="type" label="Type" style={{ marginBottom: 12 }}>
                <Select options={TYPE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="priority"
                label="Priority"
                style={{ marginBottom: 12 }}
              >
                <Select options={PRIORITY_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="publishAt"
                label="Publish At"
                style={{ marginBottom: 12 }}
              >
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  placeholder="Immediately"
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="expiresAt"
                label="Expires At"
                style={{ marginBottom: 12 }}
              >
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  placeholder="Never"
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: "8px 0 12px" }} />

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="publishPlace"
                label="Publish Place"
                tooltip="Choose where this announcement appears: in-app pop-up after login, on the login page itself, or both."
                style={{ marginBottom: 12 }}
              >
                <Select options={PUBLISH_PLACE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="active"
                label="Status"
                valuePropName="checked"
                style={{ marginBottom: 12 }}
              >
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ── Send Email Modal ─────────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <SendOutlined style={{ color: "#1677ff" }} />
            <span style={{ fontWeight: 600 }}>Send Email Blast</span>
          </Space>
        }
        open={sendModalOpen}
        onCancel={() => setSendModalOpen(false)}
        onOk={handleConfirmSend}
        okText="Send Now"
        okType="primary"
        okButtonProps={{
          disabled: sendTargetMode !== "all" && sendTargetValues.length === 0,
        }}
        width={560}
        destroyOnHidden
      >
        {sendRecord && (
          <div>
            <div
              style={{
                background: "#f6f6f6",
                borderRadius: 6,
                padding: "10px 14px",
                marginBottom: 16,
              }}
            >
              <Text strong style={{ fontSize: 13 }}>
                {sendRecord.title}
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 11 }}>
                {sendRecord.body?.length > 120
                  ? sendRecord.body.slice(0, 120) + "…"
                  : sendRecord.body}
              </Text>
            </div>
            {sendRecord.emailSent && (
              <div
                style={{
                  background: "#fffbe6",
                  border: "1px solid #ffe58f",
                  borderRadius: 6,
                  padding: "8px 12px",
                  marginBottom: 16,
                  fontSize: 12,
                }}
              >
                <WarningOutlined style={{ color: "#faad14", marginRight: 6 }} />
                Previously sent on{" "}
                <strong>
                  {dayjs(sendRecord.emailSentAt).format("MMM D, YYYY h:mm A")}
                </strong>{" "}
                to <strong>{sendRecord.emailRecipientCount}</strong> recipients.
                Sending again may result in duplicate emails.
              </div>
            )}
            <RecipientSelector
              targetMode={sendTargetMode}
              onTargetModeChange={setSendTargetMode}
              targetValues={sendTargetValues}
              onTargetValuesChange={setSendTargetValues}
            />
          </div>
        )}
      </Modal>

      {/* ── Recipient List Modal ─────────────────────────────────────────── */}
      <RecipientListModal
        record={recipientRecord}
        open={!!recipientRecord}
        onClose={() => setRecipientRecord(null)}
        onReconstructed={load}
      />

      {/* ── Preview Modal ────────────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <EyeOutlined />
            <span style={{ fontWeight: 600 }}>Announcement Preview</span>
          </Space>
        }
        open={!!previewRecord}
        onCancel={() => setPreviewRecord(null)}
        footer={[
          <Button key="close" onClick={() => setPreviewRecord(null)}>
            Close
          </Button>,
          <Button
            key="edit"
            type="primary"
            icon={<EditOutlined />}
            onClick={() => {
              const r = previewRecord;
              setPreviewRecord(null);
              openEdit(r);
            }}
          >
            Edit
          </Button>,
        ]}
        width={560}
      >
        {previewRecord && (
          <div>
            <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Type">
                <Tag
                  icon={TYPE_ICONS[previewRecord.type]}
                  color={TYPE_COLORS[previewRecord.type] || "default"}
                  style={{ fontSize: 11 }}
                >
                  {TYPE_OPTIONS.find((o) => o.value === previewRecord.type)
                    ?.label || previewRecord.type}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Priority">
                <Badge
                  status={PRIORITY_COLORS[previewRecord.priority] || "default"}
                  text={
                    previewRecord.priority?.charAt(0).toUpperCase() +
                    previewRecord.priority?.slice(1)
                  }
                />
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={previewRecord.active ? "green" : "default"}>
                  {previewRecord.active ? "Active" : "Inactive"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Pop-up">
                {previewRecord.publishPlace === "popup" || previewRecord.publishPlace === "both" ? (
                  <Tag color="blue">Enabled</Tag>
                ) : (
                  <Tag>Disabled</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Publish Place">
                <Tag color={PUBLISH_PLACE_COLORS[previewRecord.publishPlace || "popup"]}>
                  {PUBLISH_PLACE_OPTIONS.find((o) => o.value === (previewRecord.publishPlace || "popup"))?.label || "Pop-up"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {dayjs(previewRecord.createdAt).format("MMM D, YYYY h:mm A")}
              </Descriptions.Item>
              {previewRecord.emailSent && (
                <Descriptions.Item label="Emailed">
                  <Tag
                    color="green"
                    style={{ fontSize: 10, cursor: "pointer" }}
                    onClick={() => {
                      setPreviewRecord(null);
                      setRecipientRecord(previewRecord);
                    }}
                  >
                    {dayjs(previewRecord.emailSentAt).format("MMM D, YYYY")} —{" "}
                    {previewRecord.emailRecipientCount} recipients ›
                  </Tag>
                </Descriptions.Item>
              )}
            </Descriptions>

            <div
              style={{
                background: "#fafafa",
                border: "1px solid #f0f0f0",
                borderRadius: 8,
                padding: "16px 20px",
              }}
            >
              <Typography.Title
                level={5}
                style={{ marginTop: 0, marginBottom: 8 }}
              >
                {previewRecord.title}
              </Typography.Title>
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.7,
                  color: "#333",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {previewRecord.body}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
};

export default AnnouncementManager;

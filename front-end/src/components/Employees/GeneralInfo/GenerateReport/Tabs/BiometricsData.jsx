import React, { useState, useEffect, useMemo, useCallback } from "react";
import useDemoMode from "../../../../../hooks/useDemoMode";
import useAuth from "../../../../../hooks/useAuth";
import { swalSuccess, swalError, swalWarning, swalConfirm } from "../../../../../utils/swalHelper";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  Tag,
  Space,
  Typography,
  Alert,
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import axiosInstance from "../../../../../api/axiosInstance";
import dayjs from "dayjs";

const { Option } = Select;
const { Text } = Typography;
const { RangePicker } = DatePicker;

const STATE_OPTIONS = [
  { value: "C/In", label: "Time In" },
  { value: "C/Out", label: "Time Out" },
  { value: "Out", label: "Break Out" },
  { value: "Out Back", label: "Break In" },
  { value: "Overtime In", label: "Overtime In" },
  { value: "Overtime Out", label: "Overtime Out" },
];

const stateColor = (s) => {
  switch (s) {
    case "C/In": return "green";
    case "C/Out": return "red";
    case "Out": return "orange";
    case "Out Back": return "blue";
    case "Overtime In": return "cyan";
    case "Overtime Out": return "purple";
    default: return "default";
  }
};

const BiometricsData = ({ employee }) => {
  const [dtrLogs, setDtrLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [identifierUsed, setIdentifierUsed] = useState(null);
  const [form] = Form.useForm();
  const { user } = useAuth();

  // ── Filters ────────────────────────────────────────────────────────
  const [searchText, setSearchText] = useState("");
  const [dateRange, setDateRange] = useState(null);
  const [stateFilter, setStateFilter] = useState([]);

  const { isDemoActive, isDemoUser, allowSubmissions, isPrivileged } =
    useDemoMode();
  const demoReadOnly =
    isDemoActive && isDemoUser && !allowSubmissions && !isPrivileged;
  const demoDisabled = isDemoActive && isDemoUser && !isPrivileged;

  // Permission check: developer or canManipulateBiometrics
  const canEdit =
    !demoDisabled &&
    (user?.userType === "developer" || user?.canManipulateBiometrics === true);
  const hideActions = demoReadOnly || !canEdit;

  const robustFetchDtrLogs = useCallback(async () => {
    if (!employee) return;
    setLoading(true);
    try {
      const digitsEmpId = employee.empId
        ? employee.empId.replace(/\D/g, "").replace(/^0+/, "")
        : undefined;
      const attempts = [
        { label: "normalizedEmpId", value: employee.normalizedEmpId },
        { label: "digitsEmpId", value: digitsEmpId },
        { label: "empNo", value: employee.empNo },
        { label: "empIdRaw", value: employee.empId },
      ].filter(
        (a, idx, arr) =>
          a.value && arr.findIndex((b) => b.value === a.value) === idx
      );

      // Helper: fetch ALL pages for a given acNo value (server caps at 500/page)
      const fetchAllPages = async (acNoVal) => {
        const PAGE_SIZE = 500;
        let page = 1;
        let allLogs = [];
        let hasMore = true;
        while (hasMore) {
          const resp = await axiosInstance.get(
            `/dtrlogs/merged?acNo=${acNoVal}&limit=${PAGE_SIZE}&page=${page}`
          );
          const logs = resp?.data?.data || [];
          const total = resp?.data?.total ?? logs.length;
          allLogs = allLogs.concat(logs);
          hasMore = allLogs.length < total && logs.length === PAGE_SIZE;
          page++;
        }
        return allLogs;
      };

      let found = false;
      let lastLogs = [];
      for (const attempt of attempts) {
        try {
          const logs = await fetchAllPages(attempt.value);
          if (logs.length > 0) {
            const sorted = [...logs].sort(
              (a, b) => dayjs(a?.time).valueOf() - dayjs(b?.time).valueOf()
            );
            setDtrLogs(sorted);
            setIdentifierUsed(attempt.label);
            found = true;
            break;
          }
          lastLogs = logs;
        } catch (err) {
          console.warn(`Attempt ${attempt.label} failed`, err);
        }
      }
      if (!found) {
        const sorted = [...(lastLogs || [])].sort(
          (a, b) => dayjs(a?.time).valueOf() - dayjs(b?.time).valueOf()
        );
        setDtrLogs(sorted);
        setIdentifierUsed(attempts.length ? "none-found" : "no-attempts");
      }
    } catch (error) {
      swalError("Failed to fetch DTR logs.");
      console.error("Error fetching DTR logs:", error);
    } finally {
      setLoading(false);
    }
  }, [employee]);

  useEffect(() => {
    robustFetchDtrLogs();
  }, [robustFetchDtrLogs]);

  // ── Filtered data ──────────────────────────────────────────────────
  const filteredLogs = useMemo(() => {
    let data = [...dtrLogs];

    // Date range filter
    if (dateRange && dateRange[0] && dateRange[1]) {
      const start = dateRange[0].startOf("day");
      const end = dateRange[1].endOf("day");
      data = data.filter((r) => {
        const t = dayjs(r.time);
        return t.isValid() && (t.isSame(start) || t.isAfter(start)) && (t.isSame(end) || t.isBefore(end));
      });
    }

    // State filter
    if (stateFilter.length > 0) {
      data = data.filter((r) => stateFilter.includes(r.state));
    }

    // Text search (AC-No or Name)
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      data = data.filter(
        (r) =>
          (r.acNo || "").toLowerCase().includes(q) ||
          (r.name || "").toLowerCase().includes(q)
      );
    }

    return data;
  }, [dtrLogs, dateRange, stateFilter, searchText]);

  // ── Stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = dtrLogs.length;
    const filtered = filteredLogs.length;
    const timeIns = filteredLogs.filter((r) => r.state === "C/In").length;
    const timeOuts = filteredLogs.filter((r) => r.state === "C/Out").length;
    return { total, filtered, timeIns, timeOuts };
  }, [dtrLogs, filteredLogs]);

  // ── Columns ────────────────────────────────────────────────────────
  const columns = useMemo(() => {
    const cols = [
      {
        title: "AC-No",
        dataIndex: "acNo",
        key: "acNo",
        width: 80,
        ellipsis: true,
      },
      {
        title: "Name",
        dataIndex: "name",
        key: "name",
        width: 160,
        ellipsis: true,
      },
      {
        title: "Date",
        dataIndex: "time",
        key: "date",
        width: 110,
        sorter: (a, b) => dayjs(a?.time).valueOf() - dayjs(b?.time).valueOf(),
        defaultSortOrder: "descend",
        render: (text) => {
          const dt = dayjs(text);
          return dt.isValid() ? dt.format("MMM DD, YYYY") : "-";
        },
      },
      {
        title: "Time",
        dataIndex: "time",
        key: "time",
        width: 90,
        render: (text) => {
          const dt = dayjs(text);
          return dt.isValid() ? dt.format("hh:mm:ss A") : "-";
        },
      },
      {
        title: "State",
        dataIndex: "state",
        key: "state",
        width: 110,
        render: (s) => <Tag color={stateColor(s)}>{s || "-"}</Tag>,
      },
      {
        title: "New State",
        dataIndex: "newState",
        key: "newState",
        width: 110,
        render: (s) => s ? <Tag>{s}</Tag> : <Text type="secondary">—</Text>,
      },
    ];

    if (!hideActions) {
      cols.push({
        title: "Action",
        key: "action",
        width: 120,
        fixed: "right",
        render: (_, record) => (
          <Space size={4}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={async () => {
                const result = await swalConfirm({
                  title: "Delete this record?",
                  text: "This action cannot be undone.",
                  confirmText: "Delete",
                  dangerMode: true,
                });
                if (result.isConfirmed) {
                  handleDelete(record._id);
                }
              }}
            />
          </Space>
        ),
      });
    }

    return cols;
  }, [hideActions]);

  // ── Handlers ───────────────────────────────────────────────────────
  const handleAdd = () => {
    if (!canEdit) {
      swalWarning("You don't have permission to add biometrics records.");
      return;
    }
    setEditingLog(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record) => {
    if (!canEdit) {
      swalWarning("You don't have permission to edit biometrics records.");
      return;
    }
    setEditingLog(record);
    form.setFieldsValue({
      ...record,
      Time: dayjs(record.time),
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (id) => {
    if (!canEdit) {
      swalWarning("You don't have permission to delete biometrics records.");
      return;
    }
    try {
      await axiosInstance.delete(`/dtrlogs/${id}`);
      swalSuccess("Record deleted.");
      robustFetchDtrLogs();
    } catch (error) {
      swalError("Failed to delete record.");
      console.error("Error deleting DTR log:", error);
    }
  };

  const handleModalOk = async () => {
    if (!canEdit) return;
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        Time: values.Time.toISOString(),
        "AC-No": employee.empId.replace(/\D/g, "").replace(/^0+/, ""),
        Name: employee.name,
      };

      if (editingLog) {
        await axiosInstance.put(`/dtrlogs/${editingLog._id}`, payload);
        swalSuccess("Record updated.");
      } else {
        await axiosInstance.post("/dtrlogs", payload);
        swalSuccess("Record added.");
      }
      setIsModalVisible(false);
      robustFetchDtrLogs();
    } catch (error) {
      swalError("Failed to save record.");
      console.error("Error saving DTR log:", error);
    }
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
    setEditingLog(null);
    form.resetFields();
  };

  const clearFilters = () => {
    setSearchText("");
    setDateRange(null);
    setStateFilter([]);
  };

  const hasActiveFilters = searchText || dateRange || stateFilter.length > 0;

  return (
    <div className="biometrics-table-wrapper">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <Space size={8} wrap>
          {!hideActions && (
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              Add Record
            </Button>
          )}
          <Button size="small" icon={<ReloadOutlined />} onClick={robustFetchDtrLogs} loading={loading}>
            Refresh
          </Button>
          {identifierUsed && (
            <Tag
              color={identifierUsed === "none-found" ? "red" : "blue"}
              style={{ fontSize: 11, lineHeight: "18px", height: 20 }}
            >
              Source: {identifierUsed}
            </Tag>
          )}
        </Space>
        <Space size={6}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {stats.filtered === stats.total
              ? `${stats.total} records`
              : `${stats.filtered} of ${stats.total} records`}
          </Text>
          {stats.filtered > 0 && (
            <>
              <Tag color="green" style={{ fontSize: 11 }}>In: {stats.timeIns}</Tag>
              <Tag color="red" style={{ fontSize: 11 }}>Out: {stats.timeOuts}</Tag>
            </>
          )}
        </Space>
      </div>

      {/* ── Filters ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <Input
          size="small"
          placeholder="Search AC-No or Name"
          prefix={<SearchOutlined style={{ color: "var(--app-text-muted, #bfbfbf)" }} />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ width: 180 }}
        />
        <RangePicker
          size="small"
          value={dateRange}
          onChange={setDateRange}
          style={{ width: 240 }}
          placeholder={["Start Date", "End Date"]}
        />
        <Select
          size="small"
          mode="multiple"
          placeholder="Filter State"
          value={stateFilter}
          onChange={setStateFilter}
          options={STATE_OPTIONS}
          style={{ minWidth: 160 }}
          allowClear
          maxTagCount={2}
        />
        {hasActiveFilters && (
          <Button size="small" type="text" icon={<FilterOutlined />} onClick={clearFilters}>
            Clear
          </Button>
        )}
      </div>

      {/* ── Permission notice ───────────────────────────────────── */}
      {!canEdit && !demoReadOnly && (
        <Alert
          type="info"
          showIcon
          message="View-only mode. Edit and delete require Developer access or Manipulate Biometrics permission."
          style={{ marginBottom: 12, fontSize: 12 }}
          banner
        />
      )}

      {/* ── Table ───────────────────────────────────────────────── */}
      <Table
        columns={columns}
        dataSource={filteredLogs}
        loading={loading}
        rowKey={(record) => record._id || `${record.acNo}-${record.time}`}
        pagination={{
          pageSize: 15,
          showSizeChanger: true,
          pageSizeOptions: [10, 15, 25, 50, 100],
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
          size: "small",
        }}
        size="small"
        scroll={{ x: 700 }}
      />

      {/* ── Add / Edit Modal ────────────────────────────────────── */}
      <Modal
        title={editingLog ? "Edit Biometrics Record" : "Add Biometrics Record"}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        okButtonProps={{ disabled: !canEdit }}
        width={480}
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item
            name="Time"
            label="Date & Time"
            rules={[{ required: true, message: "Please select date & time" }]}
          >
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm:ss"
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Form.Item
            name="State"
            label="State"
            rules={[{ required: true, message: "Please select state" }]}
          >
            <Select placeholder="Select a state" options={STATE_OPTIONS} />
          </Form.Item>
          <Form.Item name="New State" label="New State">
            <Input placeholder="Optional" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BiometricsData;

// Scoped style overrides
if (typeof document !== "undefined") {
  const styleId = "biometrics-table-font-reduction";
  const existing = document.getElementById(styleId);
  const css = `
    .biometrics-table-wrapper .ant-table { font-size:12px; }
    .biometrics-table-wrapper .ant-table-cell { font-size:11px; }
    .biometrics-table-wrapper .ant-table-thead > tr > th { font-size:11px; padding:4px 6px; }
    .biometrics-table-wrapper .ant-table-tbody > tr > td { padding:2px 6px; }
    .biometrics-table-wrapper .ant-btn.compact-btn { font-size:10px; height:22px; line-height:20px; padding:0 8px; }
    .biometrics-table-wrapper .ant-tag { display:inline-flex; align-items:center; }
  `;
  if (existing) {
    existing.textContent = css;
  } else {
    const styleEl = document.createElement("style");
    styleEl.id = styleId;
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }
}

import React, { useState, useEffect } from "react";
import useDemoMode from "../../../../../hooks/useDemoMode";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  message,
  Tag,
} from "antd";
import axiosInstance from "../../../../../api/axiosInstance";
import dayjs from "dayjs";

const { Option } = Select;

const BiometricsData = ({ employee }) => {
  const [dtrLogs, setDtrLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [identifierUsed, setIdentifierUsed] = useState(null);
  const [form] = Form.useForm();
  const { isDemoActive, isDemoUser, allowSubmissions, isPrivileged } =
    useDemoMode();
  // Demo read-only only applies to non-privileged demo users
  const demoReadOnly =
    isDemoActive && isDemoUser && !allowSubmissions && !isPrivileged;
  const hideActions = demoReadOnly;
  // Disable actions only for non-privileged demo users
  const demoDisabled = isDemoActive && isDemoUser && !isPrivileged;

  const robustFetchDtrLogs = async () => {
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

      let found = false;
      let lastLogs = [];
      for (const attempt of attempts) {
        try {
          const resp = await axiosInstance.get(
            `/dtrlogs/merged?acNo=${attempt.value}`
          );
          const logs = resp?.data?.data || [];
          if (logs.length > 0) {
            setDtrLogs(logs);
            setIdentifierUsed(attempt.label);
            found = true;
            break;
          }
          lastLogs = logs; // may be empty
        } catch (err) {
          // continue to next attempt
          console.warn(`Attempt ${attempt.label} failed`, err);
        }
      }
      if (!found) {
        setDtrLogs(lastLogs);
        setIdentifierUsed(attempts.length ? "none-found" : "no-attempts");
      }
    } catch (error) {
      message.error("Failed to fetch DTR logs.");
      console.error("Error fetching DTR logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    robustFetchDtrLogs();
  }, [employee]);

  const columns = [
    {
      title: "AC-No",
      dataIndex: "acNo",
      key: "acNo",
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Time",
      dataIndex: "time",
      key: "time",
      render: (text) => dayjs(text).format("YYYY-MM-DD HH:mm:ss"),
    },
    {
      title: "State",
      dataIndex: "state",
      key: "state",
    },
    {
      title: "New State",
      dataIndex: "newState",
      key: "newState",
    },
    !hideActions && {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <>
          <Button
            type="primary"
            size="small"
            className="compact-btn"
            disabled={demoDisabled}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Button
            type="primary"
            size="small"
            className="compact-btn"
            style={{ marginLeft: 5 }}
            danger
            disabled={demoDisabled}
            onClick={() => handleDelete(record._id)}
          >
            Delete
          </Button>
        </>
      ),
    },
  ];
  const filteredColumns = columns.filter(Boolean);

  const handleAdd = () => {
    if (demoDisabled) {
      message.warning("Action disabled in demo mode");
      return;
    }
    setEditingLog(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record) => {
    if (demoDisabled) {
      message.warning("Action disabled in demo mode");
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
    if (demoDisabled) {
      message.warning("Action disabled in demo mode");
      return;
    }
    try {
      await axiosInstance.delete(`/dtrlogs/${id}`);
      message.success("DTR Log deleted successfully.");
      fetchDtrLogs();
    } catch (error) {
      message.error("Failed to delete DTR log.");
      console.error("Error deleting DTR log:", error);
    }
  };

  const handleModalOk = async () => {
    if (demoDisabled) {
      message.warning("Action disabled in demo mode");
      return;
    }
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        Time: values.Time.toISOString(),
        "AC-No": employee.empId.replace(/\D/g, "").replace(/^0+/, ""), // Use employee's AC-No
        Name: employee.name, // Use employee's name
      };

      if (editingLog) {
        await axiosInstance.put(`/dtrlogs/${editingLog._id}`, payload);
        message.success("DTR Log updated successfully.");
      } else {
        await axiosInstance.post("/dtrlogs", payload);
        message.success("DTR Log added successfully.");
      }
      setIsModalVisible(false);
      fetchDtrLogs();
    } catch (error) {
      message.error("Failed to save DTR log.");
      console.error("Error saving DTR log:", error);
    }
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
    setEditingLog(null);
    form.resetFields();
  };

  return (
    <div className="biometrics-table-wrapper">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 12,
          gap: 8,
        }}
      >
        {!hideActions && (
          <Button
            type="primary"
            size="small"
            className="compact-btn"
            onClick={handleAdd}
            disabled={demoDisabled}
          >
            Add Biometrics Record
          </Button>
        )}
        {identifierUsed && (
          <Tag
            color={identifierUsed === "none-found" ? "red" : "blue"}
            style={{ fontSize: 11, lineHeight: "18px", height: 20 }}
          >
            Source: {identifierUsed}
          </Tag>
        )}
      </div>
      <Table
        columns={filteredColumns}
        dataSource={dtrLogs}
        loading={loading}
        rowKey={(record) => `${record.acNo}-${record.time}`}
        pagination={{ pageSize: 10 }}
        size="small"
      />

      <Modal
        title={editingLog ? "Edit Biometrics Record" : "Add Biometrics Record"}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        okButtonProps={{ disabled: demoDisabled }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="Time"
            label="Time"
            rules={[{ required: true, message: "Please select time!" }]}
          >
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm:ss"
              style={{ width: "100%" }}
              disabled={demoDisabled}
            />
          </Form.Item>
          <Form.Item
            name="State"
            label="State"
            rules={[{ required: true, message: "Please select state!" }]}
          >
            <Select placeholder="Select a state" disabled={demoDisabled}>
              <Option value="C/In">Time In</Option>
              <Option value="C/Out">Time Out</Option>
              <Option value="Out">Break Out</Option>
              <Option value="Out Back">Break In</Option>
              <Option value="Overtime In">Overtime In</Option>
              <Option value="Overtime Out">Overtime Out</Option>
            </Select>
          </Form.Item>
          <Form.Item name="New State" label="New State">
            <Input disabled={demoDisabled} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BiometricsData;

// Local style overrides for smaller font
// Using a style tag appended to document head via React fragment pattern is another option;
// here we inject a scoped style block for simplicity without touching global CSS.
if (typeof document !== "undefined") {
  const styleId = "biometrics-table-font-reduction";
  const existing = document.getElementById(styleId);
  const css = `
    .biometrics-table-wrapper .ant-table { font-size:12px; }
    .biometrics-table-wrapper .ant-table-cell { font-size:11px; }
    .biometrics-table-wrapper .ant-table-thead > tr > th { font-size:11px; padding:4px 6px; }
    .biometrics-table-wrapper .ant-table-tbody > tr > td { padding:2px 6px; }
    .biometrics-table-wrapper .ant-btn { font-size:11px; height:26px; line-height:24px; padding:0 10px; }
    .biometrics-table-wrapper .ant-btn.compact-btn { font-size:10px; height:22px; line-height:20px; padding:0 8px; }
    .biometrics-table-wrapper .ant-tag { display:flex; align-items:center; }
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

import React, { useState, useEffect } from "react";
import useDemoMode from "../../../../../hooks/useDemoMode";
import { Table, Button, Modal, Form, Input, DatePicker, Select, message } from "antd";
import axiosInstance from "../../../../../api/axiosInstance";
import dayjs from "dayjs";

const { Option } = Select;

const BiometricsData = ({ employee }) => {
  const [dtrLogs, setDtrLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [form] = Form.useForm();
  const { readOnly, isDemoActive, isDemoUser, allowSubmissions } = useDemoMode();
  // In demo mode with submissions disabled, hide all action UI regardless of user type
  const demoReadOnly = isDemoActive && !allowSubmissions;
  const hideActions = demoReadOnly;
  // Regardless of allowSubmissions, disable actions while in demo mode per request
  const demoDisabled = isDemoActive;

  const fetchDtrLogs = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get(
        `/dtrlogs/merged?acNo=${employee.normalizedEmpId}`
      );
      setDtrLogs(response.data.data);
    } catch (error) {
      message.error("Failed to fetch DTR logs.");
      console.error("Error fetching DTR logs:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (employee?.normalizedEmpId) {
      fetchDtrLogs();
    }
  }, [employee?.normalizedEmpId]);

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
          <Button type="primary" size="small" disabled={demoDisabled} onClick={() => handleEdit(record)}>
            Edit
          </Button>
          <Button type="primary" size="small" style={{marginLeft: "5px"}} danger disabled={demoDisabled} onClick={() => handleDelete(record._id)}>
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
        "AC-No": employee.empId.replace(/\D/g, "").replace(/^0+/, ''), // Use employee's AC-No
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
    <div>
      {!hideActions && (
        <Button type="primary" onClick={handleAdd} style={{ marginBottom: 16 }} disabled={demoDisabled}>
          Add Biometrics Record
        </Button>
      )}
      <Table
        columns={filteredColumns}
        dataSource={dtrLogs}
        loading={loading}
        rowKey={(record) => `${record.acNo}-${record.time}`}
        pagination={{ pageSize: 10 }}
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
            <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" style={{ width: "100%" }} disabled={demoDisabled} />
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
          <Form.Item
            name="New State"
            label="New State"
          >
            <Input disabled={demoDisabled} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BiometricsData;
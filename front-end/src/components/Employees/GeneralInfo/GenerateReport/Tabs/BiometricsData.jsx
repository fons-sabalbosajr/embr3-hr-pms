import React, { useState, useEffect } from "react";
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
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <>
          {/* Edit and Delete are disabled because the /merged endpoint does not provide the _id */}
          <Button type="link" onClick={() => handleEdit(record)}>
            Edit
          </Button>
          <Button type="link" danger onClick={() => handleDelete(record._id)}>
            Delete
          </Button>
        </>
      ),
    },
  ];

  const handleAdd = () => {
    setEditingLog(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingLog(record);
    form.setFieldsValue({
      ...record,
      Time: dayjs(record.time),
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (id) => {
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
      <Button type="primary" onClick={handleAdd} style={{ marginBottom: 16 }}>
        Add Biometrics Record
      </Button>
      <Table
        columns={columns}
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
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="Time"
            label="Time"
            rules={[{ required: true, message: "Please select time!" }]}
          >
            <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="State"
            label="State"
            rules={[{ required: true, message: "Please select state!" }]}
          >
            <Select placeholder="Select a state">
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
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BiometricsData;
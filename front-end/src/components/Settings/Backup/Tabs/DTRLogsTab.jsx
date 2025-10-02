// src/components/Settings/Backup/Tabs/DTRLogTab.jsx
import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Space,
  Input,
  message,
  Popconfirm,
  Card,
  Row,
  Col,
  Modal,
  Form,
} from "antd";
import {
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import axiosInstance from "../../../../api/axiosInstance";
import dayjs from "dayjs";

const DTRLogTab = () => {
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]); // filtered dataset
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/dtrlogs/merged");
      const rows = res.data?.data ?? res.data ?? [];
      setData(rows);
      setFiltered(rows); // initialize with full dataset
    } catch {
      message.error("Failed to load DTR logs");
    } finally {
      setLoading(false);
    }
  };

  // handle search across all pages
  useEffect(() => {
    const lowered = searchText.toLowerCase();
    const results = data.filter(
      (d) => JSON.stringify(d).toLowerCase().includes(lowered) // search across all fields
    );
    setFiltered(results);
  }, [searchText, data]);

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      employeeName: record.employeeName,
      state: record.state,
    });
    setEditModalOpen(true);
  };

  const saveEdit = async () => {
    try {
      const values = await form.validateFields();
      await axiosInstance.put(`/dtrlogs/${editing._id}`, values);
      message.success("Log updated");
      setEditModalOpen(false);
      setEditing(null);
      fetchData();
    } catch {
      message.error("Update failed");
    }
  };

  const handleDelete = async (record) => {
    try {
      await axiosInstance.delete(`/dtrlogs/${record._id}`);
      message.success("Deleted");
      fetchData();
    } catch {
      message.error("Delete failed");
    }
  };

  const exportCsv = () => {
    if (!data?.length) return message.warning("No data to export");
    const rows = data.map((r) => ({
      AC_No: r.acNo,
      Name: r.name,
      Employee: r.employeeName,
      Time: r.time ? dayjs(r.time).format("YYYY-MM-DD HH:mm:ss") : "",
      State: r.state,
    }));
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((row) => headers.map((h) => `"${row[h] ?? ""}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dtr_logs_${Date.now()}.csv`;
    a.click();
  };

const columns = [
    { title: "AC No", dataIndex: "acNo", key: "acNo" },
    { title: "Name", dataIndex: "name", key: "name" },
    {
      title: "Time",
      dataIndex: "time",
      render: (t) => (t ? dayjs(t).format("YYYY-MM-DD HH:mm") : "-"),
    },
    { title: "State", dataIndex: "state", key: "state" },
    {
      title: "Actions",
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Delete this log?"
            onConfirm={() => handleDelete(record)}
          >
            <Button danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <Row justify="space-between" style={{ marginBottom: 12 }}>
        <Col>
          <Input
            placeholder="Search logs..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            prefix={<SearchOutlined />}
            allowClear
          />
        </Col>
        <Col>
          <Button icon={<DownloadOutlined />} onClick={exportCsv}>
            Export CSV
          </Button>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={filtered}
        rowKey={(r) => r._id}
        loading={loading}
        size="small"
      />

      <Modal
        title="Edit DTR Log"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={saveEdit}
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="name" label="Name">
            <Input />
          </Form.Item>
          <Form.Item name="employeeName" label="Employee">
            <Input />
          </Form.Item>
          <Form.Item name="state" label="State">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default DTRLogTab;

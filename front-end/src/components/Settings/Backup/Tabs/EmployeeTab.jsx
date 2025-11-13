// src/components/Settings/Backup/Tabs/EmployeeTab.jsx
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

const EmployeeTab = () => {
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/employees");
      const rows = res.data?.data ?? res.data ?? [];
      setData(rows);
      setFiltered(rows);
    } catch {
      message.error("Failed to load employees");
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
      empId: record.empId,
      name: record.name,
      division: record.division,
      position: record.position,
    });
    setEditModalOpen(true);
  };

  const saveEdit = async () => {
    try {
      const values = await form.validateFields();
      await axiosInstance.put(`/employees/${editing._id}`, values);
      message.success("Employee updated");
      setEditModalOpen(false);
      setEditing(null);
      fetchData();
    } catch {
      message.error("Update failed");
    }
  };

  const handleDelete = async (id) => {
    try {
      await axiosInstance.delete(`/employees/${id}`);
      message.success("Deleted");
      fetchData();
    } catch {
      message.error("Delete failed");
    }
  };

  const exportCsv = () => {
    if (!data?.length) return message.warning("No data to export");
    const rows = data.map((r) => ({
      empId: r.empId,
      name: r.name,
      division: r.division,
      position: r.position,
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
    a.download = `employees_${Date.now()}.csv`;
    a.click();
  };

  const columns = [
    { title: "Emp ID", dataIndex: "empId", key: "empId" },
    { title: "Name", dataIndex: "name", key: "name" },
    { title: "Division", dataIndex: "division", key: "division" },
    { title: "Position", dataIndex: "position", key: "position" },
    {
      title: "Actions",
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Delete this employee?"
            onConfirm={() => handleDelete(record._id)}
          >
            <Button danger icon={<DeleteOutlined />} size="small">
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Client-side pagination of filtered results
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Card className="compact-table">
      <Row justify="space-between" style={{ marginBottom: 12 }}>
        <Col>
          <Input
            size="small"
            placeholder="Search employees..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            prefix={<SearchOutlined />}
            allowClear
          />
        </Col>
        <Col>
          <Button size="small" icon={<DownloadOutlined />} onClick={exportCsv}>
            Export CSV
          </Button>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={paginated}
        rowKey={(r) => r._id}
        loading={loading}
        size="small"
        className="compact-table"
        pagination={{
          current: page,
          pageSize,
          total: filtered.length,
          showSizeChanger: true,
          pageSizeOptions: [5, 10, 20, 50, 100],
          showTotal: (t, range) => `${range[0]}-${range[1]} of ${t}`,
          onChange: (p, ps) => {
            if (ps !== pageSize) {
              setPageSize(ps);
              setPage(1);
            } else {
              setPage(p);
            }
          },
        }}
      />

      <Modal
        title="Edit Employee"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={saveEdit}
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="empId" label="Employee ID">
            <Input />
          </Form.Item>
          <Form.Item name="name" label="Name">
            <Input />
          </Form.Item>
          <Form.Item name="division" label="Division">
            <Input />
          </Form.Item>
          <Form.Item name="position" label="Position">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default EmployeeTab;

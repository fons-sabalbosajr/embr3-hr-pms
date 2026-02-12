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
  DatePicker,
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
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [dateRange, setDateRange] = useState(null); // [start, end]
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData(1, pageSize, searchText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async (
    p = page,
    limit = pageSize,
    q = searchText,
    dr = dateRange,
  ) => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/dtrlogs/merged", {
        params: {
          page: p,
          limit,
          q: q && q.trim() ? q.trim() : undefined,
          startDate:
            Array.isArray(dr) && dr[0] ? dr[0].toISOString() : undefined,
          endDate: Array.isArray(dr) && dr[1] ? dr[1].toISOString() : undefined,
        },
      });
      const rows = res.data?.data ?? res.data ?? [];
      setData(rows);
      setTotal(res.data?.total ?? rows.length ?? 0);
      setPage(res.data?.page ?? p);
      setPageSize(res.data?.limit ?? limit);
    } catch {
      message.error("Failed to load DTR logs");
    } finally {
      setLoading(false);
    }
  };

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
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete this log?"
            onConfirm={() => handleDelete(record)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card className="compact-table">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <Space size={8} wrap align="center">
          <Input
            size="small"
            placeholder="Search logs..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={() => fetchData(1, pageSize, searchText, dateRange)}
            onBlur={() => {
              /* no-op */
            }}
            prefix={<SearchOutlined />}
            allowClear
            style={{ minWidth: 220 }}
          />
          <DatePicker.RangePicker
            size="small"
            value={dateRange}
            onChange={(val) => {
              setDateRange(val);
              // refetch from page 1 when date range changes
              fetchData(1, pageSize, searchText, val);
            }}
            allowEmpty={[true, true]}
          />
          <Button
            size="small"
            onClick={() => {
              setSearchText("");
              setDateRange(null);
              fetchData(1, pageSize, "", null);
            }}
          >
            Clear Filters
          </Button>
        </Space>
        <Space size={8}>
          <Button size="small" icon={<DownloadOutlined />} onClick={exportCsv}>
            Export CSV
          </Button>
        </Space>
      </div>

      <Table
        className="compact-table"
        columns={columns}
        dataSource={data}
        rowKey={(r) => r._id}
        loading={loading}
        size="small"
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: [5, 10, 20, 50, 100],
          showTotal: (t, range) => `${range[0]}-${range[1]} of ${t}`,
          onChange: (p, ps) => {
            if (ps !== pageSize) {
              setPageSize(ps);
              fetchData(1, ps, searchText, dateRange);
            } else {
              setPage(p);
              fetchData(p, ps, searchText, dateRange);
            }
          },
        }}
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

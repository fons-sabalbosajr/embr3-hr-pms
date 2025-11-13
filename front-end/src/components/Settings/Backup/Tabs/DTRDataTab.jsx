// src/components/Settings/Backup/Tabs/DTRDataTab.jsx
import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Space,
  Input,
  message,
  Popconfirm,
  Row,
  Col,
  Modal,
  Form,
  DatePicker,
  Card,
} from "antd";
import {
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import axiosInstance from "../../../../api/axiosInstance";
import dayjs from "dayjs";

const DTRDataTab = () => {
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]); // filtered dataset
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dateRange, setDateRange] = useState(null); // [start, end]
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  // when fetching
  const fetchData = async (range = dateRange) => {
    try {
      const params = {};
      if (Array.isArray(range) && range[0] && range[1]) {
        params.startDate = range[0].toISOString();
        params.endDate = range[1].toISOString();
      }
      const res = await axiosInstance.get("/dtrdatas", { params });
      const rows = res.data?.data ?? res.data ?? [];
      setData(rows);
    } catch (err) {
      message.error("Failed to load DTR data");
    }
  };

  // handle search across fetched (already date-filtered) data
  useEffect(() => {
    const lowered = (searchText || "").toLowerCase();
    const results = (data || []).filter((d) =>
      JSON.stringify(d || {}).toLowerCase().includes(lowered)
    );
    setFiltered(results);
    setPage(1);
  }, [searchText, data]);

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      DTR_Record_Name: record.DTR_Record_Name,
      DTR_Cut_Off: [
        record?.DTR_Cut_Off?.start ? dayjs(record.DTR_Cut_Off.start) : null,
        record?.DTR_Cut_Off?.end ? dayjs(record.DTR_Cut_Off.end) : null,
      ],
    });
    setEditModalOpen(true);
  };

  const saveEdit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        DTR_Record_Name: values.DTR_Record_Name,
        DTR_Cut_Off: {
          start: values.DTR_Cut_Off[0].toDate(),
          end: values.DTR_Cut_Off[1].toDate(),
        },
      };
      await axiosInstance.put(`/dtrdata/${editing._id}`, payload);
      message.success("Updated");
      setEditModalOpen(false);
      setEditing(null);
      fetchData();
    } catch (err) {
      message.error("Update failed");
    }
  };

  const handleDelete = async (id) => {
    try {
      await axiosInstance.delete(`/dtrdata/${id}`);
      message.success("Deleted");
      fetchData();
    } catch {
      message.error("Delete failed");
    }
  };

  const exportCsv = () => {
    if (!data?.length) return message.warning("No data to export");
    const rows = data.map((r) => ({
      DTR_Record_Name: r.DTR_Record_Name,
      CutOffStart: r.DTR_Cut_Off?.start
        ? dayjs(r.DTR_Cut_Off.start).format("YYYY-MM-DD")
        : "",
      CutOffEnd: r.DTR_Cut_Off?.end
        ? dayjs(r.DTR_Cut_Off.end).format("YYYY-MM-DD")
        : "",
      Uploaded_By: r.Uploaded_By ?? "",
      Uploaded_Date: r.Uploaded_Date
        ? dayjs(r.Uploaded_Date).format("YYYY-MM-DD HH:mm:ss")
        : "",
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
    a.download = `dtr_data_backup_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    { title: "Record Name", dataIndex: "DTR_Record_Name", key: "name" },
    {
      title: "Cut Off",
      key: "cutoff",
      render: (r) =>
        r?.DTR_Cut_Off
          ? `${dayjs(r.DTR_Cut_Off.start).format("YYYY-MM-DD")} → ${dayjs(
              r.DTR_Cut_Off.end
            ).format("YYYY-MM-DD")}`
          : "-",
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Delete this record?"
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

  // Slice filtered for pagination (client-side because endpoint returns full list)
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Card className="compact-table">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <Space size={8} wrap align="center">
          <Input
            size="small"
            placeholder="Search..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            prefix={<SearchOutlined />}
            allowClear
            style={{ minWidth: 200 }}
          />
          <DatePicker.RangePicker
            size="small"
            value={dateRange}
            onChange={(val) => {
              setDateRange(val);
              fetchData(val);
            }}
            allowEmpty={[true, true]}
          />
          <Button
            size="small"
            onClick={() => {
              setSearchText("");
              setDateRange(null);
              fetchData(null);
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
        title="Edit DTR Data"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={saveEdit}
        okText="Save"
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            name="DTR_Record_Name"
            label="Record Name"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="DTR_Cut_Off"
            label="Cut Off (start - end)"
            rules={[{ required: true }]}
          >
            <DatePicker.RangePicker />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default DTRDataTab;

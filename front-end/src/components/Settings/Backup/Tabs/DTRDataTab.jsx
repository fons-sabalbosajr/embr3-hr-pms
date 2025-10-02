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
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  // when fetching
  const fetchData = async () => {
    const res = await axiosInstance.get("/dtrdatas");
    const rows = res.data?.data ?? res.data ?? [];
    setData(rows);
    setFiltered(rows); // initialize with full dataset
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
          <Button icon={<EditOutlined />} onClick={() => openEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Delete this record?"
            onConfirm={() => handleDelete(record._id)}
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
            placeholder="Search..."
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

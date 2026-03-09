import React, { useEffect, useState } from "react";
import { Typography, Table, Tag, Button, Space, Input } from "antd";
import dayjs from "dayjs";
import axiosInstance from "../../api/axiosInstance";
import useAuth from "../../hooks/useAuth";
import { swalError } from "../../utils/swalHelper";

const { Title, Text } = Typography;
const { Search } = Input;

const Notifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const [payslipRes, dtrRes] = await Promise.allSettled([
        axiosInstance.get("/payslip-requests"),
        axiosInstance.get("/dtr-requests"),
      ]);

      const payslipNotifs = (payslipRes.status === "fulfilled" ? payslipRes.value.data?.data || [] : []).map((r) => ({
        key: r._id,
        type: "PayslipRequest",
        employeeId: r.empId || r.employeeId || "",
        employeeName: r.employeeName || "",
        title: r.title || `Payslip Request - ${r.empId || r.employeeId || ""}`,
        period: r.period || "",
        read: !!r.read,
        createdAt: r.createdAt,
      }));

      const dtrNotifs = (dtrRes.status === "fulfilled" ? dtrRes.value.data?.data || [] : []).map((r) => ({
        key: r._id,
        type: "DTRRequest",
        employeeId: r.empId || r.employeeId || "",
        employeeName: r.employeeName || "",
        title: r.title || `DTR Request - ${r.empId || r.employeeId || ""}`,
        period: r.startDate && r.endDate
          ? `${dayjs(r.startDate).format("YYYY-MM-DD")} - ${dayjs(r.endDate).format("YYYY-MM-DD")}`
          : "",
        read: !!r.read,
        createdAt: r.createdAt,
      }));

      const merged = [...payslipNotifs, ...dtrNotifs].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setNotifications(merged);
    } catch (e) {
      swalError("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await Promise.all([
        axiosInstance.put("/payslip-requests/read-all"),
        axiosInstance.put("/dtr-requests/read-all"),
      ]);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (_) {
      swalError("Failed to mark all as read");
    }
  };

  const filtered = searchText
    ? notifications.filter(
        (n) =>
          (n.title || "").toLowerCase().includes(searchText.toLowerCase()) ||
          (n.employeeId || "").toLowerCase().includes(searchText.toLowerCase()) ||
          (n.employeeName || "").toLowerCase().includes(searchText.toLowerCase()) ||
          (n.type || "").toLowerCase().includes(searchText.toLowerCase())
      )
    : notifications;

  const columns = [
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 140,
      filters: [
        { text: "Payslip Request", value: "PayslipRequest" },
        { text: "DTR Request", value: "DTRRequest" },
      ],
      onFilter: (value, record) => record.type === value,
      render: (type) => (
        <Tag color={type === "PayslipRequest" ? "blue" : "green"}>
          {type === "PayslipRequest" ? "Payslip Request" : "DTR Request"}
        </Tag>
      ),
    },
    {
      title: "Employee",
      key: "employee",
      width: 180,
      render: (_, r) => (
        <div>
          <Text strong>{r.employeeId}</Text>
          {r.employeeName && (
            <Text type="secondary" style={{ display: "block", fontSize: 12 }}>
              {r.employeeName}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      ellipsis: true,
    },
    {
      title: "Period",
      dataIndex: "period",
      key: "period",
      width: 180,
    },
    {
      title: "Status",
      dataIndex: "read",
      key: "read",
      width: 100,
      filters: [
        { text: "Unread", value: false },
        { text: "Read", value: true },
      ],
      onFilter: (value, record) => record.read === value,
      render: (read) => (
        <Tag color={read ? "default" : "orange"}>{read ? "Read" : "Unread"}</Tag>
      ),
    },
    {
      title: "Date",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 160,
      sorter: (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      defaultSortOrder: "descend",
      render: (date) => (date ? dayjs(date).format("MMM D, YYYY h:mm A") : "—"),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 16 }}>
        All Notifications
      </Title>
      <Space style={{ marginBottom: 16, flexWrap: "wrap" }}>
        <Search
          placeholder="Search notifications…"
          allowClear
          style={{ width: 280 }}
          onSearch={setSearchText}
          onChange={(e) => !e.target.value && setSearchText("")}
        />
        <Button onClick={handleMarkAllRead}>Mark All as Read</Button>
        <Button onClick={fetchNotifications} loading={loading}>
          Refresh
        </Button>
      </Space>
      <Table
        size="small"
        dataSource={filtered}
        columns={columns}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ["10", "20", "50", "100"] }}
        scroll={{ x: 800 }}
      />
    </div>
  );
};

export default Notifications;

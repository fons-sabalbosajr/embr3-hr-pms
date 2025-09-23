import React, { useEffect, useState } from "react";
import {
  Card,
  Table,
  Tag,
  Typography,
  Spin,
  Alert,
  Avatar,
  Input,
  Select,
  Space,
  Pagination,
} from "antd";
import {
  UserOutlined,
  SearchOutlined,
  CalendarOutlined,
  LoginOutlined,
  LogoutOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import "../dashboard.css"; // Import the dashboard CSS

const { Text } = Typography;
const { Option } = Select;

const RecentAttendanceTable = ({
  employees,
  loading,
  error,
  setPresentCount,
  setLastAttendanceDate,
}) => {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [empTypeFilter, setEmpTypeFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    if (employees && employees.length > 0) {
      const present = employees.filter(
        (emp) => emp.attendance && emp.attendance.timeIn
      ).length;
      setPresentCount(present);

      const dates = employees
        .map((emp) => emp.attendance && emp.attendance.date)
        .filter(Boolean);
      if (dates.length > 0) {
        // Assuming dates are in a format that can be sorted, e.g., MM/DD/YYYY
        dates.sort((a, b) => new Date(b) - new Date(a));
        setLastAttendanceDate(dates[0]);
      }
    }
  }, [employees, setPresentCount, setLastAttendanceDate]);

  const columns = [
    {
      title: "Employee",
      dataIndex: "name",
      key: "name",
      render: (text, record) => (
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* <Avatar icon={<UserOutlined />} style={{ marginRight: 8 }} /> */}
          <div>
            <Text strong>{text}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: "12px" }}>
              ID: {record.empId} | Emp No: {record.empNo}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: "Type",
      dataIndex: "empType",
      key: "empType",
      width: 150,
      render: (type) => (
        <Tag color={type === "Regular" ? "green" : "orange"}>{type}</Tag>
      ),
    },
    {
      title: (
        <div className="table-header-with-icon">
          <CalendarOutlined className="table-header-icon" /> Date
        </div>
      ),
      dataIndex: ["attendance", "date"],
      key: "date",
      width: 120,
      render: (date) => date || "",
    },
    {
      title: (
        <div className="table-header-with-icon">
          <LoginOutlined className="table-header-icon" /> Time In
        </div>
      ),
      dataIndex: ["attendance", "timeIn"],
      key: "timeIn",
      width: 100,
      render: (timeIn) => timeIn || "",
    },
    {
      title: (
        <div className="table-header-with-icon">
          <LogoutOutlined className="table-header-icon" /> Break Out
        </div>
      ),
      dataIndex: ["attendance", "breakOut"],
      key: "breakOut",
      width: 100,
      render: (breakOut) => breakOut || "",
    },
    {
      title: (
        <div className="table-header-with-icon">
          <PlayCircleOutlined className="table-header-icon" /> Break In
        </div>
      ),
      dataIndex: ["attendance", "breakIn"],
      key: "breakIn",
      width: 100,
      render: (breakIn) => breakIn || "",
    },
    {
      title: (
        <div className="table-header-with-icon">
          <LogoutOutlined className="table-header-icon" /> Time Out
        </div>
      ),
      dataIndex: ["attendance", "timeOut"],
      key: "timeOut",
      width: 100,
      render: (timeOut) => timeOut || "",
    },
  ];

  const employeesWithTimeRecords = employees.filter(
    (employee) => employee.attendance && employee.attendance.date
  );

  const empTypes = [...new Set(employeesWithTimeRecords.map((e) => e.empType))];

  const filteredEmployees = employeesWithTimeRecords.filter((employee) => {
    const keyword = searchKeyword.toLowerCase();
    const matchesKeyword =
      (employee.name && employee.name.toLowerCase().includes(keyword)) ||
      (employee.empId && employee.empId.toLowerCase().includes(keyword)) ||
      (employee.empNo && employee.empNo.toLowerCase().includes(keyword)) ||
      (employee.normalizedEmpId &&
        employee.normalizedEmpId.toLowerCase().includes(keyword)) ||
      (employee.empType && employee.empType.toLowerCase().includes(keyword));

    const matchesType = empTypeFilter
      ? employee.empType === empTypeFilter
      : true;

    return matchesKeyword && matchesType;
  });

  // paginated data
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <Card
      title="Recent Employee Attendance"
      className="dashboard-card" // Apply dashboard card styling
      styles={{
        header: { borderBottom: "1px solid #f0f0f0" },
        body: { padding: "0 24px 24px 24px" },
      }}
      size="small"
    >
      {loading ? (
        <div style={{ textAlign: "center", padding: "20px" }}>
          <Spin size="large" />
          <p>Loading employees...</p>
        </div>
      ) : error ? (
        <Alert message="Error" description={error} type="error" showIcon />
      ) : (
        <>
          <Table
            columns={columns}
            dataSource={paginatedEmployees}
            rowKey="_id"
            pagination={false} // disable built-in pagination
            size="small"
            style={{ marginTop: "5px" }}
            scroll={{ y: 400 }}
            title={() => (
              <Space style={{ width: "100%" }}>
                <Input
                  placeholder="Search employees..."
                  prefix={<SearchOutlined />}
                  value={searchKeyword}
                  onChange={(e) => {
                    setSearchKeyword(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ maxWidth: 300 }}
                  size="small"
                  allowClear
                />
                <Select
                  placeholder="Filter by Type"
                  style={{ width: 180 }}
                  value={empTypeFilter || undefined}
                  onChange={(value) => {
                    setEmpTypeFilter(value);
                    setCurrentPage(1);
                  }}
                  allowClear
                  size="small"
                >
                  {empTypes.map((type) => (
                    <Option key={type} value={type}>
                      {type}
                    </Option>
                  ))}
                </Select>
              </Space>
            )}
            footer={() => (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                {/* Left: Total count */}
                <span>Total Employees: {filteredEmployees.length}</span>

                {/* Center: Pagination */}
                <Pagination
                  current={currentPage}
                  pageSize={pageSize}
                  total={filteredEmployees.length}
                  onChange={(page, size) => {
                    setCurrentPage(page);
                    setPageSize(size);
                  }}
                  showSizeChanger={false} // hide default size changer (we’ll put it at right)
                  simple={false}
                  size="small"
                />

                {/* Right: Page size selector */}
                <Select
                  value={pageSize}
                  onChange={(value) => {
                    setPageSize(value);
                    setCurrentPage(1); // reset to first page when page size changes
                  }}
                  size="small"
                  style={{ width: 120 }}
                >
                  {[5, 10, 20, 50].map((size) => (
                    <Option key={size} value={size}>
                      {size} / page
                    </Option>
                  ))}
                </Select>
              </div>
            )}
          />
        </>
      )}
    </Card>
  );
};

export default RecentAttendanceTable;

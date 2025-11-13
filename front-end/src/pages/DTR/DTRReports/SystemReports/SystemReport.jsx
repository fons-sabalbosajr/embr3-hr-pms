import React, { useState, useEffect, useMemo } from "react";
import { Table, Input, Select, DatePicker, Space, Button, Tag } from "antd";
import useDemoMode from "../../../../hooks/useDemoMode";
import dayjs from "dayjs";
import { getEmployeeDocs } from "../../../../api/employeeAPI"; // Adjust path as needed
import { getAllUsers } from "../../../../api/authAPI"; // Import getAllUsers

const { RangePicker } = DatePicker;
const { Option } = Select;

const SystemReport = () => {
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]); // State to store users
  const [loading, setLoading] = useState(false);
  const { shouldHideInDemo } = useDemoMode();
  const [filters, setFilters] = useState({
    docType: "",
    createdBy: "",
    dateRange: [],
    empId: "",
    employeeName: "",
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchReports();
  }, [filters, users]); // Re-fetch reports when filters or users change

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const usersResponse = await getAllUsers();
      setUsers(usersResponse.data.data);
    } catch (error) {
      console.error("Failed to fetch initial data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await getEmployeeDocs();
      let filteredReports = response.data.data;

      // Apply filters
      if (filters.docType) {
        filteredReports = filteredReports.filter(
          (report) => report.docType === filters.docType
        );
      }
      if (filters.createdBy) {
        filteredReports = filteredReports.filter((report) => {
          const user = users.find((u) => u.name === filters.createdBy);
          return user && report.createdBy === user.username;
        });
      }
      if (filters.empId) {
        filteredReports = filteredReports.filter((report) =>
          report.empId.toLowerCase().includes(filters.empId.toLowerCase())
        );
      }
      if (filters.employeeName) {
        filteredReports = filteredReports.filter(
          (report) =>
            report.employee &&
            report.employee.name
              .toLowerCase()
              .includes(filters.employeeName.toLowerCase())
        );
      }
      if (filters.dateRange && filters.dateRange.length === 2) {
        const [startDate, endDate] = filters.dateRange;
        filteredReports = filteredReports.filter((report) => {
          const reportDate = dayjs(report.dateIssued);
          return (
            reportDate.isAfter(startDate.startOf("day")) &&
            reportDate.isBefore(endDate.endOf("day"))
          );
        });
      }

      setReports(filteredReports);
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prevFilters) => ({
      ...prevFilters,
      [key]: value,
    }));
  };

  // Use useMemo to memoize userMap and recompute only when 'users' changes
  const userMap = useMemo(() => {
    return users.reduce((acc, user) => {
      acc[user.username] = user.name;
      return acc;
    }, {});
  }, [users]);

  const columns = [
    {
      title: "Document Type",
      dataIndex: "docType",
      key: "docType",
      render: (docType) => <Tag color="blue">{docType}</Tag>,
      sorter: (a, b) => a.docType.localeCompare(b.docType),
    },
    {
      title: "Employee",
      key: "employeeInfo",
      render: (text, record) => (
        <>
          <div>{record.employee?.name || "N/A"}</div>
          <small style={{ color: "#999" }}>{record.empId}</small>
        </>
      ),
      sorter: (a, b) =>
        (a.employee?.name || "").localeCompare(b.employee?.name || ""),
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      render: (text) => <div style={{ whiteSpace: "pre-wrap" }}>{text}</div>,
    },
    {
      title: "Period",
      dataIndex: "period",
      key: "period",
      render: (period) => {
        if (!period) return "N/A";

        let dates = [];
        if (period.includes(" - ")) {
          dates = period.split(" - ");
        } else if (period.includes("-")) {
          dates = period.split("-");
        }

        if (dates.length === 2) {
          const startDate = dayjs(dates[0].trim());
          const endDate = dayjs(dates[1].trim());
          if (startDate.isValid() && endDate.isValid()) {
            return `${startDate.format("MM/DD/YYYY")} - ${endDate.format(
              "MM/DD/YYYY"
            )}`;
          }
        }

        const singleDate = dayjs(period);
        if (singleDate.isValid()) {
          return singleDate.format("MM/DD/YYYY");
        }

        return period; // Fallback to original period if parsing fails
      },
      sorter: (a, b) => (a.period || "").localeCompare(b.period || ""),
    },

    {
      title: "Issued By / Date",
      key: "issuedByDate",
      render: (text, record) => (
        <>
          <div>{userMap[record.createdBy] || record.createdBy}</div>
          <small style={{ color: "#999" }}>
            {dayjs(record.dateIssued).format("MM/DD/YYYY hh:mm A")}
          </small>
        </>
      ),
      sorter: (a, b) => dayjs(a.dateIssued).unix() - dayjs(b.dateIssued).unix(),
    },
  ];

  const uniqueDocTypes = [...new Set(reports.map((report) => report.docType))];
  // Filter out undefined or null names before creating unique list for Select
  const uniqueCreatedByUsers = [
    ...new Set(users.map((user) => user.name).filter((name) => name)),
  ];

  return (
    <div style={{ padding: "10px" }} className="compact-table">
      {!shouldHideInDemo('ui.dtr.reports.generate') && (
        <h2 style={{ marginTop: 0, fontSize: 18 }}>System Generated Reports</h2>
      )}
      <Space style={{ marginBottom: 16, flexWrap: "wrap" }}>
        <Input
          placeholder="Search Employee ID"
          value={filters.empId}
          onChange={(e) => handleFilterChange("empId", e.target.value)}
          style={{ width: 180 }}
        />
        <Input
          placeholder="Search Employee Name"
          value={filters.employeeName}
          onChange={(e) => handleFilterChange("employeeName", e.target.value)}
          style={{ width: 180 }}
        />
        <Select
          placeholder="Select Document Type"
          style={{ width: 180 }}
          onChange={(value) => handleFilterChange("docType", value)}
          value={filters.docType}
          allowClear
        >
          {uniqueDocTypes.map((type) => (
            <Option key={type} value={type}>
              {type}
            </Option>
          ))}
        </Select>

        <Button
          onClick={() =>
            setFilters({
              docType: "",
              createdBy: "",
              dateRange: [],
              empId: "",
              employeeName: "",
            })
          }
        >
          Clear Filters
        </Button>
      </Space>
      <Table
        className="compact-table"
        columns={columns}
        dataSource={reports}
        loading={loading}
        rowKey="_id"
        pagination={{
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} reports`,
          showSizeChanger: true,
          pageSizeOptions: [5, 10, 20, 50, 100],
          defaultPageSize: 10,
        }}
        scroll={{ x: "max-content" }}
        size="small"
      />
    </div>
  );
};

export default SystemReport;

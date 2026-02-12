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
  attendanceRows, // optional pre-built multi-day rows
}) => {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [empTypeFilter, setEmpTypeFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    // When multi-day rows provided, compute PRESENT as distinct employees with any time record
    // on the LAST day (within the last-two-day window) that actually has records.
    // Fallback to previous single-day logic when only one date exists or no multi-day rows yet.
    if (attendanceRows && attendanceRows.length) {
      const uniqueDates = Array.from(new Set(
        attendanceRows.map(r => r.attendance?.date).filter(Boolean)
      )).sort(); // ascending chronological

      if (uniqueDates.length >= 2) {
        const lastTwo = uniqueDates.slice(-2); // [older, newer]
        const [d1, d2] = lastTwo;

        const hasAnyRecord = (att) => {
          if (!att) return false;
          return !!(att.timeIn || att.breakOut || att.breakIn || att.timeOut);
        };

        // Present tile should match the table total: count employees with any record across the 2-day window.
        const presentEmpSet = new Set();
        attendanceRows.forEach((r) => {
          const d = r.attendance?.date;
          if (!d || !lastTwo.includes(d)) return;
          if (!hasAnyRecord(r.attendance)) return;
          const key = r.empId || r.empNo || r._id;
          presentEmpSet.add(key);
        });

        setPresentCount(presentEmpSet.size);
        // Keep the latest day for legacy displays
        setLastAttendanceDate(d2);
        return;
      } else if (uniqueDates.length === 1) {
        const onlyDate = uniqueDates[0];
        const hasAnyRecord = (att) => !!(att?.timeIn || att?.breakOut || att?.breakIn || att?.timeOut);

        const presentEmpSet = new Set();
        attendanceRows.forEach((r) => {
          if (r.attendance?.date !== onlyDate) return;
          if (!hasAnyRecord(r.attendance)) return;
          const key = r.empId || r.empNo || r._id;
          presentEmpSet.add(key);
        });

        setPresentCount(presentEmpSet.size);
        setLastAttendanceDate(onlyDate);
        return;
      }
    }
    if (employees && employees.length > 0) {
      const hasAnyRecord = (att) => !!(att?.timeIn || att?.breakOut || att?.breakIn || att?.timeOut);
      const present = employees.filter(
        (emp) => emp.attendance && hasAnyRecord(emp.attendance)
      ).length;
      setPresentCount(present);
      const dates = employees
        .map((emp) => emp.attendance && emp.attendance.date)
        .filter(Boolean);
      if (dates.length > 0) {
        dates.sort((a, b) => new Date(b) - new Date(a));
        setLastAttendanceDate(dates[0]);
      }
    }
  }, [employees, attendanceRows, setPresentCount, setLastAttendanceDate]);

  const isTablet =
    typeof window !== "undefined" &&
    window.innerWidth >= 768 &&
    window.innerWidth <= 1080;

  // When multi-day rows are provided, merge last two dates into a single row per employee
  let columns;
  let tableData;

  if (attendanceRows && attendanceRows.length) {
    const allDates = Array.from(
      new Set(attendanceRows.map((r) => r.attendance?.date).filter(Boolean))
    ).sort();
    const twoDates = allDates.slice(-2); // last two
    const [d1, d2] = twoDates;

    // Group by employee
    const byEmp = new Map();
    attendanceRows.forEach((r) => {
      const key = r.empId || r.empNo || r._id;
      if (!byEmp.has(key)) {
        byEmp.set(key, {
          ...r,
          d1: {
            date: d1,
            timeIn: null,
            breakOut: null,
            breakIn: null,
            timeOut: null,
          },
          d2: {
            date: d2,
            timeIn: null,
            breakOut: null,
            breakIn: null,
            timeOut: null,
          },
        });
      }
      const row = byEmp.get(key);
      if (r.attendance?.date === d1) row.d1 = { ...row.d1, ...r.attendance };
      if (r.attendance?.date === d2) row.d2 = { ...row.d2, ...r.attendance };
    });

    // Remove employees with no records across both days
    const merged = Array.from(byEmp.values()).filter((r) => {
      const hasAny = !!(
        r.d1.timeIn ||
        r.d1.breakOut ||
        r.d1.breakIn ||
        r.d1.timeOut ||
        r.d2.timeIn ||
        r.d2.breakOut ||
        r.d2.breakIn ||
        r.d2.timeOut
      );
      return hasAny;
    });

    tableData = merged;

    const dayGroup = (label, keyPrefix) => ({
      title: (
        <div className="table-header-with-icon">
          <CalendarOutlined className="table-header-icon" /> {label}
        </div>
      ),
      dataIndex: keyPrefix,
      key: keyPrefix + "Combined",
      width: 200,
      render: (day) => {
        if (!day) return "";
        const { timeIn, breakOut, breakIn, timeOut } = day;
        const cellStyle = {
          fontSize: isTablet ? 10 : 11,
          lineHeight: 1.2,
        };
        return (
          <div style={cellStyle}>
            {timeIn && (
              <div>
                <strong>IN:</strong> {timeIn}
              </div>
            )}
            {breakOut && (
              <div>
                <strong>BO:</strong> {breakOut}
              </div>
            )}
            {breakIn && (
              <div>
                <strong>BI:</strong> {breakIn}
              </div>
            )}
            {timeOut && (
              <div>
                <strong>OUT:</strong> {timeOut}
              </div>
            )}
            {!timeIn && !breakOut && !breakIn && !timeOut && (
              <div style={{ opacity: 0.6 }}>No Records</div>
            )}
          </div>
        );
      },
    });

    columns = [
      {
        title: "Employee",
        dataIndex: "name",
        key: "name",
        fixed: "left",
        width: 110, // reduced for horizontal space
        ellipsis: true,
        render: (text, record) => (
          <div
            style={{
              fontSize: isTablet ? 11 : 12,
              lineHeight: 1.15,
              display: "flex",
              flexDirection: "column",
              overflow: 'hidden'
            }}
            title={`${text}\n${record.empId || ''}${record.empNo ? ` / ${record.empNo}` : ''}`}
          >
            <Text strong style={{ fontSize: isTablet ? 11 : 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {text}
            </Text>
            <Text type="secondary" style={{ fontSize: isTablet ? 9 : 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {record.empId || ''}{record.empNo ? ` / ${record.empNo}` : ''}
            </Text>
          </div>
        ),
      },
      {
        title: "Type",
        dataIndex: "empType",
        key: "empType",
        width: 120,
        render: (type) => (
          <Tag
            color={type === "Regular" ? "green" : "orange"}
            style={{ fontSize: isTablet ? 11 : undefined }}
          >
            {type}
          </Tag>
        ),
      },
      { ...dayGroup(d1 || "Day 1", "d1"), width: 220 },
      { ...dayGroup(d2 || "Day 2", "d2"), width: 220 },
    ];
  } else {
    // Single-day default columns
    columns = [
      {
        title: "Employee",
        dataIndex: "name",
        key: "name",
        width: 110,
        ellipsis: true,
        render: (text, record) => (
          <div
            style={{
              fontSize: isTablet ? 11 : 12,
              lineHeight: 1.15,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            title={`${text}\n${record.empId || ''}${record.empNo ? ` / ${record.empNo}` : ''}`}
          >
            <Text strong style={{ fontSize: isTablet ? 11 : 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</Text>
            <Text type="secondary" style={{ fontSize: isTablet ? 9 : 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {record.empId || ''}{record.empNo ? ` / ${record.empNo}` : ''}
            </Text>
          </div>
        ),
      },
      {
        title: "Type",
        dataIndex: "empType",
        key: "empType",
        width: 150,
        render: (type) => (
          <Tag
            color={type === "Regular" ? "green" : "orange"}
            style={{ fontSize: isTablet ? 11 : undefined }}
          >
            {type}
          </Tag>
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
        render: (date) => (
          <span style={{ fontSize: isTablet ? 12 : undefined }}>
            {date || ""}
          </span>
        ),
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
        render: (timeIn) => (
          <span style={{ fontSize: isTablet ? 12 : undefined }}>
            {timeIn || ""}
          </span>
        ),
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
        render: (breakOut) => (
          <span style={{ fontSize: isTablet ? 12 : undefined }}>
            {breakOut || ""}
          </span>
        ),
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
        render: (breakIn) => (
          <span style={{ fontSize: isTablet ? 12 : undefined }}>
            {breakIn || ""}
          </span>
        ),
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
        render: (timeOut) => (
          <span style={{ fontSize: isTablet ? 12 : undefined }}>
            {timeOut || ""}
          </span>
        ),
      },
    ];

    tableData = undefined; // will use baseRows below
  }

  let baseRows;
  if (attendanceRows && attendanceRows.length) {
    // Use provided rows (already normalized)
    baseRows = (tableData || attendanceRows).filter(
      (r) => (r.attendance && r.attendance.date) || r.d1 || r.d2
    );
  } else {
    // Fallback single-day behavior
    baseRows = employees
      .map((emp) => {
        const att =
          emp.attendance || emp.recentAttendance || emp.latestAttendance;
        if (!att) return emp;
        const norm = {
          date: att.date || att.attendanceDate || att.day || null,
          timeIn: att.timeIn || att.time_in || att.in || att.firstIn || null,
          breakOut: att.breakOut || att.break_out || att.lunchOut || null,
          breakIn: att.breakIn || att.break_in || att.lunchIn || null,
          timeOut:
            att.timeOut || att.time_out || att.out || att.lastOut || null,
        };
        return { ...emp, attendance: norm };
      })
      .filter((emp) => emp.attendance && emp.attendance.date);
  }
  const empTypes = [...new Set((tableData || baseRows).map((e) => e.empType))];

  const dataToFilter = tableData || baseRows;
  const filteredEmployees = dataToFilter.filter((employee) => {
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
            scroll={{ x: 900, y: 400 }}
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

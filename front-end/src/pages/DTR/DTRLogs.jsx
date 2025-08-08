import React, { useEffect, useState, useMemo } from "react";
import axiosInstance from "../../api/axiosInstance";
import {
  Table,
  Tag,
  Tooltip,
  Spin,
  message,
  Space,
  Input,
  Button,
  Typography,
  Select,
  DatePicker,
  Row,
  Col,
  Pagination,
} from "antd";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import isBetween from "dayjs/plugin/isBetween";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);

const { Title } = Typography;
const { RangePicker } = DatePicker;

const userTimeZone = dayjs.tz.guess();

const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = `hsl(${hash % 360}, 70%, 50%)`;
  return color;
};

const groupDTRLogs = (logs) => {
  const map = new Map();

  logs.forEach((log) => {
    const timeKey = dayjs(log.time).tz(userTimeZone).toISOString();
    const key = `${timeKey}-${log.state}`;

    if (!map.has(key)) {
      map.set(key, {
        no: log.no,
        time: log.time,
        state: log.state,
        acNos: log.acNo ? [log.acNo] : [],
        employees: log.employeeName ? [log.employeeName] : [],
        newState: log.newState,
        unknownAcNos:
          log.employeeName === "Unknown Employee" && log.acNo ? [log.acNo] : [],
        employeeToAcNo:
          log.acNo && log.employeeName ? { [log.employeeName]: log.acNo } : {},
      });
    } else {
      const group = map.get(key);
      if (log.acNo && !group.acNos.includes(log.acNo))
        group.acNos.push(log.acNo);
      if (log.employeeName && !group.employees.includes(log.employeeName))
        group.employees.push(log.employeeName);
      if (
        log.employeeName === "Unknown Employee" &&
        log.acNo &&
        !group.unknownAcNos.includes(log.acNo)
      )
        group.unknownAcNos.push(log.acNo);

      if (log.acNo && log.employeeName) {
        group.employeeToAcNo[log.employeeName] = log.acNo;
      }
    }
  });

  const groupedArr = Array.from(map.values()).sort(
    (a, b) => dayjs(b.time).valueOf() - dayjs(a.time).valueOf()
  );

  return groupedArr.map((item, idx) => ({ ...item, no: idx + 1 }));
};

const DTRLogs = () => {
  const [loading, setLoading] = useState(false);
  const [dtrData, setDtrData] = useState([]);
  const [employeeFilter, setEmployeeFilter] = useState("");

  // Filters
  const [stateFilter, setStateFilter] = useState(null);
  const [cutOffDateRange, setCutOffDateRange] = useState([null, null]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Single day date filter for column
  const [dateFilter, setDateFilter] = useState(null);

  useEffect(() => {
    const fetchDTRData = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get("/dtrlogs/merged");
        if (res.data.success) {
          setDtrData(res.data.data);
        } else {
          message.error("Failed to load DTR logs");
        }
      } catch (error) {
        console.error("Failed to fetch DTR logs:", error);
        message.error("Error loading DTR logs");
      } finally {
        setLoading(false);
      }
    };

    fetchDTRData();
  }, []);

  const uniqueStates = useMemo(() => {
    const statesSet = new Set(dtrData.map((item) => item.state));
    return Array.from(statesSet).sort();
  }, [dtrData]);

  // Filter raw data by date range, state filter, and single date filter
  const filteredRawData = useMemo(() => {
    let filtered = dtrData;

    if (cutOffDateRange && cutOffDateRange[0] && cutOffDateRange[1]) {
      const [start, end] = cutOffDateRange;
      const startDate = start.startOf("day");
      const endDate = end.endOf("day");

      filtered = filtered.filter((log) => {
        if (!log.time) return false;
        const logDate = dayjs(log.time).tz(userTimeZone);
        if (!logDate.isValid()) return false;

        return logDate.isBetween(startDate, endDate, null, "[]");
      });
    }

    if (stateFilter) {
      filtered = filtered.filter((log) => log.state === stateFilter);
    }

    if (dateFilter) {
      filtered = filtered.filter((log) => {
        if (!log.time) return false;
        const logDate = dayjs(log.time).tz(userTimeZone);
        if (!logDate.isValid()) return false;

        return (
          logDate.year() === dateFilter.year() &&
          logDate.month() === dateFilter.month() &&
          logDate.date() === dateFilter.date()
        );
      });
    }

    return filtered;
  }, [dtrData, cutOffDateRange, stateFilter, dateFilter]);

  const groupedData = useMemo(
    () => groupDTRLogs(filteredRawData),
    [filteredRawData]
  );

  const filteredData = useMemo(() => {
    if (!employeeFilter.trim()) return groupedData;

    const keyword = employeeFilter.trim().toLowerCase();
    return groupedData
      .filter((item) =>
        item.employees.some((name) => name.toLowerCase().includes(keyword))
      )
      .map((item) => {
        const filteredEmployees = item.employees.filter((name) =>
          name.toLowerCase().includes(keyword)
        );

        const filteredAcNos = filteredEmployees
          .map((name) => item.employeeToAcNo[name])
          .filter(Boolean);

        return {
          ...item,
          employees: filteredEmployees,
          acNos: filteredAcNos,
        };
      });
  }, [groupedData, employeeFilter]);

  const pagedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredData]);

  const SMALL_FONT_STYLE = { fontSize: "12px" };
  const NORMAL_FONT_STYLE = { fontSize: "14px" }; // or whatever default you want

  const columns = [
    {
      title: "No.",
      dataIndex: "no",
      key: "no",
      width: 60,
      align: "center",
      onCell: () => ({ style: SMALL_FONT_STYLE }),
    },
    {
      title: "Date and Time",
      dataIndex: "time",
      key: "time",
      align: "center",
      width: 180,
      onCell: () => ({ style: SMALL_FONT_STYLE }),
      filterDropdown: ({
        setSelectedKeys,
        selectedKeys,
        confirm,
        clearFilters,
      }) => {
        const [localDate, setLocalDate] = React.useState(dateFilter);

        const onChange = (date) => {
          setLocalDate(date);
          setSelectedKeys(date ? [date] : []);
        };

        const onConfirm = () => {
          setDateFilter(localDate);
          confirm();
        };

        const onClear = () => {
          clearFilters();
          setLocalDate(null);
          setDateFilter(null);
        };

        return (
          <div style={{ padding: 8 }}>
            <DatePicker
              value={localDate}
              onChange={onChange}
              format="MM/DD/YYYY"
              allowClear
              autoFocus
              style={{ marginBottom: 8, display: "block" }}
            />
            <Space>
              <Button
                type="primary"
                onClick={onConfirm}
                size="small"
                style={{ width: 90 }}
              >
                Filter
              </Button>
              <Button onClick={onClear} size="small" style={{ width: 90 }}>
                Reset
              </Button>
            </Space>
          </div>
        );
      },
      filteredValue: dateFilter ? [dateFilter.format("YYYY-MM-DD")] : null,
      // Removed onFilter to prevent AntD internal filtering
      render: (text) => {
        if (!text) return "-";
        const date = dayjs(text).tz(userTimeZone);
        if (!date.isValid()) return text;
        return date.format("MM/DD/YYYY hh:mm A");
      },
    },
    {
      title: "State",
      dataIndex: "state",
      key: "state",
      align: "center",
      width: 120,
      onCell: () => ({ style: SMALL_FONT_STYLE }),
    },
    {
      title: "Biometrics Code",
      dataIndex: "acNos",
      key: "acNos",
      align: "center",
      width: 250, // keep width fixed
      onCell: () => ({
        style: {
          whiteSpace: "normal",
          wordBreak: "break-word",
          padding: "8px", // optional, improve readability
          maxWidth: 200,
          fontSize: "12px", // smaller font for better fit
        },
      }),
      render: (acNos, record) => {
        if (!acNos.length) return "-";

        return acNos.map((acNo, idx) => {
          const isUnknown = record.unknownAcNos?.includes(acNo);
          return (
            <span
              key={acNo}
              style={{
                color: isUnknown ? "red" : "inherit",
                fontWeight: isUnknown ? "bold" : "normal",
                marginRight: idx < acNos.length - 1 ? 8 : 0,
                display: "inline-block", // keep each code separate
              }}
            >
              {acNo}
              {idx < acNos.length - 1 ? "," : ""}
            </span>
          );
        });
      },
    },
    {
      title: "Employee",
      dataIndex: "employees",
      key: "employees",
      width: 400,

      filterDropdown: ({
        setSelectedKeys,
        selectedKeys,
        confirm,
        clearFilters,
      }) => {
        const [searchText, setSearchText] = useState(selectedKeys[0] || "");

        const onInputChange = (e) => {
          setSearchText(e.target.value);
          setSelectedKeys(e.target.value ? [e.target.value] : []);
        };

        const onConfirm = () => {
          confirm();
          setEmployeeFilter(searchText);
        };

        const onClear = () => {
          clearFilters();
          setSearchText("");
          setEmployeeFilter("");
        };

        return (
          <div style={{ padding: 8 }}>
            <Input
              placeholder="Search employee name"
              value={searchText}
              onChange={onInputChange}
              onPressEnter={onConfirm}
              style={{ marginBottom: 8, display: "block" }}
              autoFocus
              allowClear
            />
            <Space>
              <Button
                type="primary"
                onClick={onConfirm}
                size="small"
                style={{ width: 90 }}
              >
                Search
              </Button>
              <Button onClick={onClear} size="small" style={{ width: 90 }}>
                Reset
              </Button>
            </Space>
          </div>
        );
      },
      filteredValue: employeeFilter ? [employeeFilter] : null,
      onFilter: () => true,
      render: (employees) => (
        <Space wrap>
          {employees.map((name, index) =>
            name === "Unknown Employee" ? (
              <Tooltip
                key={index}
                title="Unknown Employee — please register this AC-No"
              >
                <Tag
                  color="red"
                  style={{ cursor: "default", whiteSpace: "nowrap" }}
                >
                  {name}
                </Tag>
              </Tooltip>
            ) : (
              <Tooltip key={index} title={name}>
                <Tag
                  color={stringToColor(name)}
                  style={{ cursor: "default", whiteSpace: "nowrap" }}
                >
                  {name}
                </Tag>
              </Tooltip>
            )
          )}
        </Space>
      ),
    },
    {
      title: "Remarks",
      dataIndex: "remarks",
      key: "remarks",
      align: "center",
      render: (text) => text || "-",
      onCell: () => ({ style: SMALL_FONT_STYLE }),
    },
  ];

  const handleGenerateDTR = () => {
    message.info("Generate DTR functionality not implemented.");
  };

  return (
    <>
      {/* Title & Generate DTR button */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4}>Daily Time Record Logs</Title>
        </Col>
        <Col>
          <Button type="primary" onClick={handleGenerateDTR}>
            Generate DTR
          </Button>
        </Col>
      </Row>

      {/* Filters row with pagination right aligned */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col xs={24} sm={16} md={18} lg={18}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8} lg={6}>
              {/* State filter */}
              <Space
                direction="vertical"
                style={{ width: "100%", marginBottom: 0 }}
              >
                <label>
                  <b>Filter by State</b>
                </label>
                <Select
                  allowClear
                  placeholder="Select State"
                  value={stateFilter}
                  onChange={setStateFilter}
                  options={uniqueStates.map((state) => ({
                    label: state,
                    value: state,
                  }))}
                  style={{ width: "100%" }}
                />
              </Space>
            </Col>
            <Col xs={24} sm={12} md={16} lg={12}>
              {/* Cut Off Date Range */}
              <Space
                direction="vertical"
                style={{ width: "100%", marginBottom: 0 }}
              >
                <label>
                  <b>Cut Off Date Range</b>
                </label>
                <RangePicker
                  value={cutOffDateRange}
                  onChange={(dates) => setCutOffDateRange(dates)}
                  allowEmpty={[true, true]}
                  format="MM/DD/YYYY"
                />
              </Space>
            </Col>
          </Row>
        </Col>

        <Col
          xs={24}
          sm={8}
          md={6}
          lg={6}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            height: "100%",
          }}
        >
          <Pagination
            simple
            current={currentPage}
            pageSize={pageSize}
            total={filteredData.length}
            showSizeChanger
            pageSizeOptions={["10", "20", "50", "100"]}
            onChange={(page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            }}
            style={{ display: "inline-block" }}
            size="small"
          />
        </Col>
      </Row>

      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={pagedData}
          rowKey={(record) => `${record.time}-${record.state}`}
          pagination={false}
          bordered
          size="small"
          scroll={{ x: "max-content" }} // Allows horizontal scroll if content overflows
          style={{ tableLayout: "fixed" }} // Fixes column widths
        />
      </Spin>
    </>
  );
};

export default DTRLogs;

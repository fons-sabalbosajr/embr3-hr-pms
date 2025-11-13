import React, { useEffect, useState, useMemo } from "react";
import axiosInstance from "../../../api/axiosInstance";
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
import NProgress from "nprogress";
import "nprogress/nprogress.css";

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
  const [stateFilter, setStateFilter] = useState(null);
  const [cutOffDateRange, setCutOffDateRange] = useState([null, null]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [dateFilter, setDateFilter] = useState(null);
  const [recordNameFilter, setRecordNameFilter] = useState(null);
  const [recordNameOptions, setRecordNameOptions] = useState([]);
  const [dtrRecords, setDtrRecords] = useState([]);

  const [acNoFilter, setAcNoFilter] = useState("");

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const recordsRes = await axiosInstance.get("/dtrdatas");
        if (recordsRes.data.success) {
          const records = recordsRes.data.data || [];
          setDtrRecords(records);
          setRecordNameOptions(
            records.map((r) => ({ label: r.DTR_Record_Name, value: r.DTR_Record_Name }))
          );
        } else {
          message.error("Failed to load DTR Record Names");
        }
      } catch (error) {
        console.error("Failed to load DTR Record Names:", error);
        message.error("Error loading record names");
      }
    };
    fetchRecords();
  }, []);

  // Fetch logs whenever a record is selected to avoid relying on a small default page
  useEffect(() => {
    const fetchLogs = async () => {
      if (!recordNameFilter) {
        setDtrData([]);
        return;
      }
      try {
        setLoading(true);
        // Derive cutoff dates from the selected record (if present)
        const rec = dtrRecords.find((r) => r.DTR_Record_Name === recordNameFilter);
        const startDate = rec?.DTR_Cut_Off?.start ? dayjs(rec.DTR_Cut_Off.start).format("YYYY-MM-DD") : undefined;
        const endDate = rec?.DTR_Cut_Off?.end ? dayjs(rec.DTR_Cut_Off.end).format("YYYY-MM-DD") : undefined;
        const { data } = await axiosInstance.get("/dtrlogs/merged", {
          params: {
            recordName: recordNameFilter,
            startDate,
            endDate,
            page: 1,
            limit: 500,
          },
        });
        if (data.success) {
          setDtrData(data.data);
        } else {
          setDtrData([]);
          message.error("Failed to load DTR logs");
        }
      } catch (error) {
        console.error("Failed to fetch DTR logs:", error);
        message.error("Error loading logs");
        setDtrData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [recordNameFilter, dtrRecords]);

  const uniqueStates = useMemo(() => {
    const statesSet = new Set(dtrData.map((item) => item.state));
    return Array.from(statesSet).sort();
  }, [dtrData]);

  // Filter raw data by date range, state filter, and single date filter
  const filteredRawData = useMemo(() => {
    let filtered = dtrData;

    // Existing filters...
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

    // New: Filter by DTR_Record_Name (fallback to cutoff date range if missing linkage)
    if (recordNameFilter) {
      const rec = dtrRecords.find((r) => r.DTR_Record_Name === recordNameFilter);
      const recStart = rec?.DTR_Cut_Off?.start ? dayjs(rec.DTR_Cut_Off.start).startOf("day") : null;
      const recEnd = rec?.DTR_Cut_Off?.end ? dayjs(rec.DTR_Cut_Off.end).endOf("day") : null;
      filtered = filtered.filter((log) => {
        if (log.DTR_Record_Name === recordNameFilter) return true;
        if (!recStart || !recEnd || !log.time) return false;
        const dt = dayjs(log.time).tz(userTimeZone);
        if (!dt.isValid()) return false;
        return dt.isBetween(recStart, recEnd, null, "[]");
      });
    }

    // New: Filter by Biometrics Code
    if (acNoFilter.trim()) {
      const keyword = acNoFilter.trim().toLowerCase();
      filtered = filtered.filter((log) =>
        log.acNo?.toLowerCase().includes(keyword)
      );
    }

    return filtered;
  }, [
    dtrData,
    cutOffDateRange,
    stateFilter,
    dateFilter,
    recordNameFilter,
    acNoFilter,
  ]);

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

  useEffect(() => {
    if (loading) {
      NProgress.start();
    } else {
      NProgress.done();
    }
  }, [loading]);

  const SMALL_FONT_STYLE = { fontSize: "12px" };

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
      width: 200,
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
          setAcNoFilter(searchText);
        };

        const onClear = () => {
          clearFilters();
          setSearchText("");
          setAcNoFilter("");
        };

        return (
          <div style={{ padding: 8 }}>
            <Input
              placeholder="Search AC-No"
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
      filteredValue: acNoFilter ? [acNoFilter] : null,
      onFilter: () => true,
      render: (acNos, record) => {
        if (!acNos || acNos.length === 0) return "-";

        return (
          <Space wrap>
            {acNos.map((code, index) => {
              // Find the corresponding employee name by index
              const employeeName =
                record.employees?.[index] || "Unknown Employee";

              if (employeeName === "Unknown Employee") {
                return (
                  <Tooltip
                    key={index}
                    title="Unknown Employee — please register this AC-No"
                  >
                    <Tag
                      color="red"
                      style={{ cursor: "default", whiteSpace: "nowrap" }}
                    >
                      {code}
                    </Tag>
                  </Tooltip>
                );
              }

              return (
                <Tooltip key={index} title={employeeName}>
                  <Tag
                    color={stringToColor(employeeName)}
                    style={{ cursor: "default", whiteSpace: "nowrap" }}
                  >
                    {code}
                  </Tag>
                </Tooltip>
              );
            })}
          </Space>
        );
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
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4}>Daily Time Record Logs</Title>
        </Col>
      </Row>

      <Row
        gutter={[16, 16]}
        align="middle"
        style={{
          marginBottom: 16,
          flexWrap: "nowrap", // prevents wrapping
        }}
      >
        {/* Filters Group */}
        <Col
          flex="auto"
          style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}
        >
          {/* Filter by Record Name */}
          <Space direction="vertical" style={{ fontSize: "12px" }}>
            <label style={{ fontSize: "12px" }}>
              <b>Select Biometrics Cut Off</b>
            </label>
            <Select
              size="small"
              value={recordNameFilter}
              onChange={(value) => setRecordNameFilter(value)}
              placeholder="Select DTR Record Name"
              allowClear
              style={{ minWidth: "180px" }}
            >
              {(recordNameOptions || []).map((option) => (
                <Select.Option key={option.value} value={option.value}>
                  {option.label}
                </Select.Option>
              ))}
            </Select>
          </Space>

          {/* Filter by State */}
          <Space direction="vertical" style={{ fontSize: "12px" }}>
            <label style={{ fontSize: "12px" }}>
              <b>Filter by Action (In/Out)</b>
            </label>
            <Select
              size="small"
              allowClear
              placeholder="Select State"
              value={stateFilter}
              onChange={setStateFilter}
              options={uniqueStates.map((state) => ({
                label: state,
                value: state,
              }))}
              style={{ minWidth: "150px" }}
            />
          </Space>

          {/* Cut Off Date Range */}
          <Space direction="vertical" style={{ fontSize: "12px" }}>
            <label style={{ fontSize: "12px" }}>
              <b>Cut Off Date Range</b>
            </label>
            <RangePicker
              size="small"
              value={cutOffDateRange}
              onChange={(dates) => setCutOffDateRange(dates)}
              allowEmpty={[true, true]}
              format="MM/DD/YYYY"
            />
          </Space>
        </Col>

        {/* Pagination Right-Aligned */}
        <Col
          flex="none"
          style={{ display: "flex", justifyContent: "flex-end" }}
        >
          <Pagination
            size="small"
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
            style={{ marginTop: "18px" }}
          />
        </Col>
      </Row>

      <Table
        columns={columns}
        size="small"
        loading={{
          spinning: loading,
          tip: "Loading DTR data...",
        }}
        dataSource={
          recordNameFilter
            ? filteredData.slice(
                (currentPage - 1) * pageSize,
                currentPage * pageSize
              ) || []
            : []
        }
        pagination={false} // <-- disable Table's built-in pagination
        rowKey={(record) => record.no}
        locale={{
          emptyText: !recordNameFilter
            ? "Please select a DTR Record Name from the dropdown above."
            : "No DTR logs found for the selected record.",
        }}
      />
    </>
  );
};

export default DTRLogs;

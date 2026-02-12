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
  Grid,
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
const { useBreakpoint } = Grid;

const LOCAL_TZ = "Asia/Manila";

const parseInLocalTz = (value) => {
  if (!value) return dayjs.invalid();
  if (dayjs.isDayjs && dayjs.isDayjs(value)) return value.tz(LOCAL_TZ);
  if (value instanceof Date || typeof value === "number") return dayjs(value).tz(LOCAL_TZ);
  const s = String(value);
  const hasZone = /([zZ]|[+-]\d{2}:\d{2})$/.test(s);
  return hasZone ? dayjs(s).tz(LOCAL_TZ) : dayjs.tz(s, LOCAL_TZ);
};

const toDayBoundsInTz = (start, end) => {
  if (!start || !end) return [null, null];
  const s = dayjs.isDayjs(start)
    ? dayjs.tz(start.format("YYYY-MM-DD"), LOCAL_TZ).startOf("day")
    : parseInLocalTz(start).startOf("day");
  const e = dayjs.isDayjs(end)
    ? dayjs.tz(end.format("YYYY-MM-DD"), LOCAL_TZ).endOf("day")
    : parseInLocalTz(end).endOf("day");
  if (!s.isValid() || !e.isValid()) return [null, null];
  return [s, e];
};

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

  const timeValue = (value) => {
    const dt = parseInLocalTz(value);
    return dt.isValid() ? dt.valueOf() : 0;
  };

  logs.forEach((log) => {
    const timeKey = parseInLocalTz(log.time).toISOString();
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

  // Sort ascending so ranges start at the first available working day/time
  const groupedArr = Array.from(map.values()).sort((a, b) => {
    const diff = timeValue(a.time) - timeValue(b.time);
    if (diff !== 0) return diff;
    return String(a.state || "").localeCompare(String(b.state || ""));
  });

  return groupedArr.map((item, idx) => ({ ...item, no: idx + 1 }));
};

const DTRLogs = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;   // < 768px
  const isTablet = screens.md && !screens.lg; // 768–991px
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
        setCutOffDateRange([null, null]);
        return;
      }
      try {
        setLoading(true);
        // Derive cutoff dates from the selected record (if present)
        const rec = dtrRecords.find((r) => r.DTR_Record_Name === recordNameFilter);
        const recStart = rec?.DTR_Cut_Off?.start ? parseInLocalTz(rec.DTR_Cut_Off.start) : null;
        const recEnd = rec?.DTR_Cut_Off?.end ? parseInLocalTz(rec.DTR_Cut_Off.end) : null;
        const startDate = recStart?.isValid() ? recStart.format("YYYY-MM-DD") : undefined;
        const endDate = recEnd?.isValid() ? recEnd.format("YYYY-MM-DD") : undefined;

        // Auto-fill Cut Off Date Range for accurate filtering context
        if (recStart?.isValid() && recEnd?.isValid()) {
          setCutOffDateRange([recStart.startOf("day"), recEnd.endOf("day")]);
        }
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
      const [startDate, endDate] = toDayBoundsInTz(start, end);
      if (!startDate || !endDate) return [];

      filtered = filtered.filter((log) => {
        if (!log.time) return false;
        const logDate = dayjs(log.time).tz(LOCAL_TZ);
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
        const logDate = dayjs(log.time).tz(LOCAL_TZ);
        if (!logDate.isValid()) return false;
        const target = dayjs.tz(dateFilter.format("YYYY-MM-DD"), LOCAL_TZ);
        return logDate.isSame(target, "day");
      });
    }

    // New: Filter by DTR_Record_Name (fallback to cutoff date range if missing linkage)
    if (recordNameFilter) {
      const rec = dtrRecords.find((r) => r.DTR_Record_Name === recordNameFilter);
      const recStart = rec?.DTR_Cut_Off?.start ? parseInLocalTz(rec.DTR_Cut_Off.start).startOf("day") : null;
      const recEnd = rec?.DTR_Cut_Off?.end ? parseInLocalTz(rec.DTR_Cut_Off.end).endOf("day") : null;
      filtered = filtered.filter((log) => {
        if (log.DTR_Record_Name === recordNameFilter) return true;
        if (!recStart || !recEnd || !log.time) return false;
        const dt = dayjs(log.time).tz(LOCAL_TZ);
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
    dtrRecords,
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
      width: 50,
      align: "center",
      onCell: () => ({ style: SMALL_FONT_STYLE }),
    },
    {
      title: isMobile ? "Date/Time" : "Date and Time",
      dataIndex: "time",
      key: "time",
      align: "center",
      width: isMobile ? 130 : 180,
      onCell: () => ({ style: SMALL_FONT_STYLE }),
      defaultSortOrder: "ascend",
      sorter: (a, b) => {
        const av = parseInLocalTz(a?.time);
        const bv = parseInLocalTz(b?.time);
        return (av.isValid() ? av.valueOf() : 0) - (bv.isValid() ? bv.valueOf() : 0);
      },
      sortDirections: ["ascend", "descend"],
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
        const date = parseInLocalTz(text);
        if (!date.isValid()) return text;
        return date.format("MM/DD/YYYY hh:mm A");
      },
    },
    ...(!isMobile
      ? [
          {
            title: "State",
            dataIndex: "state",
            key: "state",
            align: "center",
            width: 120,
            onCell: () => ({ style: SMALL_FONT_STYLE }),
          },
        ]
      : []),
    {
      title: isMobile ? "Bio Code" : "Biometrics Code",
      dataIndex: "acNos",
      key: "acNos",
      align: "center",
      width: isMobile ? 120 : 200,
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
      width: isMobile ? 200 : 400,

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
    ...(!isMobile
      ? [
          {
            title: "Remarks",
            dataIndex: "remarks",
            key: "remarks",
            align: "center",
            render: (text) => text || "-",
            onCell: () => ({ style: SMALL_FONT_STYLE }),
          },
        ]
      : []),
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
          flexWrap: "wrap",
        }}
      >
        {/* Filters Group */}
        <Col
          flex="auto"
          style={{ display: "flex", gap: isMobile ? "8px" : "16px", flexWrap: "wrap" }}
        >
          {/* Filter by Record Name */}
          <Space direction="vertical" style={{ fontSize: "12px" }}>
            <label style={{ fontSize: "12px" }}>
              <b>Select Biometrics Cut Off</b>
            </label>
            <Select
              size="small"
              value={recordNameFilter}
              onChange={(value) => {
                setRecordNameFilter(value);
                if (!value) {
                  setCutOffDateRange([null, null]);
                  return;
                }
                const rec = (dtrRecords || []).find(
                  (r) => r.DTR_Record_Name === value
                );
                const rs = rec?.DTR_Cut_Off?.start
                  ? parseInLocalTz(rec.DTR_Cut_Off.start)
                  : null;
                const re = rec?.DTR_Cut_Off?.end
                  ? parseInLocalTz(rec.DTR_Cut_Off.end)
                  : null;
                if (rs?.isValid() && re?.isValid()) {
                  setCutOffDateRange([rs.startOf("day"), re.endOf("day")]);
                }
              }}
              placeholder="Select DTR Record Name"
              allowClear
              style={{ minWidth: isMobile ? "100%" : "180px" }}
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
              style={{ minWidth: isMobile ? "100%" : "150px" }}
            />
          </Space>

          {/* Cut Off Date Range */}
          <Space direction="vertical" style={{ fontSize: "12px", width: isMobile ? '100%' : 'auto' }}>
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

      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <Table
        columns={columns}
        size="small"
        loading={{
          spinning: loading,
          tip: "Loading DTR data...",
        }}
        dataSource={recordNameFilter ? pagedData : []}
        pagination={false}
        rowKey={(record) => record.no}
        scroll={{ x: isMobile ? 600 : isTablet ? 800 : 1000 }}
        locale={{
          emptyText: !recordNameFilter
            ? "Please select a DTR Record Name from the dropdown above."
            : "No DTR logs found for the selected record.",
        }}
      />
      </div>
    </>
  );
};

export default DTRLogs;

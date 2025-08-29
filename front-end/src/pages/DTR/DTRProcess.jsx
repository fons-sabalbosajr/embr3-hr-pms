import React, { useEffect, useState, useRef } from "react";
import {
  Table,
  Typography,
  Spin,
  message,
  Input,
  Select,
  Space,
  Popover,
  Button,
  Dropdown,
  Menu,
  Drawer,
} from "antd";
import { EyeOutlined, PrinterOutlined, MenuOutlined } from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import "./dtr.css";
import ViewDTR from "./components/ViewDTR/ViewDTR";

const { Title } = Typography;
const { Search } = Input;

// Extend dayjs with the plugins
dayjs.extend(isSameOrBefore);
dayjs.extend(utc);
dayjs.extend(timezone);
const LOCAL_TZ = "Asia/Manila";

// States mapping for tooltip labels
const STATE_LABELS = {
  "C/In": "Time In",
  Out: "Break Out",
  "Out Back": "Break In",
  "C/Out": "Time Out",
};

const divisionAcronyms = {
  "Office of the Regional Director": "ORD",
  "Finance and Administrative Division": "FAD",
  "Environmental Monitoring and Enforcement Division": "EMED",
  "Clearance and Permitting Division": "CPD",
};

const sectionUnitAcronyms = {
  CPD: {
    "Air and Water Permitting Section": "AIR & WATER",
    "Environment Impact Assessment Section": "EIA",
    "Chemicals and Hazardous Waste Permitting Section": "CHWMS",
  },
  FAD: {
    "Budget Unit": "BUDGET",
    "Cashier Unit": "CASHIER",
    "Finance Section": "FINANCE",
    "Personnel Unit": "PERSONNEL",
    "Property and General Services Unit": "PGSU",
    "Records Unit": "RECORDS",
  },
  ORD: {
    "Environmental Education and Information Unit": "EEIU",
    "Environmental Laboratory Unit": "LABORATORY",
    "Legal Services Unit": "LSU",
    "Manila Bay Unit": "MBU",
    "Planning and Information System Management Unit": "PISMU",
    "Provincial Environmental Management Unit": "PEMU", // note: multiple PEMUs by location; handle if needed
  },
  Specialized: {
    "Commision on Audit": "COA",
  },
};

const DTRProcess = () => {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [empTypeFilter, setEmpTypeFilter] = useState("");
  const [dtrLogs, setDtrLogs] = useState({});
  const [dtrRecords, setDtrRecords] = useState([]);
  const [selectedDtrRecord, setSelectedDtrRecord] = useState("");
  const [drawerVisible, setDrawerVisible] = useState(false);
  const containerRef = useRef(null);
  const [viewDTRVisible, setViewDTRVisible] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/employees`
      );
      const sortedData = sortEmployees(res.data);
      setEmployees(sortedData);
      setFilteredEmployees(sortedData);

      // After employees, fetch DTR logs for this month (or needed date range)
      await fetchDtrLogs(sortedData);
    } catch (err) {
      console.error("Failed to fetch employees:", err);
      message.error("Unable to load employees");
    } finally {
      setLoading(false);
    }
  };

  const fetchDtrLogs = async (employees) => {
    try {
      setLoading(true);

      // Extract all AC-No from employees (you may want to map empId to AC-No, adjust if needed)
      const acNos = employees
        .map((emp) => {
          // Assuming emp.empId like "03-718", get last 4 digits for filtering
          if (!emp.empId) return null;
          const digits = emp.empId.replace(/\D/g, "");
          return digits.slice(-4);
        })
        .filter(Boolean);

      // Fetch logs for current month (adjust dates as needed)
      const startOfMonth = dayjs().startOf("month").format("YYYY-MM-DD");
      const endOfMonth = dayjs().endOf("month").format("YYYY-MM-DD");

      // Query your backend for logs by AC-No and date range (you may need to extend your API)
      const res = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/dtrlogs/merged`,
        {
          params: {
            acNo: acNos.join(","), // assuming your API supports multiple AC-No separated by commas, else batch calls
            startDate: startOfMonth,
            endDate: endOfMonth,
          },
        }
      );

      if (!res.data.success) {
        message.error("Failed to load DTR logs");
        return;
      }

      // Process logs into structured object for fast lookup
      const logs = res.data.data; // your merged logs array
      const logsByEmpDay = {};

      logs.forEach((log) => {
        // Extract employee id key (using empId from matchedEmployee or fallback)
        const empIdKey = log.employeeName
          ? employees.find((e) => e.name === log.employeeName)?.empId ||
            log.acNo
          : log.acNo;

        if (!empIdKey) return;

        // Format date key YYYY-MM-DD based on log.time
        const dateKey = dayjs(log.time).format("YYYY-MM-DD");

        if (!logsByEmpDay[empIdKey]) logsByEmpDay[empIdKey] = {};
        if (!logsByEmpDay[empIdKey][dateKey]) {
          logsByEmpDay[empIdKey][dateKey] = {
            "Time In": null,
            "Break Out": null,
            "Break In": null,
            "Time Out": null,
          };
        }

        // Map State to label and save time
        const stateLabel = STATE_LABELS[log.state];
        if (stateLabel) {
          logsByEmpDay[empIdKey][dateKey][stateLabel] = dayjs(log.time).format(
            "hh:mm A"
          );
        }
      });

      setDtrLogs(logsByEmpDay);
    } catch (error) {
      console.error("Failed to fetch DTR logs:", error);
      message.error("Error loading DTR logs");
    } finally {
      setLoading(false);
    }
  };

  const fetchDtrLogsByRecord = async (selectedRecord, employees) => {
    if (!selectedRecord || !employees.length) return;

    try {
      setLoading(true);

      // Extract last 4 digits from empId as AC-No for filtering
      const acNos = employees
        .map((emp) => {
          if (!emp.empId) return null;
          const acNoDigits = String(emp.acNo).replace(/\D/g, "");
          const empKey = acNoDigits.slice(-4); // this must match empKey in renderDTRDays
        })
        .filter(Boolean);

      const res = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/dtrlogs/merged`,
        {
          params: {
            recordName: selectedRecord.DTR_Record_Name,
            acNo: acNos.join(","),
          },
        }
      );

      if (!res.data.success) {
        message.error("Failed to load DTR logs");
        setDtrLogs({});
        return;
      }

      const logsByEmpDay = {};

      res.data.data.forEach((log) => {
        // Always use last 4 digits of AC-No for key
        const acNoDigits = String(log.acNo).replace(/\D/g, "");
        const empKey = acNoDigits.slice(-4);

        // Format date key YYYY-MM-DD based on log.time
        const dateKey = dayjs(log.time).tz(LOCAL_TZ).format("YYYY-MM-DD");

        if (!logsByEmpDay[empKey]) logsByEmpDay[empKey] = {};
        if (!logsByEmpDay[empKey][dateKey]) {
          logsByEmpDay[empKey][dateKey] = {
            "Time In": null,
            "Break Out": null,
            "Break In": null,
            "Time Out": null,
          };
        }

        // Map State to label and save time
        const stateLabel = STATE_LABELS[log.state];
        if (stateLabel) {
          logsByEmpDay[empKey][dateKey][stateLabel] = dayjs(log.time)
            .tz(LOCAL_TZ)
            .format("hh:mm A");
        }
      });

      setDtrLogs(logsByEmpDay);
    } catch (error) {
      console.error("Failed to fetch DTR logs:", error);
      message.error("Error loading DTR logs");
      setDtrLogs({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    const fetchDtrRecords = async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/dtrdatas`
        );
        setDtrRecords(res.data.data); // use .data.data based on your backend response
      } catch (err) {
        message.error("Unable to load DTR records");
      }
    };
    fetchDtrRecords();
  }, []);

  const sortEmployees = (data) => {
    return [...data].sort((a, b) => {
      const empTypeOrder = {
        "Contract of Service": 1,
        Regular: 2,
      };
      const typeA = empTypeOrder[a.empType] || 99;
      const typeB = empTypeOrder[b.empType] || 99;
      if (typeA !== typeB) return typeA - typeB;

      const numA = extractNumberFromEmpNo(a.empNo);
      const numB = extractNumberFromEmpNo(b.empNo);
      return numA - numB;
    });
  };

  const extractNumberFromEmpNo = (empNo) => {
    if (!empNo) return 0;
    const match = empNo.match(/\d+$/);
    return match ? parseInt(match[0], 10) : 0;
  };

  useEffect(() => {
    let data = sortEmployees(employees);

    if (searchText) {
      data = data.filter(
        (emp) =>
          emp.name?.toLowerCase().includes(searchText.toLowerCase()) ||
          emp.empNo?.toLowerCase().includes(searchText.toLowerCase()) ||
          emp.empId?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    if (empTypeFilter) {
      data = data.filter((emp) => emp.empType === empTypeFilter);
    }

    setFilteredEmployees(sortEmployees(data));
  }, [searchText, empTypeFilter, employees]);

  const selectedRecord = dtrRecords.find(
    (rec) => rec.DTR_Record_Name === selectedDtrRecord
  );

  // dtrDays generation updated:
  let dtrDays = [];

  if (
    selectedRecord &&
    selectedRecord.DTR_Cut_Off?.start &&
    selectedRecord.DTR_Cut_Off?.end
  ) {
    const start = dayjs.tz(selectedRecord.DTR_Cut_Off.start, LOCAL_TZ);
    const end = dayjs.tz(selectedRecord.DTR_Cut_Off.end, LOCAL_TZ);

    if (!start.isValid() || !end.isValid()) {
      console.error(
        "Invalid DTR_Cut_Off dates:",
        selectedRecord.DTR_Cut_Off.start,
        selectedRecord.DTR_Cut_Off.end
      );
      dtrDays = [];
    } else {
      let curr = start.clone();
      while (curr.isSameOrBefore(end, "day")) {
        dtrDays.push(curr.date());
        curr = curr.add(1, "day");
      }
    }
  }

  useEffect(() => {
    if (selectedRecord && employees.length) {
      fetchDtrLogsByRecord(selectedRecord, employees);
    } else {
      setDtrLogs({});
    }
  }, [selectedRecord, employees]);

  const getEmployeeDayLogs = (emp, dayKey) => {
    const ids = [emp.empId, ...(emp.alternateEmpIds || [])].filter(Boolean);

    for (let id of ids) {
      const empKey = id.replace(/\D/g, "").slice(-4);
      if (dtrLogs[empKey] && dtrLogs[empKey][dayKey]) {
        return dtrLogs[empKey][dayKey];
      }
    }
    return null;
  };

  const hasAnyDTRLogs = (emp, dtrDays, dtrLogs, selectedRecord) => {
    const ids = [emp.empId, ...(emp.alternateEmpIds || [])].filter(Boolean);

    return ids.some((id) => {
      const empKey = id.replace(/\D/g, "").slice(-4);

      return dtrDays.some((dayNum) => {
        const dateKey = dayjs(selectedRecord.DTR_Cut_Off.start)
          .date(dayNum)
          .format("YYYY-MM-DD");
        const dayLogs =
          dtrLogs[empKey] && dtrLogs[empKey][dateKey]
            ? dtrLogs[empKey][dateKey]
            : null;

        return dayLogs && Object.values(dayLogs).some((v) => v);
      });
    });
  };

  const renderDTRDays = (days, emp) => {
    return (
      <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>
        {days.map((dayNum) => {
          const dateObj = dayjs(selectedRecord.DTR_Cut_Off.start).date(dayNum);
          const dateKey = dateObj.format("YYYY-MM-DD");

          const dayLogs = getEmployeeDayLogs(emp, dateKey);
          const hasLogs = dayLogs && Object.values(dayLogs).some((v) => v);

          const dayOfWeek = dateObj.day();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          const weekendBg = "#ffe6e6";
          const workedWeekendStyle = {
            border: "2px solid #fa541c",
            backgroundColor: "#fff2e8",
          };

          const tileStyle = {
            width: 45,
            minHeight: 35,
            background: isWeekend ? weekendBg : hasLogs ? "#d6f5d6" : "#f1f1f1", // red for missing
            border: "1px solid #d9d9d9",
            borderRadius: 4,
            padding: 4,
            fontSize: 10,
            color: "#000",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 2,
            textAlign: "center",
            whiteSpace: "nowrap",
            fontWeight: hasLogs ? "600" : "normal",
            cursor: hasLogs ? "pointer" : "default",
            ...(isWeekend && hasLogs ? workedWeekendStyle : {}),
          };

          const popoverContent = dayLogs ? (
            <div style={{ fontSize: 12, lineHeight: 1.5 }}>
              {Object.entries(dayLogs)
                .filter(([_, time]) => time)
                .map(([label, time]) => (
                  <div key={label}>
                    <strong>{label}:</strong> {time}
                  </div>
                ))}
            </div>
          ) : (
            <div style={{ color: "#bbb", fontSize: 11 }}>No Data</div>
          );

          return (
            <Popover
              key={dayNum}
              content={popoverContent}
              trigger="hover"
              placement="top"
            >
              <div style={tileStyle}>
                <div
                  style={{ fontWeight: "bold", fontSize: 11, marginBottom: 4 }}
                  title={`Day ${dayNum}`}
                >
                  {dayNum}
                  <div
                    style={{
                      fontWeight: "normal",
                      fontSize: 10,
                      color: "#555",
                    }}
                  >
                    {dateObj.format("ddd")}
                  </div>
                </div>
              </div>
            </Popover>
          );
        })}
      </div>
    );
  };

  const getDTRHeaderTitle = () => {
    if (
      selectedRecord &&
      selectedRecord.DTR_Cut_Off?.start &&
      selectedRecord.DTR_Cut_Off?.end
    ) {
      const start = dayjs(selectedRecord.DTR_Cut_Off.start);
      const end = dayjs(selectedRecord.DTR_Cut_Off.end);

      if (start.isValid() && end.isValid()) {
        // Format start day and end day
        // Also format month name from start date
        const monthName = start.format("MMMM"); // e.g. July
        const startDay = start.date(); // 16
        const endDay = end.date(); // 31

        return `Daily Time Record (${monthName} ${startDay}-${endDay} Cut Off)`;
      }
    }
    return "Daily Time Record";
  };

  const handleViewDTR = (employee) => {
    setSelectedEmployee(employee);
    setViewDTRVisible(true);
  };

  const handlePrintSelected = (employee) => {
    console.log("Print selected for:", employee);
    // TODO: implement print selected employee logic
  };

  const handleAddToPrinterTray = (employee) => {
    console.log("Add to printer tray:", employee);
    // TODO: implement add to tray logic
  };

  const printMenu = (employee) => (
    <Menu>
      <Menu.Item
        key="printSelected"
        onClick={() => handlePrintSelected(employee)}
      >
        Print Selected
      </Menu.Item>
      <Menu.Item
        key="addToTray"
        onClick={() => handleAddToPrinterTray(employee)}
      >
        Add to Printer Tray
      </Menu.Item>
    </Menu>
  );

  const columnsBase = [
    {
      title: "Employee No / Type",
      key: "empNoType",
      width: 150,
      render: (_, record) => {
        const color = record.empType === "Regular" ? "#389e0d" : "#fa8c16";
        return (
          <div style={{ width: 150, minWidth: 150, maxWidth: 150 }}>
            <div style={{ fontWeight: "bold", fontSize: "14px", color }}>
              {record.empNo}
            </div>
            <div style={{ fontSize: "12px", color, fontWeight: 500 }}>
              {record.empType}
            </div>
          </div>
        );
      },
    },
    {
      title: "Name / Position",
      key: "namePosition",
      width: 250,
      render: (_, record) => {
        // Convert Division full name to acronym
        const divisionAcronym =
          divisionAcronyms[record.division] || record.division;

        // Get Section/Unit acronym based on Division
        let sectionAcronym = "";
        if (record.division && sectionUnitAcronyms[divisionAcronym]) {
          sectionAcronym =
            sectionUnitAcronyms[divisionAcronym][record.sectionOrUnit] ||
            record.sectionOrUnit;
        } else {
          sectionAcronym = record.sectionOrUnit || "";
        }

        return (
          <div style={{ width: 250, minWidth: 250, maxWidth: 250 }}>
            <strong>{record.name}</strong>
            {record.position && (
              <div style={{ fontSize: "12px", color: "#888" }}>
                {record.position}
              </div>
            )}
            {(record.division || record.sectionOrUnit) && (
              <div style={{ fontSize: "12px", color: "#666" }}>
                {divisionAcronym} {sectionAcronym && `| ${sectionAcronym}`}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Employee ID",
      dataIndex: "empId",
      key: "empId",
      width: 100,
      render: (_, record) => {
        // Combine main empId + alternateEmpIds (if any)
        const ids = [record.empId, ...(record.alternateEmpIds || [])]
          .filter(Boolean)
          .join(", ");

        return (
          <div style={{ width: 100, minWidth: 100, maxWidth: 100 }}>{ids}</div>
        );
      },
    },
    {
      title: "AC-No",
      key: "acNo",
      width: 100,
      render: (_, record) => {
        // Extract last 4 digits of empId as AC-No
        const acNo = record.empId
          ? record.empId.replace(/\D/g, "").slice(-4)
          : "";
        return (
          <div style={{ width: 100, minWidth: 100, maxWidth: 100 }}>{acNo}</div>
        );
      },
    },
    {
      title: getDTRHeaderTitle(),
      key: "dailyTimeRecord",
      width: 500,
      render: (_, record) =>
        dtrDays.length > 0 ? (
          renderDTRDays(dtrDays, record)
        ) : (
          <span style={{ color: "#888" }}>Select DTR Record</span>
        ),
    },
  ];

  const actionsColumn = {
    title: "Actions",
    key: "actions",
    width: 100,
    render: (_, record) => (
      <Space size="middle">
        <Button
          type="primary"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewDTR(record)}
          style={{ fontSize: 12 }}
        />
        <Dropdown overlay={printMenu(record)} trigger={["click"]}>
          <Button
            type="default"
            size="small"
            icon={<PrinterOutlined />}
            style={{ fontSize: 12 }}
          />
        </Dropdown>
      </Space>
    ),
  };

  // Columns with or without actions based on selectedDtrRecord
  const columns = selectedDtrRecord
    ? [...columnsBase, actionsColumn]
    : columnsBase;

  const empTypeOptions = [
    ...new Set(employees.map((emp) => emp.empType).filter(Boolean)),
  ]
    .sort((a, b) => a.localeCompare(b))
    .map((type) => ({ label: type, value: type }));

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <Space
        style={{
          marginBottom: 16,
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <Title level={3}>Process Daily Time Records</Title>
        <Button
          icon={<MenuOutlined />}
          type="primary"
          onClick={() => setDrawerVisible(true)}
        >
          Open Printer Tray
        </Button>
      </Space>

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="Select a biometrics cut off"
          style={{ width: 220 }}
          value={selectedDtrRecord}
          onChange={setSelectedDtrRecord}
          options={dtrRecords.map((rec) => ({
            label: rec.DTR_Record_Name,
            value: rec.DTR_Record_Name,
          }))}
          allowClear
        />
        <Search
          placeholder="Search by name, empNo, empId"
          allowClear
          onSearch={(value) => setSearchText(value)}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 250 }}
        />
        <Select
          placeholder="Filter by Employee Type"
          allowClear
          options={empTypeOptions}
          style={{ width: 200 }}
          onChange={(value) => setEmpTypeFilter(value || "")}
        />
      </Space>

      {/* Warning / filter for missing DTR */}
      {selectedDtrRecord && (
        <Space style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            style={{ marginLeft: 8 }}
            danger
            onClick={() => {
              if (!selectedRecord) return;

              const missing = employees.filter(
                (emp) => !hasAnyDTRLogs(emp, dtrDays, dtrLogs, selectedRecord)
              );

              setFilteredEmployees(missing);
              message.warning(
                `Showing ${missing.length} employees with no DTR at all`
              );
            }}
          >
            ⚠️ Show Missing DTR (
            {
              // total count using alternateEmpIds
              employees.filter(
                (emp) => !hasAnyDTRLogs(emp, dtrDays, dtrLogs, selectedRecord)
              ).length
            }
            )
          </Button>

          <Button
            type="text"
            onClick={() => {
              setFilteredEmployees(sortEmployees(employees));
            }}
          >
            Reset Filter
          </Button>
        </Space>
      )}

      {loading ? (
        <Spin size="large" />
      ) : (
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={filteredEmployees}
          bordered
          pagination={{ pageSize: 10 }}
          className="custom-small-table"
          scroll={{ x: 1000 }}
          rowClassName={(record) =>
            !hasAnyDTRLogs(record, dtrDays, dtrLogs, selectedRecord)
              ? "missing-dtr-row"
              : ""
          }
        />
      )}

      <Drawer
        title="Print Daily Time Records"
        placement="right"
        width={350}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        getContainer={false} // Render inside parent container
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          height: "100%",
          boxShadow: "-3px 0 10px 3px rgba(0, 0, 0, 0.12)", // softer, larger, lighter shadow
          borderRadius: "12px", // more rounded corners
          zIndex: 1000,
        }}
      >
        {/* Drawer content */}
        <p>Put controls or info here</p>
      </Drawer>

      {selectedEmployee && (
        <ViewDTR
          visible={viewDTRVisible}
          onClose={() => setViewDTRVisible(false)}
          employee={selectedEmployee}
          dtrDays={dtrDays}
          dtrLogs={dtrLogs}
          selectedRecord={selectedRecord}
        />
      )}
    </div>
  );
};

export default DTRProcess;

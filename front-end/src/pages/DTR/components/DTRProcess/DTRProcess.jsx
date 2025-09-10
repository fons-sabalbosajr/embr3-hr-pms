import React, { useEffect, useState, useRef } from "react";
import {
  Typography,
  Spin,
  message,
  Space,
  Button,
  Dropdown,
  Menu,
  Tag,
  Badge,
} from "antd";
import { EyeOutlined, PrinterOutlined, MenuOutlined } from "@ant-design/icons";
import DTRFilters from "../DTRProcess/components/DTRFilters";
import DTRTable from "../DTRProcess/components/DTRTable";
import PrinterTrayDrawer from "../DTRProcess/components/DTRTrayDrawer";
import ViewDTR from "../ViewDTR/ViewDTR";
import DTRDayTiles from "../DTRProcess/components/DTRDayTiles";
import { fetchPhilippineHolidays } from "../../../../api/holidayPH";
import {
  generateDTRPdf,
  generateBatchDTRPdf,
} from "../../../../../utils/generateDTRpdf";
import "./dtr.css";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import axiosInstance from "../../../../api/axiosInstance";
import axios from "axios";

const { Title } = Typography;

// Extend dayjs with the plugins
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
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

const divisionColors = {
  "Clearance and Permitting Division": "#1f9cca", // blue
  "Finance and Administrative Division": "#283539", // green
  "Environmental Monitoring and Enforcement Division": "#009d8c", // orange
  "Office of the Regional Director": "#cb330e", // pink/red
  "Specialized Team": "#fd8004",
};

const sectionUnitAcronyms = {
  CPD: {
    "Air and Water Permitting Section": "AIR & WATER",
    "Environmental Impact Assessment Section": "EIA",
    "Chemical and Hazardous Waste Permitting Section": "CHWMS",
  },
  FAD: {
    "Budget Unit": "BUDGET",
    "Cashier Unit": "CASHIER",
    "Finance Section": "FINANCE",
    "Personnel Unit": "PERSONNEL",
    "Property and General Services Unit": "PGSU",
    "Records Unit": "RECORDS",
  },
  EMED: {
    "Ecological Solid Waste Management Section": "ESWM",
    "Air, Water and ECC Compliance Monitoring and Enforcement Section":
      "AWECMES",
    "Ambient Monitoring and Technical Services Section": "AMTSS",
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
    "Commission On Audit": "COA",
  },
};

const DTRProcess = ({ currentUser }) => {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [empTypeFilter, setEmpTypeFilter] = useState("");
  const [sectionOrUnitFilter, setSectionOrUnitFilter] = useState("");
  const [dtrLogs, setDtrLogs] = useState({});
  const [dtrRecords, setDtrRecords] = useState([]);
  const [selectedDtrRecord, setSelectedDtrRecord] = useState("");
  const [drawerVisible, setDrawerVisible] = useState(false);
  const containerRef = useRef(null);
  const [viewDTRVisible, setViewDTRVisible] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [printerTray, setPrinterTray] = useState([]);
  const [holidaysPH, setHolidaysPH] = useState([]);
  const [employeeTrainings, setEmployeeTrainings] = useState({});

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

      const employeeNames = employees.map((emp) => emp.name).filter(Boolean);

      // Fetch logs for current month (adjust dates as needed)
      const startOfMonth = dayjs().startOf("month").format("YYYY-MM-DD");
      const endOfMonth = dayjs().endOf("month").format("YYYY-MM-DD");

      // Query your backend for logs by AC-No and date range (you may need to extend your API)
      const res = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/dtrlogs/merged`,
        {
          params: {
            names: employeeNames.join(","), // assuming your API supports multiple AC-No separated by commas, else batch calls
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
        if (!log.empId) return; // Skip logs that couldn't be matched to an employee

        const empKey = log.empId; // Use empId as the key

        // Format date key
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
    } finally {
      setLoading(false);
    }
  };

  const fetchDtrLogsByRecord = async (selectedRecord, employees) => {
    if (!selectedRecord || !employees.length) return;

    try {
      setLoading(true);

      const employeeNames = employees.map((emp) => emp.name).filter(Boolean);

      const res = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/dtrlogs/merged`,
        {
          params: {
            recordName: selectedRecord.DTR_Record_Name,
            names: employeeNames.join(","),
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
        if (!log.empId) return; // Skip logs that couldn't be matched to an employee

        const empKey = log.empId; // Use empId as the key

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

    if (sectionOrUnitFilter) {
      data = data.filter((emp) =>
        emp.sectionOrUnit
          ?.toLowerCase()
          .includes(sectionOrUnitFilter.toLowerCase())
      );
    }

    setFilteredEmployees(sortEmployees(data));
  }, [searchText, empTypeFilter, sectionOrUnitFilter, employees]);

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
      const recordName = selectedRecord.DTR_Record_Name || "";
      if (recordName.includes("1-15")) {
        dtrDays = Array.from({ length: 15 }, (_, i) => i + 1);
      } else if (recordName.includes("16-")) {
        const endOfMonth = start.endOf("month").date();
        const numDays = endOfMonth - 16 + 1;
        dtrDays = Array.from({ length: numDays }, (_, i) => i + 16);
      } else {
        // Fallback to original behavior
        let curr = start.clone();
        while (curr.isSameOrBefore(end, "day")) {
          dtrDays.push(curr.date());
          curr = curr.add(1, "day");
        }
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

  useEffect(() => {
    async function getHolidays() {
      if (
        selectedRecord &&
        selectedRecord.DTR_Cut_Off?.start &&
        selectedRecord.DTR_Cut_Off?.end
      ) {
        const start = dayjs(selectedRecord.DTR_Cut_Off.start);
        const end = dayjs(selectedRecord.DTR_Cut_Off.end);
        const year = start.year();
        const holidays = await fetchPhilippineHolidays(year);
        // Filter holidays within cut-off
        const filtered = holidays
          .filter((h) => {
            const hDate = dayjs(h.date);
            return (
              hDate.isSameOrAfter(start, "day") &&
              hDate.isSameOrBefore(end, "day")
            );
          })
          .map((h) => ({
            date: h.date,
            name: h.localName,
            type: h.type,
          }));
        setHolidaysPH(filtered);
      } else {
        setHolidaysPH([]);
      }
    }
    getHolidays();
  }, [selectedRecord]);

  useEffect(() => {
    async function fetchTrainingsForEmployees() {
      if (!employees.length) return;
      const trainingsByEmp = {};
      for (const emp of employees) {
        try {
          // Adjust API path if needed
          const res = await axios.get(
            `${import.meta.env.VITE_API_BASE_URL}/trainings/by-employee/${
              emp.empId
            }`
          );
          trainingsByEmp[emp.empId] = res.data.data || [];
        } catch {
          trainingsByEmp[emp.empId] = [];
        }
      }
      setEmployeeTrainings(trainingsByEmp);
    }
    fetchTrainingsForEmployees();
  }, [employees, selectedRecord]);

  const hasAnyDTRLogs = (emp, dtrDays, dtrLogs, selectedRecord) => {
    const empKey = emp.empId;
    if (!dtrLogs[empKey]) return false;

    return dtrDays.some((dayNum) => {
      const dateKey = dayjs(selectedRecord.DTR_Cut_Off.start)
        .date(dayNum)
        .format("YYYY-MM-DD");
      const dayLogs = dtrLogs[empKey][dateKey];
      return dayLogs && Object.values(dayLogs).some((v) => v);
    });
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

  //Refactored logDTRRecord
  const logDTRRecord = async (employee, selectedRecord, currentUser) => {
    if (!employee?.empId || !selectedRecord) return;

    const cutOff = `${dayjs(selectedRecord.DTR_Cut_Off.start).format(
      "MMMM DD, YYYY"
    )}-${dayjs(selectedRecord.DTR_Cut_Off.end).format("MMMM DD, YYYY")}`;

    const payload = {
      empId: employee.empId,
      docType: "DTR",
      reference: selectedRecord.DTR_Record_Name || "DTR Record",
      period: cutOff,
      description: `DTR for ${cutOff}`,
      createdBy: currentUser?.name || "HR",
      dateIssued: new Date(),
    };

    try {
      // 1️⃣ Fetch existing DTR docs for this employee
      const existingRes = await axiosInstance.get(
        `/employee-docs/by-employee/${employee.empId}`
      );

      const existingDocs = existingRes.data?.data || [];

      // 2️⃣ Check if this exact DTR already exists
      const isDuplicate = existingDocs.some(
        (doc) =>
          doc.docType === payload.docType &&
          doc.reference === payload.reference &&
          doc.period === payload.period
      );

      if (isDuplicate) {
        // console.log(
        //   `DTR already logged for ${employee.name} (${cutOff}). Skipping duplicate.`
        // );
        return; // skip creating duplicate
      }

      // 3️⃣ If not duplicate, create new document
      //console.log("Creating new DTR doc:", payload);
      const res = await axiosInstance.post("/employee-docs", payload);
      //console.log("Create response:", res.data);

      if (res.data?.success) {
        //console.log(`DTR logged successfully for ${employee.name}`);
      } else {
        console.error("Failed to log DTR record:", res.data);
      }
    } catch (err) {
      console.error(
        "Failed to log DTR record:",
        err.response?.data || err.message
      );
    }
  };

  // View single DTR (opens in new tab)
  const handleViewDTRPdf = (item) => {
    generateDTRPdf(item); // view in new tab
  };

  // Download single DTR
  const handleDownloadDTR = async (item) => {
    if (!item || !item.employee || !item.selectedRecord) return;

    try {
      // 1️⃣ Generate PDF
      const pdfBlob = await generateDTRPdf({ ...item, download: true });

      const cutOff = `${dayjs(item.selectedRecord.DTR_Cut_Off.start).format(
        "MMMM DD, YYYY"
      )}-${dayjs(item.selectedRecord.DTR_Cut_Off.end).format("MMMM DD, YYYY")}`;

      // 2️⃣ Trigger browser download
      const link = document.createElement("a");
      link.href = URL.createObjectURL(pdfBlob);
      link.download = `DTR_${item.employee.name}_${cutOff}.pdf`;
      link.click();

      // 3️⃣ Log the DTR (centralized)
      await logDTRRecord(item.employee, item.selectedRecord, currentUser);
    } catch (err) {
      console.error("Error downloading/logging DTR:", err);
      message.error("Failed to download or log DTR");
    }
  };

  // Download all DTRs in printerTray and log each DTR
  const handleDownloadAllDTRs = async () => {
    if (!printerTray.length) {
      message.warning("Printer tray is empty");
      return;
    }

    try {
      // 1️⃣ Generate batch PDF
      await generateBatchDTRPdf(printerTray);
      message.success("Batch DTR PDF downloaded.");

      // 2️⃣ Log each employee's DTR after batch download
      for (const item of printerTray) {
        const { employee, selectedRecord } = item;
        if (!employee || !selectedRecord) continue;

        try {
          await logDTRRecord(employee, selectedRecord, currentUser);
        } catch (err) {
          console.error(
            `Failed to log DTR for ${employee.name}:`,
            err.response?.data || err.message
          );
        }
      }

      message.success("All DTRs logged successfully.");
    } catch (err) {
      console.error("Failed to download or log batch DTRs:", err);
      message.error("Failed to download or log batch DTRs.");
    }
  };

  // Print selected employee DTR
  const handlePrintSelected = async (item) => {
    if (!item || !item.selectedRecord) return;

    const { employee, dtrDays, dtrLogs, selectedRecord } = item;

    try {
      const pdfBlob = await generateDTRPdf({
        employee,
        dtrDays,
        dtrLogs,
        selectedRecord,
        download: true,
      });

      const pdfUrl = URL.createObjectURL(pdfBlob);
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = pdfUrl;
      document.body.appendChild(iframe);

      iframe.onload = async () => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();

        // Log the DTR after printing
        await logDTRRecord(employee, selectedRecord, currentUser);
      };
    } catch (err) {
      console.error("Failed to print/log DTR:", err);
      message.error("Failed to print DTR");
    }
  };

  const handleAddToPrinterTray = (employee) => {
    setPrinterTray((prev) => {
      // Avoid duplicates by empId and selectedRecord
      const exists = prev.some(
        (item) =>
          item.employee.empId === employee.empId &&
          item.selectedRecord.DTR_Record_Name === selectedRecord.DTR_Record_Name
      );
      if (exists) return prev;
      return [
        ...prev,
        {
          employee,
          dtrDays,
          dtrLogs,
          selectedRecord,
        },
      ];
    });

    message.success(`${employee.name} DTR added to Printer Tray.`);
  };

  const handleClearPrinterTray = () => {
    setPrinterTray([]);
    message.success("Printer Tray cleared.");
  };

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
      width: 70,
      align: "center",
      render: (_, record) => {
        // Combine main empId + alternateEmpIds (if any)
        const ids = [record.empId, ...(record.alternateEmpIds || [])]
          .filter(Boolean)
          .join(", ");

        return (
          <div style={{ width: 70, minWidth: 70, maxWidth: 70 }}>{ids}</div>
        );
      },
    },
    {
      title: "Biometrics No.",
      key: "acNo",
      width: 50,
      align: "center",
      render: (_, record) => {
        // Extract last 4 digits of empId as AC-No
        const acNo = record.empId
          ? record.empId.replace(/\D/g, "").slice(-4)
          : "";
        return (
          <div style={{ width: 50, minWidth: 50, maxWidth: 50 }}>{acNo}</div>
        );
      },
    },
    {
      title: getDTRHeaderTitle(),
      key: "dailyTimeRecord",
      width: 500,
      render: (_, record) =>
        dtrDays.length > 0 ? (
          <DTRDayTiles
            days={dtrDays}
            emp={record}
            selectedRecord={selectedRecord}
            divisionColors={divisionColors}
            divisionAcronyms={divisionAcronyms}
            holidaysPH={holidaysPH}
            getEmployeeDayLogs={(emp, dateKey) => {
              const empKey = emp.empId;
              return dtrLogs[empKey]?.[dateKey] || null;
            }}
            getTrainingDetailsOnDay={(emp, dateKey) => {
              const trainings = employeeTrainings[emp.empId] || [];
              return trainings.find((t) =>
                dayjs(dateKey).isBetween(
                  dayjs(t.trainingDate[0]),
                  dayjs(t.trainingDate[1]),
                  null,
                  "[]"
                )
              );
            }}
          />
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

        <Button
          type="default"
          size="small"
          icon={<PrinterOutlined />}
          onClick={() => handleAddToPrinterTray(record)}
          style={{ fontSize: 12 }}
        />
      </Space>
    ),
  };

  const columns = selectedDtrRecord
    ? [...columnsBase, actionsColumn]
    : columnsBase;

  const empTypeOptions = [
    ...new Set(employees.map((emp) => emp.empType).filter(Boolean)),
  ]
    .sort((a, b) => a.localeCompare(b))
    .map((type) => ({ label: type, value: type }));

  const handlePreviewForm48 = (employee, record) => {
    generateDTRPdf({
      employee,
      dtrDays,
      dtrLogs,
      selectedRecord: record,
    });
  };

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

        <Badge count={printerTray.length} overflowCount={99}>
          <Button
            icon={<MenuOutlined />}
            type="primary"
            onClick={() => setDrawerVisible(true)}
          >
            Open Printer Tray
          </Button>
        </Badge>
      </Space>

      <DTRFilters
        selectedDtrRecord={selectedDtrRecord}
        setSelectedDtrRecord={setSelectedDtrRecord}
        dtrRecords={dtrRecords}
        searchText={searchText}
        setSearchText={setSearchText}
        empTypeFilter={empTypeFilter}
        setEmpTypeFilter={setEmpTypeFilter}
        empTypeOptions={empTypeOptions}
        sectionOrUnitFilter={sectionOrUnitFilter}
        setSectionOrUnitFilter={setSectionOrUnitFilter}
      />

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
              employees.filter(
                (emp) => !hasAnyDTRLogs(emp, dtrDays, dtrLogs, selectedRecord)
              ).length
            }
            )
          </Button>
          <Button
            type="primary"
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
        <DTRTable
          columns={columns}
          dataSource={filteredEmployees}
          dtrDays={dtrDays}
          dtrLogs={dtrLogs}
          selectedRecord={selectedRecord}
          hasAnyDTRLogs={hasAnyDTRLogs}
          handleViewDTR={handleViewDTR}
          handlePrintSelected={handlePrintSelected}
          handleAddToPrinterTray={handleAddToPrinterTray}
          selectedDtrRecord={selectedDtrRecord}
        />
      )}

      <PrinterTrayDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        printerTray={printerTray}
        handleViewDTR={handleViewDTR}
        handlePrintSelected={handlePrintSelected}
        handleDownloadDTR={handleDownloadDTR}
        handleDownloadAllDTRs={handleDownloadAllDTRs}
        handleClearPrinterTray={handleClearPrinterTray}
        handlePreviewForm48={handlePreviewForm48} // <-- new
      />

      {selectedEmployee && (
        <ViewDTR
          visible={viewDTRVisible}
          onClose={() => setViewDTRVisible(false)}
          employee={selectedEmployee}
          dtrDays={dtrDays}
          dtrLogs={dtrLogs}
          selectedRecord={selectedRecord}
          holidaysPH={holidaysPH}
          onSaveToTray={handleAddToPrinterTray}
          onPreviewForm48={handlePrintSelected}
        />
      )}
    </div>
  );
};

export default DTRProcess;

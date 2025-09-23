import React, { useEffect, useState, lazy, Suspense } from "react";
import { Alert, Row, Col, Card, Skeleton } from "antd";
import { getEmployees } from "../../api/employeeAPI";
import "./dashboard.css";

// Lazy load Recharts PieChart
const PieChartComponent = lazy(() =>
  import("../Dashboard/component/PieChart/PieChartComponent")
);

// Import new components
import EmployeeStatsCards from "./component/EmployeeStatsCards";
import RecentAttendanceTable from "./component/RecentAttendanceTable";
import EmployeesPerSectionTable from "./component/EmployeesPerSectionTable";

// Section & Division Acronyms
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
    "Provincial Environmental Management Unit": "PEMU",
  },
  Specialized: {
    "Commission On Audit": "COA",
  },
};

const divisionAcronyms = {
  "Office of the Regional Director": "ORD",
  "Finance and Administrative Division": "FAD",
  "Environmental Monitoring and Enforcement Division": "EMED",
  "Clearance and Permitting Division": "CPD",
};

// Helper functions
const getSectionAcronym = (sectionName) => {
  for (const division in sectionUnitAcronyms) {
    if (sectionUnitAcronyms[division][sectionName]) {
      return sectionUnitAcronyms[division][sectionName];
    }
  }
  return sectionName || "N/A";
};

const getDivisionAcronym = (sectionName) => {
  for (const division in sectionUnitAcronyms) {
    if (sectionUnitAcronyms[division][sectionName]) {
      return divisionAcronyms[division] || division;
    }
  }
  return "N/A";
};

const Dashboard = () => {
  const [employees, setEmployees] = useState([]); // <-- NEW: keep all employees
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [employeeTypeCounts, setEmployeeTypeCounts] = useState({});
  const [presentCount, setPresentCount] = useState(0);
  const [lastAttendanceDate, setLastAttendanceDate] = useState(null);
  const [employeesPerSection, setEmployeesPerSection] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [error, setError] = useState(null);

  const COLORS = [
    "#0050b3",
    "#d46b08",
    "#52c41a",
    "#eb2f96",
    "#722ed1",
    "#faad14",
    "#13c2c2",
    "#f5222d",
  ];

  // --- Fetch Employees ---
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoadingEmployees(true);
        const res = await getEmployees();
        const fetchedEmployees = res.data;

        setEmployees(fetchedEmployees); // <-- store all employees
        setTotalEmployees(fetchedEmployees.length);

        const regularCount = fetchedEmployees.filter(
          (emp) => emp.empType === "Regular"
        ).length;
        const cosCount = fetchedEmployees.filter(
          (emp) => emp.empType === "Contract of Service"
        ).length;
        setEmployeeTypeCounts({ Regular: regularCount, COS: cosCount });

        // Employees per Section
        const sectionMap = {};
        fetchedEmployees.forEach((emp) => {
          const section = emp.sectionOrUnit || "N/A";
          sectionMap[section] = (sectionMap[section] || 0) + 1;
        });
        const sectionArray = Object.entries(sectionMap).map(
          ([section, count]) => ({
            section,
            count,
          })
        );
        setEmployeesPerSection(sectionArray);
      } catch (err) {
        console.error("Failed to fetch employees:", err);
        setError("Failed to load employees.");
      } finally {
        setLoadingEmployees(false);
      }
    };
    fetchEmployees();
  }, []);

  if (error) {
    return <Alert message="Error" description={error} type="error" showIcon />;
  }

  return (
    <div className="dashboard-container">
      <h2 className="dashboard-title">DTR Management Dashboard</h2>

      <EmployeeStatsCards
        loadingEmployees={loadingEmployees}
        totalEmployees={totalEmployees}
        employeeTypeCounts={employeeTypeCounts}
        lastAttendanceDate={lastAttendanceDate}
        presentCount={presentCount}
      />

      <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
        {/** Lazy-loaded Pie Chart */}
        <Col xs={24} md={24}>
          {loadingEmployees ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : (
            <Suspense fallback={<Skeleton active paragraph={{ rows: 6 }} />}>
              <PieChartComponent
                data={employeeTypeCounts}
                colors={COLORS}
                employees={employees}
              />
            </Suspense>
          )}
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
        {/** Recent Attendance Table */}
        <Col xs={24} md={24}>
          <RecentAttendanceTable
            employees={employees}
            loading={loadingEmployees}
            error={error}
            setPresentCount={setPresentCount}
            setLastAttendanceDate={setLastAttendanceDate}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
        {/** Employees per Section Card */}
        <Col xs={24} md={24}>
          <EmployeesPerSectionTable
            loadingEmployees={loadingEmployees}
            employeesPerSection={employeesPerSection}
            employees={employees} // <-- pass full list here
          />
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
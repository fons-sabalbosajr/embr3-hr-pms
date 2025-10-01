import React, { useEffect, useState, lazy, Suspense } from "react";
import { Alert, Row, Col, Card, Skeleton } from "antd";
import { getEmployees } from "../../api/employeeAPI";
import "./dashboard.css";

const PieChartComponent = lazy(() =>
  import("../Dashboard/component/PieChart/PieChartComponent")
);

import EmployeeStatsCards from "./component/EmployeeStatsCards";
import RecentAttendanceTable from "./component/RecentAttendanceTable";
import EmployeesPerSectionTable from "./component/EmployeesPerSectionTable";

const Dashboard = () => {
  const [employees, setEmployees] = useState([]);
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
      <h2 className="dashboard-title">Dashboard</h2>

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
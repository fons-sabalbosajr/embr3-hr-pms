import React, { useEffect, useState, lazy, Suspense, useRef } from "react";
import {
  Alert,
  Row,
  Col,
  Card,
  Skeleton,
  AutoComplete,
  Input,
  Modal,
  Descriptions,
  Button,
  Space,
  Divider,
  message,
  Spin,
  DatePicker,
} from "antd";
import axiosInstance from "../../api/axiosInstance";
import { generateDTRPdf } from "../../../utils/generateDTRpdf";
import {
  EyeOutlined,
  FileTextOutlined,
  FieldTimeOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { getEmployees } from "../../api/employeeAPI";
import { getUsers } from "../../api/userAPI";
import "./dashboard.css";
import OnlineUsers from "./component/OnlineUsers";
import useAuth from "../../hooks/useAuth";
import socket from "../../../utils/socket";

const PieChartComponent = lazy(() =>
  import("../Dashboard/component/PieChart/PieChartComponent")
);

import EmployeeStatsCards from "./component/EmployeeStatsCards";
import RecentAttendanceTable from "./component/RecentAttendanceTable";
import EmployeesPerSectionTable from "./component/EmployeesPerSectionTable";

const Dashboard = () => {
  const [employees, setEmployees] = useState([]);
  const [users, setUsers] = useState([]);
  const employeesRef = useRef(employees);
  employeesRef.current = employees;

  const [totalEmployees, setTotalEmployees] = useState(0);
  const [employeeTypeCounts, setEmployeeTypeCounts] = useState({});
  const [presentCount, setPresentCount] = useState(0);
  const [lastAttendanceDate, setLastAttendanceDate] = useState(null);
  const [employeesPerSection, setEmployeesPerSection] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [error, setError] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [offlineUsers, setOfflineUsers] = useState([]);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [searchValue, setSearchValue] = useState("");
  const [searchOptions, setSearchOptions] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeModalVisible, setEmployeeModalVisible] = useState(false);
  const [dtrModalVisible, setDtrModalVisible] = useState(false);
  const [dtrRecordList, setDtrRecordList] = useState([]);
  const [selectedDtrRecord, setSelectedDtrRecord] = useState(null);

  const [tileLoading, setTileLoading] = useState({});
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

  const fetchUsers = async () => {
    try {
      const usersArray = await getUsers(); // always returns an array
      setUsers(usersArray);
      setOnlineUsers(usersArray.filter((u) => u.isOnline));
      setOfflineUsers(usersArray.filter((u) => !u.isOnline));
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setUsers([]); // fallback
      setOnlineUsers([]);
      setOfflineUsers([]);
    }
  };

  useEffect(() => {
    fetchUsers();

    socket.on("user-status-changed", fetchUsers);

    return () => {
      socket.off("user-status-changed", fetchUsers);
    };
  }, []);

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
        // Build search options for AutoComplete
        setSearchOptions(
          fetchedEmployees.map((emp) => ({
            label: `${emp.name || emp.empId || "Unknown"} ${
              emp.empId ? `(${emp.empId})` : ""
            }`,
            value:
              emp._id ||
              emp.id ||
              emp.empId ||
              emp.empNo ||
              emp.acNo ||
              emp.name,
          }))
        );
      } catch (err) {
        console.error("Failed to fetch employees:", err);
        setError("Failed to load employees.");
      } finally {
        setLoadingEmployees(false);
      }
    };
    fetchEmployees();
  }, []);

  const handleViewProfile = (emp) => {
    setEmployeeModalVisible(false);
    navigate("/employeeinfo", { state: { empId: emp.empId || emp._id } });
  };

  const { MonthPicker } = DatePicker;

  const handleGenerateReports = async (emp) => {
    // open a modal with MonthPicker to choose the payslip period
    let selectedPeriod = new Date().toISOString().slice(0, 7);
    const modal = Modal.confirm({
      title: "Confirm payslip generation",
      content: (
        <div>
          <div style={{ marginBottom: 8 }}>
            Generate payslip/report for <strong>{emp.name || emp.empId}</strong>
          </div>
          <MonthPicker
            defaultValue={null}
            onChange={(date, dateString) => {
              if (dateString) selectedPeriod = dateString.slice(0, 7);
            }}
            placeholder="Select period (month)"
            style={{ width: "100%" }}
          />
        </div>
      ),
      okText: "Generate",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          setTileLoading((s) => ({ ...s, payslip: true }));
          const period = selectedPeriod || new Date().toISOString().slice(0, 7);
          // Redirect to the Payslip Reports page which contains the full payslip
          // generation UI and rules. Pass empId and period via query string so
          // the reports page can auto-open the generate modal.
          navigate(`/dtr/reports?payslip=1&empId=${encodeURIComponent(
            emp.empId || emp._id
          )}&period=${encodeURIComponent(period)}`);
          setEmployeeModalVisible(false);
        } catch (err) {
          console.error("Failed to navigate to payslip reports", err);
          message.error("Failed to open payslip generator");
        } finally {
          setTileLoading((s) => ({ ...s, payslip: false }));
        }
      },
    });
    return modal;
  };

  const handleOpenDTR = async (emp) => {
    // Open a controlled modal so user can pick the biometrics (DTRData) record
    setSelectedEmployee(emp);
    setDtrModalVisible(true);
    try {
      const res = await axiosInstance.get("/dtrdatas");
      setDtrRecordList(res.data.data || []);
      setSelectedDtrRecord(null);
    } catch (err) {
      console.error("Failed to fetch DTR records", err);
      message.error("Failed to load available biometrics records");
      setDtrRecordList([]);
    }
  };

  const handleConfirmDtrGeneration = async () => {
    if (!selectedEmployee) return;
    if (!selectedDtrRecord) {
      message.warning("Please choose a biometrics record (DTR data)");
      return;
    }
    try {
      setTileLoading((s) => ({ ...s, dtr: true }));

      const acs = [selectedEmployee.empId, ...(selectedEmployee.alternateEmpIds || [])]
        .filter(Boolean)
        .map((a) => a.replace(/\D/g, ""));
      const acParam = acs[0];

      // Prefer to request logs by the DTR record cut-off range to avoid mismatches
      const startDate = selectedDtrRecord?.DTR_Cut_Off?.start;
      const endDate = selectedDtrRecord?.DTR_Cut_Off?.end;
      const baseParams = { recordName: selectedDtrRecord.DTR_Record_Name, startDate, endDate };

      // First try by employee name (more tolerant for AC-No formatting differences)
      let mergedRes = await axiosInstance.get(`/dtrlogs/merged`, { params: { ...baseParams, names: selectedEmployee.name } });
      let dtrLogs = mergedRes.data.data || [];

      // Fallback: try several AC-No variants (original empId, normalized digits, last 4 digits)
      if (!dtrLogs.length) {
        const rawEmpId = selectedEmployee.empId || '';
        const normalized = rawEmpId.replace(/\D/g, '');
        const last4 = normalized.slice(-4);
        const acCandidates = [rawEmpId, normalized, last4].filter(Boolean).join(',');
        mergedRes = await axiosInstance.get(`/dtrlogs/merged`, { params: { ...baseParams, acNo: acCandidates } });
        dtrLogs = mergedRes.data.data || [];
      }

      if (!dtrLogs.length) {
        message.warn('No biometric time records found for this employee in the chosen DTR record. Tried name and AC-No variants.');
        setTileLoading((s) => ({ ...s, dtr: false }));
        return;
      }

      const STATE_LABELS = {
        "C/In": "Time In",
        Out: "Break Out",
        "Out Back": "Break In",
        "C/Out": "Time Out",
      };

      const logsByDay = dtrLogs.reduce((acc, log) => {
        const dateKey = new Date(log.time).toISOString().slice(0, 10);
        if (!acc[dateKey]) acc[dateKey] = {};
        const label = STATE_LABELS[log.state] || log.state;
        acc[dateKey][label] = new Date(log.time).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        return acc;
      }, {});

      const dtrLogsForPdf = { [selectedEmployee.empId]: logsByDay };

      // Generate PDF in browser
      await generateDTRPdf({
        employee: selectedEmployee,
        dtrLogs: dtrLogsForPdf,
        selectedRecord: selectedDtrRecord,
      });

      // Log generation server-side
      await axiosInstance.post("/dtr/log-generation", {
        employeeId: selectedEmployee._id || selectedEmployee.empId,
        period: `${selectedDtrRecord.DTR_Cut_Off.start} to ${selectedDtrRecord.DTR_Cut_Off.end}`,
        generatedBy: user?.name || user?.username || "system",
      });

      // Audit
      await axiosInstance.post("/dev/audit-logs", {
        action: "dtr:requested",
        details: { employeeId: selectedEmployee._id || selectedEmployee.empId, recordId: selectedDtrRecord._id },
      });

      message.success("DTR generated");
      setDtrModalVisible(false);
      setEmployeeModalVisible(false);
    } catch (err) {
      console.error("DTR generation error", err);
      message.error("Failed to generate DTR");
    } finally {
      setTileLoading((s) => ({ ...s, dtr: false }));
    }
  };

  if (error) {
    return <Alert message="Error" description={error} type="error" showIcon />;
  }

  return (
    <>
      <div className="dashboard-container">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2 className="dashboard-title">Dashboard</h2>
          <div className="employee-search-bar">
            <AutoComplete
              options={searchOptions}
              value={searchValue}
              onChange={(val) => setSearchValue(val)}
              onSelect={(val, option) => {
                // Show the human-friendly label in the input instead of raw id
                const label = option?.label || val;
                setSearchValue(typeof label === "string" ? label : String(label));

                // Determine the option value (may be an id/empId/etc.)
                const optionValue = option?.value ?? val;

                // find by several possible identifiers
                const emp = employeesRef.current.find((e) =>
                  e._id === optionValue ||
                  e.id === optionValue ||
                  e.empId === optionValue ||
                  e.empNo === optionValue ||
                  e.acNo === optionValue ||
                  `${e.name} (${e.empId})` === option?.label ||
                  `${e.name}` === option?.label
                );
                if (emp) {
                  setSelectedEmployee(emp);
                  setEmployeeModalVisible(true);
                }
              }}
              filterOption={(inputValue, option) =>
                option?.label
                  ?.toLowerCase()
                  .includes((inputValue || "").toLowerCase())
              }
            >
              <Input.Search
                style={{ width: 300 }}
                placeholder={
                  loadingEmployees
                    ? "Loading employees..."
                    : "Search employee by name or ID"
                }
                enterButton
              />
            </AutoComplete>
          </div>
        </div>

        <EmployeeStatsCards
          loadingEmployees={loadingEmployees}
          totalEmployees={totalEmployees}
          employeeTypeCounts={employeeTypeCounts}
          lastAttendanceDate={lastAttendanceDate}
          presentCount={presentCount}
        />

        <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
          <Col xs={24} md={18}>
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

          {/* 🟢 Sidebar-like Online Users */}
          <Col
            xs={24}
            md={6}
            style={{ display: "flex", flexDirection: "column" }}
          >
            <OnlineUsers
              onlineUsers={onlineUsers}
              offlineUsers={offlineUsers}
            />
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

      <Modal
        title={
          selectedEmployee
            ? `${selectedEmployee.name || selectedEmployee.empId}`
            : "Employee"
        }
        open={employeeModalVisible}
        onCancel={() => setEmployeeModalVisible(false)}
        footer={null}
      >
        {selectedEmployee ? (
          <div>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Employee ID">
                {selectedEmployee.empId || selectedEmployee.empNo || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Name">
                {selectedEmployee.name || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Type">
                {selectedEmployee.empType || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Position">
                {selectedEmployee.position || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Division">
                {selectedEmployee.division || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Section / Unit">
                {selectedEmployee.sectionOrUnit || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="AC No">
                {selectedEmployee.acNo || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Emails">
                {(selectedEmployee.emails || []).join(", ") || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Signatory">
                {selectedEmployee.isSignatory
                  ? selectedEmployee.isSignatoryActive
                    ? "Active"
                    : "Inactive"
                  : "No"}
              </Descriptions.Item>
              <Descriptions.Item label="Remarks">
                {selectedEmployee.remarks || "-"}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <div className="emp-tiles" style={{ marginTop: 8 }}>
              <div
                role="button"
                tabIndex={0}
                className="emp-tile emp-tile--blue"
                onClick={() => handleViewProfile(selectedEmployee)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    handleViewProfile(selectedEmployee);
                }}
                aria-label="View Profile"
              >
                <EyeOutlined
                  className="emp-tile-icon"
                  style={{ color: "#096dd9" }}
                />
                <div className="emp-tile-label">View Profile</div>
              </div>

              <div
                role="button"
                tabIndex={0}
                className="emp-tile emp-tile--amber"
                onClick={() => handleGenerateReports(selectedEmployee)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    handleGenerateReports(selectedEmployee);
                }}
                aria-label="Generate Reports"
              >
                {tileLoading.payslip ? (
                  <div className="emp-tile-icon">
                    <Spin size="small" />
                  </div>
                ) : (
                  <FileTextOutlined
                    className="emp-tile-icon"
                    style={{ color: "#d48806" }}
                  />
                )}
                <div className="emp-tile-label">Generate Reports</div>
              </div>

              <div
                role="button"
                tabIndex={0}
                className="emp-tile emp-tile--green"
                onClick={() => handleOpenDTR(selectedEmployee)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    handleOpenDTR(selectedEmployee);
                }}
                aria-label="Open DTR"
              >
                {tileLoading.dtr ? (
                  <div className="emp-tile-icon">
                    <Spin size="small" />
                  </div>
                ) : (
                  <FieldTimeOutlined
                    className="emp-tile-icon"
                    style={{ color: "#389e0d" }}
                  />
                )}
                <div className="emp-tile-label">Open DTR</div>
              </div>
            </div>
          </div>
        ) : (
          <Skeleton active />
        )}
      </Modal>

      <Modal
        title={selectedEmployee ? `Select biometrics record for ${selectedEmployee.name || selectedEmployee.empId}` : "Select biometrics record"}
        open={dtrModalVisible}
        onCancel={() => setDtrModalVisible(false)}
        onOk={handleConfirmDtrGeneration}
        okText="Generate DTR"
        confirmLoading={tileLoading.dtr}
      >
        {dtrRecordList.length ? (
          <div>
            <p style={{ marginBottom: 8 }}>Choose biometrics data (DTR record) to use for generation:</p>
            <select style={{ width: '100%', padding: 8 }} value={selectedDtrRecord?._id || ''} onChange={(e) => setSelectedDtrRecord(dtrRecordList.find(r=>r._id===e.target.value))}>
              <option value="">-- select record --</option>
              {dtrRecordList.map((r) => (
                <option key={r._id} value={r._id}>{`${r.DTR_Record_Name} — ${new Date(r.DTR_Cut_Off.start).toLocaleDateString()} to ${new Date(r.DTR_Cut_Off.end).toLocaleDateString()}`}</option>
              ))}
            </select>
          </div>
        ) : (
          <p>No biometrics records found. Upload DTR data first.</p>
        )}
      </Modal>
    </>
  );
};

export default Dashboard;

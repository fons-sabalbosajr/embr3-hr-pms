import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Input,
  Select,
  Button,
  Dropdown,
  Table,
  Space,
  Tag,
  Modal,
  DatePicker,
  Tooltip,
  Tabs,
  Alert,
  Descriptions,
  Grid,
} from "antd";
import { swalSuccess, swalError } from "../../../utils/swalHelper";
import {
  DownOutlined,
  PlusOutlined,
  UploadOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  FileTextOutlined,
  UserDeleteOutlined,
  RollbackOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import AddEmployee from "./AddEmployee/AddEmployee";
import UploadEmployee from "./UploadEmployee/UploadEmployee";
import EditEmployeeForm from "./EditEmployee/EditEmployee";
import useAuth from "../../../hooks/useAuth";
import axiosInstance from "../../../api/axiosInstance";
import "./geninfo.css";
import GenerateReport from "./GenerateReport/GenerateReport";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

const { Option } = Select;

dayjs.extend(utc);
dayjs.extend(timezone);

const LOCAL_TZ = "Asia/Manila";

const { useBreakpoint } = Grid;

const GenInfo = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;   // < 768px
  const isTablet = screens.md && !screens.lg; // 768–991px
  const { hasPermission, user } = useAuth();
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState("add"); // 'add' or 'upload'
  const [employeeData, setEmployeeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [designationOptions, setDesignationOptions] = useState([]);
  const [positionOptions, setPositionOptions] = useState([]);
  const [typeOptions, setTypeOptions] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState(null); // 'edit' or 'report'
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedEmpType, setSelectedEmpType] = useState(null);
  const [selectedFilters, setSelectedFilters] = useState({
    position: [],
    sectionOrUnit: [],
    division: [],
  });
  // At the top of GenInfo component state
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [sorterInfo, setSorterInfo] = useState({
    columnKey: "empNo",
    order: "ascend",
  });

  const [activeTabKey, setActiveTabKey] = useState("active");
  const isResignedTab = activeTabKey === "resigned";

  const canEditResigned =
    hasPermission(["canEditEmployees"]) ||
    Boolean(
      user?.isAdmin ||
      user?.userType === "developer" ||
      user?.canAccessDeveloper ||
      user?.canSeeDev,
    );

  const canMarkAsResigned = Boolean(
    user?.userType === "developer" ||
    user?.isAdmin ||
    user?.canAccessDeveloper ||
    user?.canSeeDev,
  );

  const canPurgeResigned = canMarkAsResigned;

  const canRestoreResigned = canMarkAsResigned;

  const [resignModalOpen, setResignModalOpen] = useState(false);
  const [resignSubmitting, setResignSubmitting] = useState(false);
  const [resignTarget, setResignTarget] = useState(null);
  const [resignReason, setResignReason] = useState("");
  const [resignDate, setResignDate] = useState(() => dayjs().tz(LOCAL_TZ));

  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoreSubmitting, setRestoreSubmitting] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoreReason, setRestoreReason] = useState("");
  const [restoreDate, setRestoreDate] = useState(() => dayjs().tz(LOCAL_TZ));

  const [generatedEmpNo, setGeneratedEmpNo] = React.useState("");

  const PURGE_CONFIRM_PHRASE = "DELETE RESIGNED";
  const [purgeModalOpen, setPurgeModalOpen] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState("");
  const [purgeSubmitting, setPurgeSubmitting] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  // If navigated here with a specific empId in location.state, open the detail modal
  useEffect(() => {
    // If navigate to this page with an empId, wait until employees are fetched then open the Reports modal
    if (location?.state?.empId) {
      const tryOpen = () => {
        const match = employeeData.find(
          (e) =>
            e.empId === location.state.empId ||
            e._id === location.state.empId ||
            e.empNo === location.state.empId,
        );
        if (match) {
          setSelectedEmployee(match);
          setModalVisible(true);
          setModalMode("report");
          setSearchKeyword(match.name || match.empId || "");
          return true;
        }
        return false;
      };

      // If already loaded, open immediately
      if (!loading) {
        tryOpen();
      } else {
        // otherwise, poll once when loading finishes
        const unwatch = setInterval(() => {
          if (!loading) {
            if (tryOpen()) {
              clearInterval(unwatch);
            } else {
              // if not found after load, still clear to avoid infinite polling
              clearInterval(unwatch);
            }
          }
        }, 250);
      }
    }
  }, [loading, location, employeeData]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/employees", {
        params: { includeResigned: "true", pageSize: 0 },
      });
      const data = res.data;

      setEmployeeData(data);
      setDesignationOptions([
        ...new Set(data.map((e) => e.designation).filter(Boolean)),
      ]);
      setPositionOptions([
        ...new Set(data.map((e) => e.position).filter(Boolean)),
      ]);
      setTypeOptions([...new Set(data.map((e) => e.type).filter(Boolean))]);
    } catch (err) {
      console.error("Failed to fetch employees", err);
    } finally {
      setLoading(false);
    }
  };

  const showModal = (type) => {
    setModalType(type);
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  const uniquePositions = Array.from(
    new Set(
      employeeData
        .filter((e) =>
          activeTabKey === "resigned" ? !!e.isResigned : !e.isResigned,
        )
        .map((item) => item.position)
        .filter(Boolean),
    ),
  );
  const uniqueSections = Array.from(
    new Set(
      employeeData
        .filter((e) =>
          activeTabKey === "resigned" ? !!e.isResigned : !e.isResigned,
        )
        .map((item) => item.sectionOrUnit)
        .filter((s) => s && s.trim()),
    ),
  );
  const uniqueDivisions = Array.from(
    new Set(
      employeeData
        .filter((e) =>
          activeTabKey === "resigned" ? !!e.isResigned : !e.isResigned,
        )
        .map((item) => item.division)
        .filter((d) => d && d.trim()),
    ),
  );

  const getPositionColorClass = (position) => {
    switch (position) {
      case "ADMINISTRATIVE AIDE IV":
        return "pos-aide";
      case "ADMINISTRATIVE ASSISTANT I":
      case "ADMINISTRATIVE ASSISTANT II":
        return "pos-assistant";
      case "ADMINISTRATIVE OFFICER III":
      case "ADMINISTRATIVE OFFICER IV":
      case "ADMINISTRATIVE OFFICER V":
        return "pos-officer";
      case "CHIEF ADMINISTRATIVE OFFICER":
      case "SUPERVISING ADMINISTRATIVE OFFICER":
        return "pos-chief";
      case "CHEMIST II":
      case "CHEMIST III":
        return "pos-chemist";
      case "ENGINEER II":
      case "ENGINEER III":
      case "ENGINEER IV":
        return "pos-engineer";
      case "INFORMATION OFFICER II":
      case "INFORMATION OFFICER III":
        return "pos-info";
      case "ENVIRONMENTAL MANAGEMENT SPECIALIST I":
      case "ENVIRONMENTAL MANAGEMENT SPECIALIST II":
      case "SENIOR ENVIRONMENTAL MANAGEMENT SPECIALIST":
        return "pos-env";
      case "PLANNING OFFICER II":
        return "pos-planner";
      default:
        return "pos-default";
    }
  };

  const handleFilterChange = (key, values) => {
    setSelectedFilters((prev) => ({
      ...prev,
      [key]: values,
    }));
  };

  const scopedEmployeeData = employeeData.filter((e) =>
    activeTabKey === "resigned" ? !!e.isResigned : !e.isResigned,
  );

  const filteredData = scopedEmployeeData
    .filter((record) => {
      const keyword = searchKeyword.trim().toLowerCase();

      const matchesSearch = keyword
        ? Object.values(record).some((val) =>
            String(val || "")
              .toLowerCase()
              .includes(keyword),
          )
        : true;

      const matchesFilters =
        (!selectedFilters.position.length ||
          selectedFilters.position.includes(record.position)) &&
        (!selectedFilters.sectionOrUnit.length ||
          selectedFilters.sectionOrUnit.includes(record.sectionOrUnit)) &&
        (!selectedFilters.division.length ||
          selectedFilters.division.includes(record.division));

      const matchesEmpType = selectedEmpType
        ? record.empType === selectedEmpType
        : true;

      return matchesSearch && matchesFilters && matchesEmpType;
    })
    .sort((a, b) => {
      if (sorterInfo.columnKey === "empNo") {
        const getParts = (empNo) => {
          const match = empNo.match(/(R3-(COS|REG))(\d+)/i);
          return match
            ? { prefix: match[1], num: parseInt(match[3], 10) }
            : { prefix: "", num: 0 };
        };

        const aParts = getParts(a.empNo);
        const bParts = getParts(b.empNo);

        // 1️⃣ Sort by prefix: COS before REG
        if (aParts.prefix !== bParts.prefix) {
          if (aParts.prefix === "R3-COS") return -1;
          if (bParts.prefix === "R3-COS") return 1;
        }

        // 2️⃣ Sort by number within prefix
        if (aParts.num !== bParts.num) {
          return sorterInfo.order === "ascend"
            ? aParts.num - bParts.num
            : bParts.num - aParts.num;
        }

        return 0;
      }
      return 0;
    });

  const uniqueEmpTypes = [
    ...new Set(scopedEmployeeData.map((e) => e.empType).filter(Boolean)),
  ];

  const activeCount = employeeData.filter((e) => !e.isResigned).length;
  const resignedCount = employeeData.filter((e) => !!e.isResigned).length;

  const handleEmpNoChange = (empNo) => {
    setGeneratedEmpNo(empNo || "");
  };

  const columnsActive = [
    // On mobile, Employee No. is merged into Employee Details
    ...(!isMobile
      ? [
          {
            title: "Employee No.",
            dataIndex: "empNo",
            key: "empNo",
            width: 120,
            ellipsis: true,
            sortOrder:
              sorterInfo.columnKey === "empNo" ? sorterInfo.order : null,
          },
        ]
      : []),
    {
      title: isMobile ? "Employee" : "Employee Details",
      dataIndex: "name",
      key: "employee",
      width: isMobile ? 150 : 250,
      render: (_, record) => (
        <div>
          <strong>{record.name}</strong>
          <br />
          <span style={{ fontSize: "12px", color: "#888" }}>
            {isMobile && <>Emp No.: {record.empNo} | </>}
            ID No.: {record.empId}
            {record.alternateEmpIds && record.alternateEmpIds.length > 0 && (
              <> ,{record.alternateEmpIds.join(", ")}</>
            )}
          </span>
          <br />
          <Tag
            color={record.empType === "Regular" ? "green" : "orange"}
            style={{ marginTop: "4px" }}
          >
            {record.empType}
          </Tag>
        </div>
      ),
    },
    {
      title: "Current Designation",
      key: "assignment",
      width: isMobile ? 130 : 250,
      render: (_, record) => (
        <div className="assignment-column">
          <div
            className={`assignment-label ${getPositionColorClass(
              record.position,
            )}`}
          >
            {record.position}
          </div>
          <div className="assignment-label section">
            {record.sectionOrUnit?.trim() ? (
              record.sectionOrUnit
            ) : (
              <Tag color="red" style={{ fontSize: "9px" }}>
                Please update Unit/Section
              </Tag>
            )}
          </div>
          <div className="assignment-label division">
            {record.division?.trim() ? (
              record.division
            ) : (
              <Tag color="red" style={{ fontSize: "9px" }}>
                Please update Division
              </Tag>
            )}
          </div>
        </div>
      ),
      filterDropdown: ({ confirm, clearFilters }) => (
        <div
          style={{
            padding: 8,
            width: 350,
            maxHeight: 400,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Scrollable filter content */}
          <div style={{ flex: "1 1 auto", overflowY: "auto", marginBottom: 8 }}>
            <div style={{ marginBottom: 8 }}>
              <Select
                mode="multiple"
                allowClear
                showSearch
                placeholder="Filter by Position"
                style={{ width: "100%", fontSize: "12px" }}
                value={selectedFilters.position}
                onChange={(value) => handleFilterChange("position", value)}
              >
                {uniquePositions.map((position) => (
                  <Select.Option key={position} value={position}>
                    {position}
                  </Select.Option>
                ))}
              </Select>
            </div>

            {uniqueSections.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <Select
                  mode="multiple"
                  allowClear
                  showSearch
                  placeholder="Filter by Unit/Section"
                  style={{ width: "100%", fontSize: "12px" }}
                  value={selectedFilters.sectionOrUnit}
                  onChange={(value) =>
                    handleFilterChange("sectionOrUnit", value)
                  }
                >
                  {uniqueSections.map((section) => (
                    <Select.Option key={section} value={section}>
                      {section}
                    </Select.Option>
                  ))}
                </Select>
              </div>
            )}

            {uniqueDivisions.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <Select
                  mode="multiple"
                  allowClear
                  showSearch
                  placeholder="Filter by Division"
                  style={{ width: "100%", fontSize: "12px" }}
                  value={selectedFilters.division}
                  onChange={(value) => handleFilterChange("division", value)}
                >
                  {uniqueDivisions.map((division) => (
                    <Select.Option key={division} value={division}>
                      {division}
                    </Select.Option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          {/* Sticky buttons at the bottom */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
              borderTop: "1px solid #f0f0f0",
              paddingTop: 8,
              background: "#fff",
              position: "sticky",
              bottom: 0,
            }}
          >
            <Button type="primary" onClick={confirm} size="small">
              Apply
            </Button>
            <Button
              onClick={() => {
                clearFilters();
                handleFilterChange("position", []);
                handleFilterChange("sectionOrUnit", []);
                handleFilterChange("division", []);

                // Reset sorting to empNo ascending
                setSorterInfo({
                  columnKey: "empNo",
                  order: "ascend",
                });
              }}
              size="small"
            >
              Clear
            </Button>
          </div>
        </div>
      ),
      onFilter: () => true, // Required to enable filter icon, actual filtering handled elsewhere
    },
    {
      title: "Actions",
      fixed: "right",
      width: isMobile ? 80 : 150,
      render: (_, record) => (
        <Space size={isMobile ? 4 : 8} wrap>
          {hasPermission(["canEditEmployees"]) && (
            <Tooltip title="Edit Employee">
              <Button
                size="small"
                type="primary"
                icon={<EyeOutlined />}
                onClick={() => {
                  setSelectedEmployee(record);
                  setModalMode("edit");
                  setModalVisible(true);
                }}
              />
            </Tooltip>
          )}
          <Tooltip title="Generate Report">
            <Button
              type="primary"
              size="small"
              className="geninfo-btn--report"
              icon={<FileTextOutlined />}
              onClick={() => {
                setSelectedEmployee(record);
                setModalMode("report");
                setModalVisible(true);
              }}
            />
          </Tooltip>

          {canMarkAsResigned && (
            <Tooltip title="Mark as resigned">
              <Button
                size="small"
                type="primary"
                danger
                icon={<UserDeleteOutlined />}
                onClick={() => {
                  if (!record?._id) {
                    swalError("Unable to resign: missing employee id");
                    return;
                  }
                  setResignTarget(record);
                  setResignReason("");
                  setResignDate(dayjs().tz(LOCAL_TZ));
                  setResignModalOpen(true);
                }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const columnsResigned = [
    ...(!isMobile
      ? [
          {
            title: "Employee No.",
            dataIndex: "empNo",
            key: "empNo",
            width: 120,
            ellipsis: true,
            sortOrder:
              sorterInfo.columnKey === "empNo" ? sorterInfo.order : null,
            render: (v) => <span style={{ opacity: 0.85 }}>{v}</span>,
          },
        ]
      : []),
    {
      title: isMobile ? "Employee" : "Resigned Employee",
      dataIndex: "name",
      key: "employee",
      width: isMobile ? 200 : 320,
      render: (_, record) => (
        <div>
          <strong style={{ opacity: 0.9 }}>{record.name}</strong>
          <br />
          <span style={{ fontSize: "12px", color: "#888" }}>
            {isMobile && <>Emp No.: {record.empNo} | </>}
            ID No.: {record.empId}
            {record.alternateEmpIds && record.alternateEmpIds.length > 0 && (
              <> ,{record.alternateEmpIds.join(", ")}</>
            )}
          </span>
          <br />
          <Space size={6} wrap style={{ marginTop: 4 }}>
            <Tag color={record.empType === "Regular" ? "green" : "orange"}>
              {record.empType}
            </Tag>
            <Tag color="red">Resigned</Tag>
          </Space>
          {isMobile && record.resignedAt && (
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
              Resigned: {new Date(record.resignedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      ),
    },
    ...(!isMobile
      ? [
          {
            title: "Resigned At",
            dataIndex: "resignedAt",
            key: "resignedAt",
            width: 140,
            render: (v) => (v ? new Date(v).toLocaleDateString() : "-"),
          },
          {
            title: "Reason",
            dataIndex: "resignedReason",
            key: "resignedReason",
            width: 220,
            ellipsis: true,
            render: (v) => v || "-",
          },
        ]
      : []),
    {
      title: "Actions",
      fixed: "right",
      width: isMobile ? 80 : 180,
      render: (_, record) => (
        <Space>
          <Tooltip
            title={
              canEditResigned
                ? "Edit resigned employee"
                : "Only developers can edit resigned employees"
            }
          >
            <Button
              size="small"
              type={canEditResigned ? "primary" : "default"}
              icon={<EditOutlined />}
              disabled={!canEditResigned}
              onClick={() => {
                if (!canEditResigned) return;
                setSelectedEmployee(record);
                setModalMode("edit");
                setModalVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Generate Report">
            <Button
              type="primary"
              size="small"
              className="geninfo-btn--report"
              icon={<FileTextOutlined />}
              onClick={() => {
                setSelectedEmployee(record);
                setModalMode("report");
                setModalVisible(true);
              }}
            />
          </Tooltip>

          {canRestoreResigned && (
            <Tooltip title="Restore employee">
              <Button
                type="primary"
                size="small"
                className="geninfo-btn--restore"
                icon={<RollbackOutlined />}
                onClick={() => {
                  if (!record?._id) {
                    swalError("Unable to restore: missing employee id");
                    return;
                  }
                  setRestoreTarget(record);
                  setRestoreReason("");
                  setRestoreDate(dayjs().tz(LOCAL_TZ));
                  setRestoreModalOpen(true);
                }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const columns = isResignedTab ? columnsResigned : columnsActive;

  const menu = {
    items: [
      { key: "add", label: "Add Individual Employee" },
      { key: "upload", label: "Upload Employee List" },
    ],
    onClick: ({ key }) => showModal(key),
  };

  return (
    <div>
      <div className="geninfo-header">
        <h2>Employee General Info</h2>
      </div>

      <Tabs
        activeKey={activeTabKey}
        onChange={(key) => {
          setActiveTabKey(key);
          setCurrentPage(1);
        }}
        items={[
          { key: "active", label: `Active Employees (${activeCount})` },
          { key: "resigned", label: `Resigned Employees (${resignedCount})` },
        ]}
      />

      {isResignedTab && (
        <div className="geninfo-resigned-banner">
          <Alert
            type="warning"
            showIcon
            message="Resigned Employees"
            description="These profiles are kept for record purposes. Editing is limited to developer/admin; you can still generate reports."
          />
        </div>
      )}

      <div className="geninfo-filters">
        <Space className="filters-left" wrap>
          <Input
            placeholder="Search any keyword..."
            prefix={<SearchOutlined />}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            allowClear
            style={{ width: isMobile ? '100%' : 350 }}
          />
          <Select
            allowClear
            placeholder="Filter by Employee Type"
            value={selectedEmpType}
            style={{ width: isMobile ? '100%' : 200 }}
            onChange={(value) => setSelectedEmpType(value)}
          >
            {uniqueEmpTypes.map((type) => (
              <Select.Option key={type} value={type}>
                {type}
              </Select.Option>
            ))}
          </Select>
        </Space>

        {!isResignedTab && hasPermission(["canEditEmployees"]) && (
          <Dropdown menu={menu}>
            <Button type="primary">
              Add <DownOutlined />
            </Button>
          </Dropdown>
        )}

        <Modal
          open={isModalOpen}
          onCancel={handleCancel}
          footer={null}
          title={
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>
                {modalType === "add"
                  ? "Add Individual Employee"
                  : "Upload Employee List"}
              </span>
              {modalType === "add" && generatedEmpNo && (
                <Tag
                  color={
                    generatedEmpNo.startsWith("R3-REG") ? "green" : "orange"
                  }
                  style={{
                    marginRight: "20px",
                    bottom: "4px",
                  }}
                >
                  {generatedEmpNo}
                </Tag>
              )}
            </div>
          }
          destroyOnHidden
          centered
          width={modalType === "add" ? 650 : 1000}
        >
          {modalType === "add" ? (
            <AddEmployee
              onClose={(created) => {
                // Close modal
                handleCancel();

                // If server returned created employee, open its profile immediately
                if (created) {
                  setSelectedEmployee(created);
                  setModalMode("report");
                  setModalVisible(true);
                  // Refresh list in background
                  fetchEmployees();
                  return;
                }

                // Otherwise just refresh list
                fetchEmployees();
              }}
              onEmpNoChange={handleEmpNoChange} // pass callback here
            />
          ) : (
            <UploadEmployee
              onClose={() => {
                handleCancel();
                fetchEmployees();
              }}
            />
          )}
        </Modal>

        <Modal
          open={modalVisible}
          onCancel={() => {
            setModalVisible(false);
            setSelectedEmployee(null);
            setModalMode(null);
            setPurgeModalOpen(false);
            setPurgeConfirmText("");
            setPurgeSubmitting(false);
          }}
          footer={null}
          title={(() => {
            const resigned = !!selectedEmployee?.isResigned;
            if (modalMode === "edit")
              return resigned
                ? "Resigned Employee Details"
                : "Employee Details";
            return resigned ? "Resigned Employee Reports" : "Employee Reports";
          })()}
          width={900}
        >
          {(selectedEmployee?.restoredAt ||
            selectedEmployee?.restorationReason) && (
            <div style={{ marginBottom: 12 }}>
              <Alert
                type="success"
                showIcon
                message="Restoration Details"
                description={
                  <Descriptions size="small" column={1}>
                    <Descriptions.Item label="Restored At">
                      {selectedEmployee?.restoredAt
                        ? new Date(
                            selectedEmployee.restoredAt,
                          ).toLocaleDateString()
                        : "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Reason">
                      {selectedEmployee?.restorationReason || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Restored By">
                      {selectedEmployee?.restoredByName || "-"}
                    </Descriptions.Item>
                  </Descriptions>
                }
              />
            </div>
          )}

          {selectedEmployee?.isResigned && (
            <div style={{ marginBottom: 12 }}>
              <Alert
                type="warning"
                showIcon
                message="Resigned Employee"
                description={
                  <Descriptions size="small" column={1}>
                    <Descriptions.Item label="Status">
                      <Tag color="red">Resigned</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Resigned At">
                      {selectedEmployee?.resignedAt
                        ? new Date(
                            selectedEmployee.resignedAt,
                          ).toLocaleDateString()
                        : "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Reason">
                      {selectedEmployee?.resignedReason || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Editing">
                      {canEditResigned
                        ? "Allowed for developer/admin"
                        : "Not allowed"}
                    </Descriptions.Item>
                  </Descriptions>
                }
              />
            </div>
          )}

          {modalMode === "report" &&
            selectedEmployee?.isResigned &&
            canPurgeResigned && (
              <div
                style={{
                  marginBottom: 12,
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <Tooltip title="Permanently deletes ALL resigned employees and related records">
                  <Button
                    danger
                    onClick={() => {
                      setPurgeConfirmText("");
                      setPurgeModalOpen(true);
                    }}
                  >
                    Delete forever
                  </Button>
                </Tooltip>
              </div>
            )}
          {modalMode === "edit" && selectedEmployee && (
            <EditEmployeeForm
              employee={selectedEmployee}
              onClose={() => setModalVisible(false)}
              onUpdated={(updatedEmp) => {
                // ✅ Optimistic update
                setEmployeeData((prev) =>
                  prev.map((emp) =>
                    emp._id === updatedEmp._id
                      ? { ...emp, ...updatedEmp }
                      : emp,
                  ),
                );

                // ✅ Safe refresh in background
                fetchEmployees();
              }}
            />
          )}

          {modalMode === "report" && selectedEmployee && (
            <GenerateReport
              employee={selectedEmployee}
              onClose={() => setModalVisible(false)}
            />
          )}
        </Modal>

        <Modal
          open={purgeModalOpen}
          title="Delete resigned employees forever"
          okText="Delete forever"
          okButtonProps={{
            danger: true,
            loading: purgeSubmitting,
            disabled: purgeConfirmText.trim() !== PURGE_CONFIRM_PHRASE,
          }}
          cancelButtonProps={{ disabled: purgeSubmitting }}
          onCancel={() => {
            if (purgeSubmitting) return;
            setPurgeModalOpen(false);
            setPurgeConfirmText("");
          }}
          onOk={async () => {
            try {
              setPurgeSubmitting(true);
              const res = await axiosInstance.delete(
                "/employees/resigned/purge",
                {
                  data: { confirm: purgeConfirmText.trim() },
                },
              );
              const deleted = res?.data?.deleted;
              swalSuccess(
                typeof deleted === "number"
                  ? `Deleted ${deleted} resigned employee(s)`
                  : "Resigned employees deleted",
              );
              setPurgeModalOpen(false);
              setPurgeConfirmText("");
              setModalVisible(false);
              setSelectedEmployee(null);
              setModalMode(null);
              fetchEmployees();
            } catch (err) {
              const msg =
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                "Failed to delete resigned employees";
              swalError(msg);
            } finally {
              setPurgeSubmitting(false);
            }
          }}
          destroyOnHidden
          centered
        >
          <Alert
            type="error"
            showIcon
            message="This action is permanent"
            description={
              <div style={{ fontSize: 12 }}>
                This will permanently delete <strong>ALL</strong> resigned
                employees from the database (currently:{" "}
                <strong>{resignedCount}</strong>) and remove their related
                records. This cannot be undone.
              </div>
            }
          />

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.85 }}>
              Type <strong>{PURGE_CONFIRM_PHRASE}</strong> to confirm
            </div>
            <Input
              value={purgeConfirmText}
              onChange={(e) => setPurgeConfirmText(e.target.value)}
              placeholder={PURGE_CONFIRM_PHRASE}
              disabled={purgeSubmitting}
              autoComplete="off"
            />
          </div>
        </Modal>

        <Modal
          open={resignModalOpen}
          onCancel={() => {
            if (resignSubmitting) return;
            setResignModalOpen(false);
            setResignTarget(null);
            setResignReason("");
            setResignDate(dayjs().tz(LOCAL_TZ));
          }}
          title={
            <Space size={8}>
              <UserDeleteOutlined />
              <span>Mark as Resigned</span>
            </Space>
          }
          okText="Confirm"
          okButtonProps={{
            danger: true,
            loading: resignSubmitting,
            disabled: !resignTarget,
          }}
          cancelButtonProps={{ disabled: resignSubmitting }}
          onOk={async () => {
            if (!resignTarget?._id) {
              swalError("Unable to resign: missing employee id");
              return;
            }

            const trimmedReason = resignReason.trim();
            if (!trimmedReason) {
              swalError("Please enter a reason");
              return;
            }

            const resignedAtIso = resignDate
              ? dayjs
                  .tz(resignDate.format("YYYY-MM-DD"), LOCAL_TZ)
                  .startOf("day")
                  .toISOString()
              : dayjs().tz(LOCAL_TZ).startOf("day").toISOString();

            setResignSubmitting(true);
            try {
              await axiosInstance.put(`/employees/${resignTarget._id}/resign`, {
                reason: trimmedReason,
                resignedAt: resignedAtIso,
              });
              swalSuccess("Employee marked as resigned");
              setResignModalOpen(false);
              setResignTarget(null);
              setResignReason("");
              setResignDate(dayjs().tz(LOCAL_TZ));
              fetchEmployees();
            } catch (err) {
              const msg =
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                "Failed to mark employee as resigned";
              swalError(msg);
            } finally {
              setResignSubmitting(false);
            }
          }}
          destroyOnHidden
        >
          <div style={{ marginBottom: 10 }}>
            <Alert
              type="warning"
              showIcon
              message={resignTarget?.name || "Selected employee"}
              description={
                <div style={{ fontSize: 12 }}>
                  This will move the employee to the Resigned tab.
                </div>
              }
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <Space
              size={6}
              style={{ fontSize: 12, marginBottom: 6, opacity: 0.85 }}
            >
              <CalendarOutlined />
              <span>Resigned date</span>
            </Space>
            <DatePicker
              style={{ width: "100%" }}
              value={resignDate}
              onChange={(v) => setResignDate(v)}
              disabled={resignSubmitting}
              allowClear={false}
            />
          </div>

          <div>
            <Space
              size={6}
              style={{ fontSize: 12, marginBottom: 6, opacity: 0.85 }}
            >
              <InfoCircleOutlined />
              <span>Reason</span>
              <Tag color="red">Required</Tag>
            </Space>
            <Input.TextArea
              rows={4}
              placeholder="Why has this employee been resigned?"
              value={resignReason}
              onChange={(e) => setResignReason(e.target.value)}
              disabled={resignSubmitting}
            />
          </div>
        </Modal>

        <Modal
          open={restoreModalOpen}
          onCancel={() => {
            if (restoreSubmitting) return;
            setRestoreModalOpen(false);
            setRestoreTarget(null);
            setRestoreReason("");
            setRestoreDate(dayjs().tz(LOCAL_TZ));
          }}
          title={
            <Space size={8}>
              <RollbackOutlined />
              <span>Restore Employee</span>
            </Space>
          }
          okText="Restore"
          okButtonProps={{
            loading: restoreSubmitting,
            disabled: !restoreTarget,
            className: "geninfo-btn--restore",
          }}
          cancelButtonProps={{ disabled: restoreSubmitting }}
          onOk={async () => {
            if (!restoreTarget?._id) {
              swalError("Unable to restore: missing employee id");
              return;
            }

            const trimmedReason = restoreReason.trim();
            if (!trimmedReason) {
              swalError("Please enter a restoration reason");
              return;
            }

            const restoredAtIso = restoreDate
              ? dayjs
                  .tz(restoreDate.format("YYYY-MM-DD"), LOCAL_TZ)
                  .startOf("day")
                  .toISOString()
              : dayjs().tz(LOCAL_TZ).startOf("day").toISOString();

            setRestoreSubmitting(true);
            try {
              await axiosInstance.put(
                `/employees/${restoreTarget._id}/undo-resign`,
                {
                  reason: trimmedReason,
                  restoredAt: restoredAtIso,
                },
              );
              swalSuccess("Employee restored to active list");
              setRestoreModalOpen(false);
              setRestoreTarget(null);
              setRestoreReason("");
              setRestoreDate(dayjs().tz(LOCAL_TZ));
              fetchEmployees();
              setActiveTabKey("active");
            } catch (err) {
              const msg =
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                "Failed to restore employee";
              swalError(msg);
            } finally {
              setRestoreSubmitting(false);
            }
          }}
          destroyOnHidden
        >
          <div style={{ marginBottom: 10 }}>
            <Alert
              type="info"
              showIcon
              message={restoreTarget?.name || "Selected employee"}
              description={
                <Descriptions size="small" column={1}>
                  <Descriptions.Item label="Employee No.">
                    {restoreTarget?.empNo || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="ID No.">
                    {restoreTarget?.empId || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Position">
                    {restoreTarget?.position || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Resigned At">
                    {restoreTarget?.resignedAt
                      ? new Date(restoreTarget.resignedAt).toLocaleDateString()
                      : "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Resigned Reason">
                    {restoreTarget?.resignedReason || "-"}
                  </Descriptions.Item>
                </Descriptions>
              }
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <Space
              size={6}
              style={{ fontSize: 12, marginBottom: 6, opacity: 0.85 }}
            >
              <CalendarOutlined />
              <span>Restoration date</span>
            </Space>
            <DatePicker
              style={{ width: "100%" }}
              value={restoreDate}
              onChange={(v) => setRestoreDate(v)}
              disabled={restoreSubmitting}
              allowClear={false}
            />
          </div>

          <div>
            <Space
              size={6}
              style={{ fontSize: 12, marginBottom: 6, opacity: 0.85 }}
            >
              <InfoCircleOutlined />
              <span>Reason of restoration</span>
              <Tag color="red">Required</Tag>
            </Space>
            <Input.TextArea
              rows={4}
              placeholder="Why is this employee being restored?"
              value={restoreReason}
              onChange={(e) => setRestoreReason(e.target.value)}
              disabled={restoreSubmitting}
            />
          </div>
        </Modal>
      </div>

      <div className="geninfo-table">
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey={(r) => r._id || r.empId || r.empNo}
          size="small"
          loading={loading}
          scroll={{ x: isMobile ? 500 : isTablet ? 700 : 900 }}
          rowClassName={() => (isResignedTab ? "geninfo-row--resigned" : "")}
          pagination={{
            current: currentPage,
            pageSize,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50", "100"],
            onChange: (page, newPageSize) => {
              setCurrentPage(page);
              setPageSize(newPageSize);
            },
            showTotal: (total, range) => (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                }}
              >
                <span>Total rows: {total}</span>
              </div>
            ),
          }}
        />
      </div>
    </div>
  );
};

export default GenInfo;

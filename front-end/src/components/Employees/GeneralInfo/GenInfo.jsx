import React, { useEffect, useState } from "react";
import {
  Input,
  Select,
  Button,
  Dropdown,
  Table,
  Space,
  Tag,
  Modal,
  Tooltip,
} from "antd";
import {
  DownOutlined,
  PlusOutlined,
  UploadOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import AddEmployee from "./AddEmployee/AddEmployee";
import UploadEmployee from "./UploadEmployee/UploadEmployee";
import EditEmployeeForm from "./EditEmployee/EditEmployee";
import axiosInstance from "../../../api/axiosInstance";
import "./geninfo.css";
import GenerateReport from "./GenerateReport/GenerateReport";

const { Option } = Select;

const GenInfo = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState("add"); // 'add' or 'upload'
  const [employeeData, setEmployeeData] = useState([]);
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

  const [sorterInfo, setSorterInfo] = useState({
    columnKey: "empNo",
    order: "ascend",
  });

  const [generatedEmpNo, setGeneratedEmpNo] = React.useState("");

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await axiosInstance.get("/employees");
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
    new Set(employeeData.map((item) => item.position).filter(Boolean))
  );
  const uniqueSections = Array.from(
    new Set(
      employeeData
        .map((item) => item.sectionOrUnit)
        .filter((s) => s && s.trim())
    )
  );
  const uniqueDivisions = Array.from(
    new Set(
      employeeData.map((item) => item.division).filter((d) => d && d.trim())
    )
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

  const filteredData = employeeData
    .filter((record) => {
      const keyword = searchKeyword.trim().toLowerCase();

      const matchesSearch = keyword
        ? Object.values(record).some((val) =>
            String(val || "")
              .toLowerCase()
              .includes(keyword)
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
    ...new Set(employeeData.map((e) => e.empType).filter(Boolean)),
  ];

  const handleEmpNoChange = (empNo) => {
    setGeneratedEmpNo(empNo || "");
  };

  const columns = [
    {
      title: "Employee No.",
      dataIndex: "empNo",
      key: "empNo",
      width: 120,
      ellipsis: true,
      sortOrder: sorterInfo.columnKey === "empNo" ? sorterInfo.order : null,
    },
    {
      title: "Employee Details",
      dataIndex: "name",
      key: "employee",
      width: 300,
      render: (_, record) => (
        <div>
          <strong>{record.name}</strong>
          <br />
          <span style={{ fontSize: "12px", color: "#888" }}>
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
      render: (_, record) => (
        <div className="assignment-column">
          <div
            className={`assignment-label ${getPositionColorClass(
              record.position
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
      width: 200,
      render: (_, record) => (
        <Space>
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

          <Tooltip title="Generate Report">
            <Button
              type="primary"
              size="small"
              danger
              icon={<FileTextOutlined />}
              onClick={() => {
                setSelectedEmployee(record);
                setModalMode("report");
                setModalVisible(true);
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

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

      <div className="geninfo-filters">
        <Space className="filters-left" wrap>
          <Input
            placeholder="Search any keyword..."
            prefix={<SearchOutlined />}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            allowClear
            style={{ width: 350 }}
          />
          <Select
            allowClear
            placeholder="Filter by Employee Type"
            value={selectedEmpType}
            style={{ width: 200 }}
            onChange={(value) => setSelectedEmpType(value)}
          >
            {uniqueEmpTypes.map((type) => (
              <Select.Option key={type} value={type}>
                {type}
              </Select.Option>
            ))}
          </Select>
        </Space>

        <Dropdown menu={menu}>
          <Button type="primary">
            Add <DownOutlined />
          </Button>
        </Dropdown>

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
              onClose={() => {
                handleCancel();
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
          }}
          footer={null}
          title={
            modalMode === "edit"
              ? `Edit Employee: ${selectedEmployee?.name}`
              : `Generate Report for: ${selectedEmployee?.name}`
          }
          width={600}
        >
          {modalMode === "edit" && selectedEmployee && (
            <EditEmployeeForm
              employee={selectedEmployee}
              onClose={() => setModalVisible(false)}
              onUpdated={(updatedEmp) => {
                // ✅ Optimistic update
                setEmployeeData((prev) =>
                  prev.map((emp) =>
                    emp._id === updatedEmp._id ? { ...emp, ...updatedEmp } : emp
                  )
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
      </div>

      <div className="geninfo-table">
        <Table
          columns={columns}
          dataSource={filteredData}
          pagination={{ pageSize: 10 }}
          rowKey="empId" // or "id", depending on your schema
          size="small"
        />
      </div>
    </div>
  );
};

export default GenInfo;

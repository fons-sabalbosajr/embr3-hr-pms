import React, { useEffect, useState } from "react";
import useDemoMode from "../../../hooks/useDemoMode";
import { swalConfirm, swalSuccess, swalError } from "../../../utils/swalHelper";
import {
  Input,
  Select,
  Button,
  Table,
  Space,
  Tag,
  Modal,
  Tooltip,
  Tabs,
  Grid,
} from "antd";
import {
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import axiosInstance from "../../../api/axiosInstance";
import { secureGet } from "../../../../utils/secureStorage";
import "./salaryinfo.css";
import AddSalaryInfo from "./AddSalaryInfo/AddSalaryInfo";
import EditSalaryInfo from "./EditSalaryInfo/EditSalaryInfo";

const { Option } = Select;
const { useBreakpoint } = Grid;

const SalaryInfo = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;   // < 768px
  const { readOnly, isDemoActive, isDemoUser } = useDemoMode();
  const demoDeleteDisabled = isDemoActive; // Disable deletes in demo
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState("add"); // 'add' or 'edit'
  const [employeeData, setEmployeeData] = useState([]);
  const [employeeSalaryData, setEmployeeSalaryData] = useState([]);
  const [combinedData, setCombinedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedEmployeeSalary, setSelectedEmployeeSalary] = useState(null);
  const [activeTab, setActiveTab] = useState("Regular"); // 'all', 'Regular', 'COS'

  const currentUser = secureGet("user");
  const showSalaryAmounts = currentUser?.showSalaryAmounts ?? true; // Default to true if not set

  useEffect(() => {
    fetchCombinedData();
  }, []);

  const fetchCombinedData = async () => {
    setLoading(true);
    try {
      const [employeesRes, salariesRes] = await Promise.all([
        axiosInstance.get("/employees"),
        axiosInstance.get("/employee-salaries"),
      ]);

      const employees = employeesRes.data.sort((a, b) =>
        a.empNo.localeCompare(b.empNo, undefined, { numeric: true })
      );
      const salaries = salariesRes.data;

      // Combine data: Map salary info to employees
      const combined = employees.map((emp) => {
        const salary = salaries.find((sal) => sal.employeeId._id === emp._id);
        return {
          ...emp,
          salaryInfo: salary || null, // Attach salary info, or null if not found
        };
      });
      setEmployeeData(employees);
      setEmployeeSalaryData(salaries);
      setCombinedData(combined);
    } catch (err) {
      console.error("Failed to fetch combined employee and salary data", err);
      swalError("Failed to load employee salary data.");
    } finally {
      setLoading(false);
    }
  };

  const showModal = (type, record = null) => {
    setModalType(type);
    setSelectedEmployeeSalary(record);
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setSelectedEmployeeSalary(null);
  };

  const handleDelete = async (id) => {
    const result = await swalConfirm({
      title: "Confirm Delete",
      text: "Are you sure you want to delete this employee's salary record?",
      confirmText: "Delete",
      dangerMode: true,
    });
    if (!result.isConfirmed) return;
    try {
      await axiosInstance.delete(`/employee-salaries/${id}`);
      swalSuccess("Employee salary record deleted successfully.");
      fetchCombinedData(); // Refresh data
    } catch (error) {
      console.error("Failed to delete employee salary record", error);
      swalError("Failed to delete employee salary record.");
    }
  };

  const getFilteredData = (data, tab) => {
    return data.filter((record) => {
      const keyword = searchKeyword.trim().toLowerCase();

      const matchesSearch = keyword
        ? Object.values(record).some((val) =>
            String(val || "")
              .toLowerCase()
              .includes(keyword)
          ) ||
          (record.salaryInfo &&
            Object.values(record.salaryInfo).some((val) =>
              String(val || "")
                .toLowerCase()
                .includes(keyword)
            ))
        : true;

      const matchesTab = tab === "all" ? true : record.empType === tab;

      return matchesSearch && matchesTab;
    });
  };

  const regularColumns = [
    {
      title: "Employee Details",
      key: "employeeDetails",
      width: isMobile ? 180 : 250,
      render: (_, record) => (
        <div>
          <strong>{record.name}</strong>
          <br />
          <span style={{ fontSize: "12px", color: "#888" }}>
            ID No.: {record.empId} | Emp No.: {record.empNo}
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
      title: isMobile ? "Rate/Mo" : "Rate per Month",
      dataIndex: ["salaryInfo", "ratePerMonth"],
      key: "ratePerMonth",
      width: isMobile ? 100 : 120,
      render: (text, record) =>
        showSalaryAmounts
          ? text
            ? `₱${text.toLocaleString()}`
            : record.salaryInfo?.basicSalary
            ? `₱${record.salaryInfo.basicSalary.toLocaleString()}`
            : "N/A"
          : "*****",
    },
    {
      title: isMobile ? "Cut off" : "Cut off Rate",
      key: "cutOffRate",
      width: isMobile ? 100 : 120,
      render: (_, record) => {
        const rate = record.salaryInfo?.ratePerMonth || record.salaryInfo?.basicSalary;
        return showSalaryAmounts
          ? rate
            ? `₱${(rate / 2).toLocaleString()}`
            : "N/A"
          : "*****";
      },
    },
    {
      title: "Actions",
      fixed: "right",
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit Salary Info">
            <Button
              size="small"
              type="primary"
              icon={<EditOutlined />}
              onClick={() => showModal("edit", record.salaryInfo)}
              disabled={!record.salaryInfo} // Disable if no salary info exists
            />
          </Tooltip>
          <Tooltip title={demoDeleteDisabled ? "Delete disabled in demo mode" : "Delete Salary Info"}>
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.salaryInfo?._id)}
              disabled={!record.salaryInfo || demoDeleteDisabled}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const cosColumns = [
    {
      title: "Employee Details",
      key: "employeeDetails",
      width: isMobile ? 180 : 250,
      render: (_, record) => (
        <div>
          <strong>{record.name}</strong>
          <br />
          <span style={{ fontSize: "12px", color: "#888" }}>
            ID No.: {record.empId} | Emp No.: {record.empNo}
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
      title: isMobile ? "Rate/Mo" : "Rate per Month",
      dataIndex: ["salaryInfo", "ratePerMonth"],
      key: "ratePerMonth",
      width: isMobile ? 100 : 120,
      render: (text) => (showSalaryAmounts ? (text ? `₱${text.toLocaleString()}` : "N/A") : "*****"),
    },
    {
      title: isMobile ? "Daily" : "Daily Rate",
      dataIndex: ["salaryInfo", "dailyRate"],
      key: "dailyRate",
      width: isMobile ? 100 : 120,
      render: (text) => (showSalaryAmounts ? (text ? `₱${text.toLocaleString()}` : "N/A") : "*****"),
    },
    
    {
      title: "Actions",
      fixed: "right",
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit Salary Info">
            <Button
              size="small"
              type="primary"
              icon={<EditOutlined />}
              onClick={() => showModal("edit", record.salaryInfo)}
              disabled={!record.salaryInfo} // Disable if no salary info exists
            />
          </Tooltip>
          <Tooltip title={demoDeleteDisabled ? "Delete disabled in demo mode" : "Delete Salary Info"}>
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.salaryInfo?._id)}
              disabled={!record.salaryInfo || demoDeleteDisabled}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="salaryinfo-header">
        <h2>Employee Salary Information</h2>
      </div>

      <div className="salaryinfo-filters">
        <Space className="filters-left" wrap>
          <Input
            placeholder="Search any keyword..."
            prefix={<SearchOutlined />}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            allowClear
            style={{ width: isMobile ? '100%' : 350 }}
          />
        </Space>

        <Button type="primary" onClick={() => showModal("add")} disabled={readOnly && isDemoActive && isDemoUser}>
          Add Salary Info
        </Button>

        <Modal
          open={isModalOpen}
          onCancel={handleCancel}
          footer={null}
          title={
            modalType === "add"
              ? "Add Employee Salary Information"
              : "Edit Employee Salary Information"
          }
          destroyOnHidden
          centered
          width={700}
        >
          {modalType === "add" ? (
            <AddSalaryInfo
              onClose={() => {
                handleCancel();
                fetchCombinedData();
              }}
            />
          ) : (
            <EditSalaryInfo
              onClose={() => {
                handleCancel();
                fetchCombinedData();
              }}
              salaryData={selectedEmployeeSalary}
            />
          )}
        </Modal>
      </div>

      <Tabs
        defaultActiveKey="Regular"
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            label: "Regular Employees",
            key: "Regular",
            children: (
              <div className="salaryinfo-table">
                <Table
                  columns={regularColumns}
                  dataSource={getFilteredData(combinedData, "Regular")}
                  pagination={{ pageSize: 10 }}
                  rowKey="_id"
                  size="small"
                  loading={loading}
                  scroll={{ x: isMobile ? 500 : 600 }}
                />
              </div>
            ),
          },
          {
            label: "Contract of Service",
            key: "Contract of Service",
            children: (
              <div className="salaryinfo-table">
                <Table
                  columns={cosColumns}
                  dataSource={getFilteredData(combinedData, "Contract of Service")}
                  pagination={{ pageSize: 10 }}
                  rowKey="_id"
                  size="small"
                  loading={loading}
                  scroll={{ x: isMobile ? 500 : 600 }}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

export default SalaryInfo;
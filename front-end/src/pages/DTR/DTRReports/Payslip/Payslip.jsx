import React, { useEffect, useState } from "react";
import {
  Input,
  Select,
  Button,
  Table,
  Space,
  Tag,
  Tooltip,
  notification,
  Tabs,
  Form,
  Modal,
} from "antd";
import { SearchOutlined } from "@ant-design/icons";
import axiosInstance from "../../../../api/axiosInstance";
import dayjs from "dayjs";
import generatePaySlipPdf from "../../../../../utils/generatePaySlip.js";
import { secureGet } from "../../../../../utils/secureStorage";
import "./payslip.css";
import GeneratePayslipModal from "./components/GeneratePayslipModal";
import AddSalaryInfo from "../../../../components/Employees/SalaryInfo/AddSalaryInfo/AddSalaryInfo";

const { Option } = Select;
const { TabPane } = Tabs;

const Payslip = () => {
  const [form] = Form.useForm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddSalaryModalOpen, setIsAddSalaryModalOpen] = useState(false);
  const [combinedData, setCombinedData] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [activeTab, setActiveTab] = useState("Regular");
  const [deductions, setDeductions] = useState([]);
  const [cutOffPay, setCutOffPay] = useState(0);
  const [netPay, setNetPay] = useState(0);
  const [isFullMonthRange, setIsFullMonthRange] = useState(false);
  const [firstCutOffTotalDeductions, setFirstCutOffTotalDeductions] =
    useState(0);
  const [firstCutOffNetPay, setFirstCutOffNetPay] = useState(0);
  const [secondCutOffTotalDeductions, setSecondCutOffTotalDeductions] =
    useState(0);
  const [secondCutOffNetPay, setSecondCutOffNetPay] = useState(0);
  const [grandTotalDeductions, setGrandTotalDeductions] = useState(0);
  const [grandNetPay, setGrandNetPay] = useState(0);
  const [earningsForPeriod, setEarningsForPeriod] = useState(0);
  const [formDeductions, setFormDeductions] = useState([]);
  const [formDeductionsFirstCutOff, setFormDeductionsFirstCutOff] = useState([]);
  const [formDeductionsSecondCutOff, setFormDeductionsSecondCutOff] = useState([]);
  const [cutOffDateRange, setCutOffDateRange] = useState(null);
  const [payslipCounter, setPayslipCounter] = useState(7);

  const currentUser = secureGet("user");
  const showSalaryAmounts = currentUser?.showSalaryAmounts ?? true; // Default to true if not set

  useEffect(() => {
    fetchCombinedData();
  }, []);

  const fetchCombinedData = async () => {
    try {
      const [employeesRes, salariesRes] = await Promise.all([
        axiosInstance.get("/employees"),
        axiosInstance.get("/employee-salaries"),
      ]);

      const employees = employeesRes.data.sort((a, b) =>
        a.empNo.localeCompare(b.empNo, undefined, { numeric: true })
      );
      const salaries = salariesRes.data;

      const combined = employees.map((emp) => {
        const salary = salaries.find((sal) => sal.employeeId._id === emp._id);
        return {
          ...emp,
          salaryInfo: salary || null,
        };
      });
      setCombinedData(combined);
    } catch (err) {
      console.error("Failed to fetch combined employee and salary data", err);
      notification.error({
        message: "Error",
        description: "Failed to load employee salary data.",
      });
    }
  };

  const showGeneratePayslipModal = (record) => {
    setSelectedEmployee(record);
    setDeductions([]);

    const monthlyRate =
      record.salaryInfo?.ratePerMonth || record.salaryInfo?.basicSalary || 0;
    const dailyRate = record.salaryInfo?.dailyRate || 0;

    const today = dayjs();
    let defaultStartDate;
    let defaultEndDate;

    if (today.date() <= 15) {
      defaultStartDate = today.startOf('month');
      defaultEndDate = today.startOf('month').add(14, 'day');
    } else {
      defaultStartDate = today.startOf('month').add(15, 'day');
      defaultEndDate = today.endOf('month');
    }

    const newValues = {
      cutOffDateRange: [defaultStartDate, defaultEndDate],
      dailyRate: dailyRate,
      deductions: [],
      deductionsFirstCutOff: [],
      deductionsSecondCutOff: [],
    };

    form.setFieldsValue(newValues);
    recalcPayslip(newValues);

    setCutOffPay(monthlyRate / 2);
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setSelectedEmployee(null);
    setDeductions([]);
    form.resetFields();
  };

  const showAddSalaryModal = () => {
    setIsAddSalaryModalOpen(true);
  };

  const handleAddSalaryCancel = () => {
    setIsAddSalaryModalOpen(false);
  };

  const handleGeneratePayslip = () => {
    form.validateFields().then((values) => {
      const payslipData = {
        name: selectedEmployee.name,
        empNo: selectedEmployee.empNo,
        position: selectedEmployee.position,
        cutOffStartDate: values.cutOffDateRange[0].format("YYYY-MM-DD"),
        cutOffEndDate: values.cutOffDateRange[1].format("YYYY-MM-DD"),
        grossIncome: {
          rate: cutOffPay,
          earnPeriod: earningsForPeriod,
        },
        deductions: deductions.map((d) => ({ item: d.type, amount: d.amount })),
        totalDeductions: grandTotalDeductions,
        netPay: grandNetPay,
      };

      generatePaySlipPdf(payslipData, payslipCounter);
      setPayslipCounter((c) => c + 1);
      handleCancel();
    });
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
      width: 250,
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
      title: "Rate per Month",
      dataIndex: ["salaryInfo", "ratePerMonth"],
      key: "ratePerMonth",
      width: 120,
      render: (text, record) =>
        showSalaryAmounts
          ? text
            ? `₱${parseFloat(text).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : record.salaryInfo?.basicSalary
            ? `₱${parseFloat(record.salaryInfo.basicSalary).toLocaleString(
                undefined,
                { minimumFractionDigits: 2, maximumFractionDigits: 2 }
              )}`
            : "N/A"
          : "*****",
    },
    {
      title: "Cut off Rate",
      key: "cutOffRate",
      width: 120,
      render: (_, record) => {
        const rate =
          record.salaryInfo?.ratePerMonth || record.salaryInfo?.basicSalary;
        return showSalaryAmounts
          ? rate
            ? `₱${(rate / 2).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
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
          <Tooltip title="Generate Payslip">
            <Button
              size="small"
              type="primary"
              onClick={() => showGeneratePayslipModal(record)}
              disabled={!record.salaryInfo} // Disable if no salary info exists
            >
              Generate
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const cosColumns = [
    {
      title: "Employee Details",
      key: "employeeDetails",
      width: 250,
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
      title: "Rate per Month",
      dataIndex: ["salaryInfo", "ratePerMonth"],
      key: "ratePerMonth",
      width: 120,
      render: (text) =>
        showSalaryAmounts
          ? text
            ? `₱${parseFloat(text).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : "N/A"
          : "*****",
    },
    {
      title: "Daily Rate",
      dataIndex: ["salaryInfo", "dailyRate"],
      key: "dailyRate",
      width: 120,
      render: (text) =>
        showSalaryAmounts
          ? text
            ? `₱${parseFloat(text).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : "N/A"
          : "*****",
    },
    {
      title: "Actions",
      fixed: "right",
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="Generate Payslip">
            <Button
              size="small"
              type="primary"
              onClick={() => showGeneratePayslipModal(record)}
              disabled={!record.salaryInfo} // Disable if no salary info exists
            >
              Generate
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const recalcPayslip = (allValues) => {
    const monthlyRate =
      selectedEmployee?.salaryInfo?.ratePerMonth ||
      selectedEmployee?.salaryInfo?.basicSalary ||
      0;

    setFormDeductions(allValues.deductions || []);
    setFormDeductionsFirstCutOff(allValues.deductionsFirstCutOff || []);
    setFormDeductionsSecondCutOff(allValues.deductionsSecondCutOff || []);
    setCutOffDateRange(allValues.cutOffDateRange);

    if (!allValues.cutOffDateRange || allValues.cutOffDateRange.length < 2) {
      setNetPay(0);
      setDeductions([]);
      setIsFullMonthRange(false); // Reset
      setFirstCutOffTotalDeductions(0);
      setFirstCutOffNetPay(0);
      setSecondCutOffTotalDeductions(0);
      setSecondCutOffNetPay(0);
      setGrandTotalDeductions(0);
      setGrandNetPay(0);
      setEarningsForPeriod(0);
      return;
    }

    const [start, end] = allValues.cutOffDateRange;
    const startDate = dayjs(start);
    const endDate = dayjs(end);

    const isFullMonth =
      startDate.date() === 1 &&
      endDate.date() === endDate.daysInMonth() &&
      startDate.month() === endDate.month() &&
      startDate.year() === endDate.year();
    setIsFullMonthRange(isFullMonth);

    let baseCutOffPay = monthlyRate; // Default to full monthly rate

    if (isFullMonth) {
      baseCutOffPay = monthlyRate; // Full month, so use the full monthly rate
    } else if (startDate.date() === 1 || startDate.date() === 16) {
      // Heuristic for single cut-off: either first half or second half of the month
      // This part remains for bi-monthly payrolls
      baseCutOffPay = monthlyRate / 2;
    } else {
      // Prorated calculation for other date ranges
      const cutOffDays = endDate.diff(startDate, "day") + 1;
      const totalDaysInMonth = startDate.daysInMonth();
      const proratedDailyRate = monthlyRate / totalDaysInMonth;
      baseCutOffPay = proratedDailyRate * cutOffDays;
    }
    setEarningsForPeriod(baseCutOffPay);

    const dailyRate =
      Number(form.getFieldValue("dailyRate")) || monthlyRate / 22; // fallback
    const perHour = dailyRate / 8;
    const perMinute = perHour / 60;

    let totalDeductions = 0;
    let finalNetPay = 0;
    let combinedDeductionsList = [];

    const calculateDeductions = (deductionsArray, currentBasePay) => {
      let calculatedList = deductionsArray.map((d) => {
        if (d.type === "Absent") {
          if (!d.days) return { ...d, amount: 0 };
          const computed = d.days * dailyRate;
          return { ...d, amount: computed };
        }
        if (d.type === "Late/Undertime") {
          if (!d.value) return { ...d, amount: 0 };
          let computed = 0;
          if (d.unit === "minutes") {
            computed = d.value * perMinute;
          } else if (d.unit === "hours") {
            computed = d.value * perHour;
          }
          return { ...d, amount: computed };
        }
        return d;
      });

      // Calculate tax after other deductions for this specific cut-off
      let preTaxTotal = calculatedList
        .filter((x) => x.type !== "Tax")
        .reduce((sum, x) => sum + (parseFloat(x.amount) || 0), 0);

      calculatedList = calculatedList.map((d) => {
        if (d.type === "Tax") {
          const currentNetBeforeTax = currentBasePay - preTaxTotal;
          const computed = currentNetBeforeTax * 0.03;
          return { ...d, amount: computed };
        }
        return d;
      });

      const cutOffTotal = calculatedList.reduce(
        (sum, d) => sum + (parseFloat(d.amount) || 0),
        0
      );
      return { list: calculatedList, total: cutOffTotal };
    };

    if (isFullMonth) {
      const deductionsFirstCutOff = allValues.deductionsFirstCutOff || [];
      const deductionsSecondCutOff = allValues.deductionsSecondCutOff || [];

      const { list: list1, total: total1 } = calculateDeductions(
        deductionsFirstCutOff,
        monthlyRate / 2
      );
      const { list: list2, total: total2 } = calculateDeductions(
        deductionsSecondCutOff,
        monthlyRate / 2
      );

      form.setFieldsValue({
        deductionsFirstCutOff: list1,
        deductionsSecondCutOff: list2,
      });

      setFirstCutOffTotalDeductions(total1);
      setFirstCutOffNetPay(monthlyRate / 2 - total1);

      setSecondCutOffTotalDeductions(total2);
      setSecondCutOffNetPay(monthlyRate / 2 - total2);

      combinedDeductionsList = [...list1, ...list2];
      totalDeductions = total1 + total2;
      finalNetPay = monthlyRate - totalDeductions;
    } else {
      let deductionsList = allValues.deductions || [];
      const { list: list, total: total } = calculateDeductions(
        deductionsList,
        baseCutOffPay
      );

      form.setFieldsValue({ deductions: list });

      // When not full month, these will be the same as grand totals
      setFirstCutOffTotalDeductions(0);
      setFirstCutOffNetPay(0);
      setSecondCutOffTotalDeductions(0);
      setSecondCutOffNetPay(0);

      combinedDeductionsList = list;
      totalDeductions = total;
      finalNetPay = baseCutOffPay - totalDeductions;
    }

    setGrandTotalDeductions(totalDeductions);
    setGrandNetPay(finalNetPay);

    setNetPay(finalNetPay);
    setDeductions(combinedDeductionsList); // Update the main deductions state for summary display
  };

  return (
    <div className="payslip-container">
      <div className="payslip-filters">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <Input
            placeholder="Search any keyword..."
            prefix={<SearchOutlined />}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            allowClear
            style={{ width: 350 }}
          />
          <Button type="primary" onClick={showAddSalaryModal}>
            Add Salary Info
          </Button>
        </div>

        <Modal
          open={isAddSalaryModalOpen}
          onCancel={handleAddSalaryCancel}
          footer={null}
          title="Add Employee Salary Information"
          destroyOnHidden
          centered
          width={700}
        >
          <AddSalaryInfo
            onClose={() => {
              handleAddSalaryCancel();
              fetchCombinedData();
            }}
          />
        </Modal>

        <GeneratePayslipModal
          isModalOpen={isModalOpen}
          handleCancel={handleCancel}
          handleGeneratePayslip={handleGeneratePayslip}
          selectedEmployee={selectedEmployee}
          form={form}
          recalcPayslip={recalcPayslip}
          showSalaryAmounts={showSalaryAmounts}
          cutOffPay={cutOffPay}
          isFullMonthRange={isFullMonthRange}
          firstCutOffTotalDeductions={firstCutOffTotalDeductions}
          firstCutOffNetPay={firstCutOffNetPay}
          secondCutOffTotalDeductions={secondCutOffTotalDeductions}
          secondCutOffNetPay={secondCutOffNetPay}
          grandTotalDeductions={grandTotalDeductions}
          grandNetPay={grandNetPay}
          earningsForPeriod={earningsForPeriod}
          formDeductions={formDeductions}
          formDeductionsFirstCutOff={formDeductionsFirstCutOff}
          formDeductionsSecondCutOff={formDeductionsSecondCutOff}
          cutOffDateRange={cutOffDateRange}
          payslipNumber={payslipCounter}
        />

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          className="payslip-tabs"
        >
          <TabPane tab="Regular" key="Regular">
            <Table
              columns={regularColumns}
              dataSource={getFilteredData(combinedData, "Regular")}
              rowKey="_id"
              scroll={{ x: "max-content" }}
              pagination={{ pageSize: 10 }}
              loading={!combinedData.length}
              className="payslip-table"
            />
          </TabPane>
          <TabPane tab="Contract of Service" key="Contract of Service">
            <Table
              columns={cosColumns}
              dataSource={getFilteredData(combinedData, "Contract of Service")}
              rowKey="_id"
              scroll={{ x: "max-content" }}
              pagination={{ pageSize: 10 }}
              loading={!combinedData.length}
              className="payslip-table"
            />
          </TabPane>
        </Tabs>
      </div>
    </div>
  );
};

export default Payslip;

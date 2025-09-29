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
import {
  generatePaySlipPdf,
  openPayslipInNewTab,
} from "../../../../../utils/generatePaySlip.js";
import {
  generatePaySlipPdfRegular,
  openPayslipInNewTabRegular,
} from "../../../../../utils/generatePaySlipRegular.js";
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
  const [formDeductionsFirstCutOff, setFormDeductionsFirstCutOff] = useState(
    []
  );
  const [formDeductionsSecondCutOff, setFormDeductionsSecondCutOff] = useState(
    []
  );
  const [cutOffDateRange, setCutOffDateRange] = useState(null);

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
    const monthlyRate =
      record.salaryInfo?.ratePerMonth || record.salaryInfo?.basicSalary || 0;
    const dailyRate = record.salaryInfo?.dailyRate || 0;

    const today = dayjs();
    let defaultStartDate;
    let defaultEndDate;

    if (today.date() <= 15) {
      defaultStartDate = today.startOf("month");
      defaultEndDate = today.startOf("month").add(14, "day");
    } else {
      defaultStartDate = today.startOf("month").add(15, "day");
      defaultEndDate = today.endOf("month");
    }

    const newValues = {
      cutOffDateRange: [defaultStartDate, defaultEndDate],
      dailyRate: dailyRate,
      deductions: [],
      deductionsFirstCutOff: [],
      deductionsSecondCutOff: [],
    };

    form.setFieldsValue(newValues);
    recalcPayslip(newValues, []);

    setCutOffPay(monthlyRate / 2);
    setIsModalOpen(true);
    setSelectedEmployee(record);
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

  const handlePayslipGeneration = async (
    payslipData,
    isFullMonthRange,
    actionType
  ) => {
    try {
      const payload = {
        empId: payslipData.empId,
        docType: "Payslip",
        reference: `Payslip for ${payslipData.cutOffStartDate} to ${payslipData.cutOffEndDate}`,
        period: `${payslipData.cutOffStartDate} - ${payslipData.cutOffEndDate}`,
        dateIssued: dayjs().toISOString(),
        description: `Payslip for ${payslipData.cutOffStartDate} to ${payslipData.cutOffEndDate}`,
        createdBy: currentUser?.username || "Admin",
      };

      const response = await axiosInstance.post("/employee-docs", payload);
      const { data: doc, isNew } = response.data;
      const { docNo } = doc;

      if (selectedEmployee.empType === "Regular") {
        if (actionType === "view") {
          openPayslipInNewTabRegular(payslipData, docNo, isFullMonthRange);
        } else if (actionType === "download") {
          generatePaySlipPdfRegular(payslipData, docNo, isFullMonthRange);
        }
      } else {
        if (actionType === "view") {
          openPayslipInNewTab(payslipData, docNo, isFullMonthRange);
        } else if (actionType === "download") {
          generatePaySlipPdf(payslipData, docNo, isFullMonthRange);
        }
      }

      notification.success({
        message: "Success",
        description: `Payslip ${
          isNew ? "generated" : "updated"
        } successfully with No. ${docNo}.`,
      });
      handleCancel();
    } catch (error) {
      console.error("Failed to generate payslip:", error);
      notification.error({
        message: "Error",
        description: "Failed to generate payslip. Please try again.",
      });
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

  const recalcPayslip = (allValues, deductionTypes) => {
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
    let totalIncentives = 0;
    let finalNetPay = 0;
    let combinedItemsList = [];

    const calculateItems = (itemsArray, currentBasePay) => {
      let calculatedList = itemsArray.map((d) => {
        const itemType = deductionTypes.find(dt => dt.name === d.type);
        if (itemType && itemType.calculationType === 'formula') {
            const formula = itemType.formula.toLowerCase().replace(/\s/g, '');
            if (formula === 'monthlyrate*2' || formula === 'monthlysalary*2') {
                return { ...d, amount: monthlyRate * 2 };
            } else if (formula === 'monthlyrate' || formula === 'monthlysalary') {
                return { ...d, amount: monthlyRate };
            }
        }
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

      const deductions = calculatedList.filter(item => {
        const type = deductionTypes.find(d => d.name === item.type);
        return !type || type.type === 'deduction';
      });

      const incentives = calculatedList.filter(item => {
        const type = deductionTypes.find(d => d.name === item.type);
        return type && type.type === 'incentive';
      });

      // Calculate tax after other deductions for this specific cut-off
      let preTaxTotal = deductions
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

      const cutOffTotalDeductions = deductions.reduce(
        (sum, d) => sum + (parseFloat(d.amount) || 0),
        0
      );
      const cutOffTotalIncentives = incentives.reduce(
        (sum, i) => sum + (parseFloat(i.amount) || 0),
        0
      );

      return { list: calculatedList, totalDeductions: cutOffTotalDeductions, totalIncentives: cutOffTotalIncentives };
    };

    if (isFullMonth) {
      const itemsFirstCutOff = allValues.deductionsFirstCutOff || [];
      const itemsSecondCutOff = allValues.deductionsSecondCutOff || [];

      const { list: list1, totalDeductions: totalDeductions1, totalIncentives: totalIncentives1 } = calculateItems(
        itemsFirstCutOff,
        monthlyRate / 2
      );
      const { list: list2, totalDeductions: totalDeductions2, totalIncentives: totalIncentives2 } = calculateItems(
        itemsSecondCutOff,
        monthlyRate / 2
      );

      form.setFieldsValue({
        deductionsFirstCutOff: list1,
        deductionsSecondCutOff: list2,
      });

      setFirstCutOffTotalDeductions(totalDeductions1);
      setFirstCutOffNetPay(monthlyRate / 2 + totalIncentives1 - totalDeductions1);

      setSecondCutOffTotalDeductions(totalDeductions2);
      setSecondCutOffNetPay(monthlyRate / 2 + totalIncentives2 - totalDeductions2);

      combinedItemsList = [...list1, ...list2];
      totalDeductions = totalDeductions1 + totalDeductions2;
      totalIncentives = totalIncentives1 + totalIncentives2;
      finalNetPay = monthlyRate + totalIncentives - totalDeductions;
    } else {
      let itemsList = allValues.deductions || [];
      const { list: list, totalDeductions: total, totalIncentives: incentivesTotal } = calculateItems(
        itemsList,
        baseCutOffPay
      );

      form.setFieldsValue({ deductions: list });

      // When not full month, these will be the same as grand totals
      setFirstCutOffTotalDeductions(0);
      setFirstCutOffNetPay(0);
      setSecondCutOffTotalDeductions(0);
      setSecondCutOffNetPay(0);

      combinedItemsList = list;
      totalDeductions = total;
      totalIncentives = incentivesTotal;
      finalNetPay = baseCutOffPay + totalIncentives - totalDeductions;
    }

    setGrandTotalDeductions(totalDeductions);
    setGrandNetPay(finalNetPay);

    setNetPay(finalNetPay);
    setDeductions(combinedItemsList); // Update the main deductions state for summary display
  };

  return (
    <div className="payslip-container">
      <Form form={form} component={false}>
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
            handleGeneratePayslip={handlePayslipGeneration}
            handleCancel={handleCancel}
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
      </Form>
    </div>
  );
};

export default Payslip;

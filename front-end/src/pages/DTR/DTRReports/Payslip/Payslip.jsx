import React, { useEffect, useState } from "react";
import {
  Input,
  Select,
  Button,
  Table,
  Space,
  Tag,
  Modal,
  Tooltip,
  notification,
  Tabs,
  Form,
  InputNumber,
  Row,
  Col,
  DatePicker,
  Card,
} from "antd";
import {
  SearchOutlined,
  MinusCircleOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import axiosInstance from "../../../../api/axiosInstance";
import dayjs from "dayjs";
import generatePaySlipPdf from "../../../../../utils/generatePaySlip.js";
import "./payslip.css";

const { Option } = Select;
const { TabPane } = Tabs;

const Payslip = () => {
  const [form] = Form.useForm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [employeeData, setEmployeeData] = useState([]);
  const [employeeSalaryData, setEmployeeSalaryData] = useState([]);
  const [combinedData, setCombinedData] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [activeTab, setActiveTab] = useState("Regular");
  const [deductions, setDeductions] = useState([]);
  const [cutOffPay, setCutOffPay] = useState(0);
  const [netPay, setNetPay] = useState(0);
  const [withholdingTax, setWithholdingTax] = useState(0);
  const [isFullMonthRange, setIsFullMonthRange] = useState(false);
  const [firstCutOffTotalDeductions, setFirstCutOffTotalDeductions] = useState(0);
  const [firstCutOffNetPay, setFirstCutOffNetPay] = useState(0);
  const [secondCutOffTotalDeductions, setSecondCutOffTotalDeductions] = useState(0);
  const [secondCutOffNetPay, setSecondCutOffNetPay] = useState(0);
  const [grandTotalDeductions, setGrandTotalDeductions] = useState(0);
  const [grandNetPay, setGrandNetPay] = useState(0);
  const [earningsForPeriod, setEarningsForPeriod] = useState(0);

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
      setEmployeeData(employees);
      setEmployeeSalaryData(salaries);
      setCombinedData(combined);
    } catch (err) {
      console.error("Failed to fetch combined employee and salary data", err);
      notification.error({
        message: "Error",
        description: "Failed to load employee salary data.",
      });
    }
  };

  useEffect(() => {
    fetchCombinedData();
  }, []);

  const showGeneratePayslipModal = (record) => {
    setSelectedEmployee(record);
    setDeductions([]); // Reset deductions for new payslip
    const monthlyRate =
      record.salaryInfo?.ratePerMonth || record.salaryInfo?.basicSalary || 0;
    form.setFieldsValue({
      cutOffDateRange: null,
      dailyRate: record.salaryInfo?.dailyRate || 0,
    });
    setCutOffPay(monthlyRate / 2);
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setSelectedEmployee(null);
    setDeductions([]);
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

      generatePaySlipPdf(payslipData);
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
        text
          ? `₱${parseFloat(text).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : record.salaryInfo?.basicSalary
          ? `₱${parseFloat(record.salaryInfo.basicSalary).toLocaleString(
              undefined,
              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )}`
          : "N/A",
    },
    {
      title: "Cut off Rate",
      key: "cutOffRate",
      width: 120,
      render: (_, record) => {
        const rate =
          record.salaryInfo?.ratePerMonth || record.salaryInfo?.basicSalary;
        return rate
          ? `₱${(rate / 2).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : "N/A";
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
        text
          ? `₱${parseFloat(text).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : "N/A",
    },
    {
      title: "Daily Rate",
      dataIndex: ["salaryInfo", "dailyRate"],
      key: "dailyRate",
      width: 120,
      render: (text) =>
        text
          ? `₱${parseFloat(text).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : "N/A",
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

      const { list: list1, total: total1 } = calculateDeductions(deductionsFirstCutOff, monthlyRate / 2);
      const { list: list2, total: total2 } = calculateDeductions(deductionsSecondCutOff, monthlyRate / 2);

      form.setFieldsValue({ 
        deductionsFirstCutOff: list1,
        deductionsSecondCutOff: list2 
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
      const { list: list, total: total } = calculateDeductions(deductionsList, baseCutOffPay);

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

  const DeductionRow = ({
    fieldNamePrefix,
    name,
    restField,
    remove,
    form,
    selectedEmployee,
  }) => {
    const type = form.getFieldValue([fieldNamePrefix, name, "type"]);
    const dailyRate =
      Number(form.getFieldValue("dailyRate")) ||
      Math.round(
        (selectedEmployee.salaryInfo?.ratePerMonth ||
          selectedEmployee.salaryInfo?.basicSalary ||
          0) / 22
      );

    return (
      <Space
        key={name}
        style={{ display: "flex", width: "100%", alignItems: "center" }}
        align="baseline"
      >
        <div style={{ display: "flex", gap: "8px", flex: 1 }}>
          {/* Deduction Type */}
          <Form.Item
            {...restField}
            name={[name, "type"]}
            rules={[{ required: true, message: "Select deduction type" }]}
            style={{ width: "160px" }}
          >
            <Select placeholder="Deduction Type" onChange={() => form.submit()}>
              <Option value="Absent">Absent</Option>
              <Option value="Late/Undertime">Late/Undertime</Option>
              <Option value="Tax">Tax (3%)</Option>
              <Option value="Other">Other</Option>
            </Select>
          </Form.Item>

          {/* Absent Input (Days) */}
          {type === "Absent" && (
            <>
              <Form.Item
                {...restField}
                name={[name, "days"]}
                rules={[{ required: true, message: "Enter days" }]}
              >
                <InputNumber
                  min={0}
                  placeholder="Days"
                  onChange={(val) => {
                    const computed = val * dailyRate;
                    form.setFieldValue(
                      [fieldNamePrefix, name, "amount"],
                      computed
                    );
                    form.submit();
                  }}
                  style={{ width: "100px" }}
                />
              </Form.Item>

              <Form.Item
                {...restField}
                name={[name, "amount"]}
                style={{ width: "150px" }}
              >
                <InputNumber
                  min={0}
                  onChange={() => form.submit()}
                  formatter={(value) =>
                    `₱${parseFloat(value || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  }
                  parser={(value) => value.replace(/₱\s?|(,*)/g, "")}
                   style={{ width: "110px" }}
                />
              </Form.Item>
            </>
          )}

          {/* Late/Undertime */}
          {type === "Late/Undertime" && (
            <>
              <Form.Item
                {...restField}
                name={[name, "unit"]}
                initialValue="minutes"
                style={{ width: "100px" }}
              >
                <Select onChange={() => form.submit()}>
                  <Option value="minutes">Minutes</Option>
                  <Option value="hours">Hours</Option>
                </Select>
              </Form.Item>

              <Form.Item
                {...restField}
                name={[name, "value"]}
                rules={[{ required: true, message: "Enter value" }]}
              >
                <InputNumber
                  min={0}
                  placeholder="Value"
                  onChange={(val) => {
                    const unit = form.getFieldValue([
                      fieldNamePrefix,
                      name,
                      "unit",
                    ]);
                    let computed = 0;
                    if (unit === "minutes") {
                      const perMinute = dailyRate / (8 * 60);
                      computed = val * perMinute;
                    } else if (unit === "hours") {
                      const perHour = dailyRate / 8;
                      computed = val * perHour;
                    }
                    form.setFieldValue(
                      [fieldNamePrefix, name, "amount"],
                      computed
                    );
                    form.submit();
                  }}
                />
              </Form.Item>

              <Form.Item
                {...restField}
                name={[name, "amount"]}
                style={{ width: "150px" }}
              >
                <InputNumber
                  min={0}
                  precision={2}
                  onChange={() => form.submit()}
                  formatter={(value) =>
                    `₱${parseFloat(value || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  }
                  parser={(value) => value.replace(/₱\s?|(,*)/g, "")}
                   style={{ width: "110px" }}
                />
              </Form.Item>
            </>
          )}

          {/* Tax */}
          {type === "Tax" && (
            <Form.Item
              {...restField}
              name={[name, "amount"]}
              style={{ width: "150px" }}
            >
              <InputNumber
                min={0}
                readOnly
                placeholder="Calculated Tax"
                formatter={(value) =>
                  `₱${parseFloat(value || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                }
                parser={(value) => value.replace(/₱\s?|(,*)/g, "")}
                style={{ width: "100px" }}
              />
            </Form.Item>
          )}

          {/* Other Manual */}
          {type === "Other" && (
            <Form.Item
              {...restField}
              name={[name, "amount"]}
              rules={[{ required: true, message: "Enter amount" }]}
              style={{ width: "150px" }}
            >
              <InputNumber
                min={0}
                onChange={() => form.submit()}
                formatter={(value) =>
                  `₱${parseFloat(value || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                }
                parser={(value) => value.replace(/₱\s?|(,*)/g, "")}
                 style={{ width: "110px" }}
              />
            </Form.Item>
          )}
        </div>

        {/* Remove Button */}
        <Button
          type="primary"
          danger
          icon={<MinusCircleOutlined />}
          onClick={() => remove(name)}
          style={{ marginBottom: 24, right: 40 }}
        />
      </Space>
    );
  };

  return (
    <div className="payslip-container">
      <div className="payslip-header">
        <h2>Generate Payslips</h2>
      </div>

      <div className="payslip-filters">
        <Space className="filters-left" wrap>
          <Input
            placeholder="Search any keyword..."
            prefix={<SearchOutlined />}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            allowClear
            style={{ width: 350 }}
          />
        </Space>
      </div>

      <Tabs
        defaultActiveKey="Regular"
        activeKey={activeTab}
        onChange={setActiveTab}
      >
        <TabPane tab="Regular Employees" key="Regular">
          <div className="payslip-table">
            <Table
              columns={regularColumns}
              dataSource={getFilteredData(combinedData, "Regular")}
              pagination={{ pageSize: 10 }}
              rowKey="_id"
              size="small"
            />
          </div>
        </TabPane>
        <TabPane tab="Contract of Service" key="Contract of Service">
          <div className="payslip-table">
            <Table
              columns={cosColumns}
              dataSource={getFilteredData(combinedData, "Contract of Service")}
              pagination={{ pageSize: 10 }}
              rowKey="_id"
              size="small"
            />
          </div>
        </TabPane>
      </Tabs>

      <Modal
        open={isModalOpen}
        onCancel={handleCancel}
        footer={[
          <Button key="back" onClick={handleCancel}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            onClick={handleGeneratePayslip}
          >
            Generate Payslip
          </Button>,
        ]}
        title="Generate Payslip"
        centered
        width={700}
      >
        {selectedEmployee && (
          <div className="payslip-modal-content">
            <Form
              form={form}
              layout="vertical"
              onValuesChange={(_, allValues) => recalcPayslip(allValues)}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h3>Employee Details</h3>
                <Form.Item
                  name="cutOffDateRange"
                  rules={[
                    {
                      required: true,
                      message: "Please select cut-off date range!",
                    },
                  ]}
                  style={{ marginBottom: 0 }}
                >
                  <DatePicker.RangePicker size="small" format="MM/DD/YYYY" />
                </Form.Item>
              </div>
              {/* Employee info */}
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label="Employee ID">
                    <Input value={selectedEmployee.empId} disabled />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Employee No">
                    <Input value={selectedEmployee.empNo} disabled />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Salary Type">
                    <Input value={selectedEmployee.empType} disabled />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Name">
                    <Input value={selectedEmployee.name} disabled />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Position">
                    <Input value={selectedEmployee.position} disabled />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label="Rate per Month">
                    <Input
                      value={`₱${(
                        selectedEmployee.salaryInfo?.ratePerMonth ||
                        selectedEmployee.salaryInfo?.basicSalary ||
                        0
                      ).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Rate per Cut Off">
                    <Input
                      value={`₱${cutOffPay.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                    />
                  </Form.Item>
                </Col>

                <Col span={8}>
                  <Form.Item
                    label="Daily Rate"
                    name="dailyRate"
                    initialValue={Math.round(
                      (selectedEmployee.salaryInfo?.ratePerMonth ||
                        selectedEmployee.salaryInfo?.basicSalary ||
                        0) / 22
                    )}
                  >
                    <InputNumber
                      min={0}
                      formatter={(value) =>
                        `₱${parseFloat(value || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      }
                      parser={(value) => value.replace(/₱\s?|(,*)/g, "")}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </Col>
              </Row>
              {/* Deduction Section */}
              <h3>Add Deductions</h3>

              {isFullMonthRange ? (
                <>
                  {/* First Cut-Off */}
                  <Card
                    title={`1st Cut-Off (1–15 ${dayjs(
                      form.getFieldValue("cutOffDateRange")?.[0]
                    ).format("MMMM YYYY")})`}
                    size="small"
                    style={{ marginBottom: 16 }}
                  >
                    <Form.List name="deductionsFirstCutOff">
                      {(fields, { add, remove }) => (
                        <>
                          {fields.map(({ key, name, ...restField }) => (
                            <DeductionRow
                              key={key}
                              fieldNamePrefix="deductionsFirstCutOff"
                              name={name}
                              restField={restField}
                              remove={remove}
                              form={form}
                              selectedEmployee={selectedEmployee}
                            />
                          ))}
                          <Row gutter={16} style={{ width: '100%', marginTop: '16px' }}>
                            <Col span={12}>
                              <Form.Item label="Total Deductions">
                                <Input
                                  value={`₱${firstCutOffTotalDeductions.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}`}
                                  disabled
                                />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item label="Net Pay">
                                <Input
                                  value={`₱${firstCutOffNetPay.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}`}
                                  disabled
                                />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Form.Item>
                            <Button
                              type="primary"
                              onClick={() => add({ type: "Other", amount: 0 })}
                              block
                              icon={<PlusOutlined />}
                            >
                              Add Deduction (1st Cut-Off)
                            </Button>
                          </Form.Item>
                        </>
                      )}
                    </Form.List>
                  </Card>

                  {/* Second Cut-Off */}
                  <Card
                    title={`2nd Cut-Off (16–${dayjs(
                      form.getFieldValue("cutOffDateRange")?.[1]
                    ).daysInMonth()} ${dayjs(
                      form.getFieldValue("cutOffDateRange")?.[1]
                    ).format("MMMM YYYY")})`}
                    size="small"
                  >
                    <Form.List name="deductionsSecondCutOff">
                      {(fields, { add, remove }) => (
                        <>
                          {fields.map(({ key, name, ...restField }) => (
                            <DeductionRow
                              key={key}
                              fieldNamePrefix="deductionsSecondCutOff"
                              name={name}
                              restField={restField}
                              remove={remove}
                              form={form}
                              selectedEmployee={selectedEmployee}
                            />
                          ))}
                          <Row gutter={16} style={{ width: '100%', marginTop: '16px' }}>
                            <Col span={12}>
                              <Form.Item label="Total Deductions">
                                <Input
                                  value={`₱${secondCutOffTotalDeductions.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}`}
                                  disabled
                                />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item label="Net Pay">
                                <Input
                                  value={`₱${secondCutOffNetPay.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}`}
                                  disabled
                                />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Form.Item>
                            <Button
                              type="primary"
                              onClick={() => add({ type: "Other", amount: 0 })}
                              block
                              icon={<PlusOutlined />}
                            >
                              Add Deduction (2nd Cut-Off)
                            </Button>
                          </Form.Item>
                        </>
                      )}
                    </Form.List>
                  </Card>
                </>
              ) : (
                <>
                  {/* Single Deduction List */}
                  <Form.List name="deductions">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map(({ key, name, ...restField }) => (
                          <DeductionRow
                            key={key}
                            fieldNamePrefix="deductions"
                            name={name}
                            restField={restField}
                            remove={remove}
                            form={form}
                            selectedEmployee={selectedEmployee}
                          />
                        ))}
                        <Form.Item>
                          <Button
                            type="primary"
                            onClick={() => add({ type: "Other", amount: 0 })}
                            block
                            icon={<PlusOutlined />}
                          >
                            Add Deduction
                          </Button>
                        </Form.Item>
                      </>
                    )}
                  </Form.List>
                </>
              )}
            </Form>

            {/* Grand Payslip Summary */}
            <div className="payslip-summary">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Grand Total Deductions">
                    <Input
                      value={`₱${grandTotalDeductions.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                      readOnly
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Grand Net Pay">
                    <Input
                      value={`₱${grandNetPay.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                      readOnly
                    />
                  </Form.Item>
                </Col>
              </Row>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Payslip;

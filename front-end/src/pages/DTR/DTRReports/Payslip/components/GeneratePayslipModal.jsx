import React, { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Form,
  Input,
  Row,
  Col,
  DatePicker,
  Card,
  InputNumber,
  Space,
  Select,
  Spin,
  Dropdown,
  Menu,
  notification,
  Switch,
  Tag,
} from "antd";
import {
  MinusCircleOutlined,
  PlusOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { generatePaySlipPreview } from "../../../../../../utils/generatePaySlip.js";
import { generatePaySlipPreviewRegular } from "../../../../../../utils/generatePaySlipRegular.js";
import axiosInstance from "../../../../../api/axiosInstance.js";

const DeductionRow = ({
  fieldNamePrefix,
  name,
  restField,
  remove,
  form,
  selectedEmployee,
  showSalaryAmounts,
  deductionTypes,
}) => {
  const itemType = form.getFieldValue([fieldNamePrefix, name, "type"]);
  const empType = selectedEmployee?.empType;

  const colorStyle =
    itemType === "Tax" ||
    deductionTypes.find((d) => d.name === itemType)?.type === "deduction"
      ? { color: "red", fontWeight: 600 }
      : deductionTypes.find((d) => d.name === itemType)?.type === "incentive"
      ? { color: "green", fontWeight: 600 }
      : {};

  return (
    <Row gutter={8} align="middle" style={{ marginBottom: 4 }}>
      <Col span={8}>
        <Form.Item
          {...restField}
          name={[name, "type"]}
          style={{ marginBottom: 0 }}
        >
          <Select placeholder="Select Deduction/Incentive" size="small">
            {deductionTypes.map((dt) => (
              <Select.Option key={dt.name} value={dt.name}>
                {dt.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item
          {...restField}
          name={[name, "amount"]}
          style={{ marginBottom: 0 }}
        >
          <InputNumber
            size="small"
            min={0}
            precision={2}
            style={{ width: "100%", ...colorStyle }}
            readOnly={!(empType === "Regular")} // ✅ editable only for Regulars
            formatter={(value) =>
              showSalaryAmounts
                ? `₱${parseFloat(value || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : "*****"
            }
            parser={(value) => value.replace(/₱\s?|(,*)/g, "")}
            onChange={() => form.submit()}
          />
        </Form.Item>
      </Col>
      <Col span={4}>
        <Button
          type="text"
          size="small"
          danger
          icon={<MinusCircleOutlined />}
          onClick={() => remove(name)}
        />
      </Col>
    </Row>
  );
};

const GeneratePayslipModal = ({
  isModalOpen,
  handleCancel,
  handleGeneratePayslip,
  selectedEmployee,
  form,
  recalcPayslip,
  showSalaryAmounts,
  cutOffPay,
  isFullMonthRange,
  firstCutOffTotalDeductions,
  firstCutOffNetPay,
  secondCutOffTotalDeductions,
  secondCutOffNetPay,
  grandTotalDeductions,
  grandNetPay,
  earningsForPeriod,
  formDeductions,
  formDeductionsFirstCutOff,
  formDeductionsSecondCutOff,
  cutOffDateRange,
  firstCutOffGross,
  secondCutOffGross,
  monthlyRate,
}) => {
  const [pdfPreview, setPdfPreview] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [currentPayslipData, setCurrentPayslipData] = useState(null);
  const [payslipNumber, setPayslipNumber] = useState(null);
  const [deductionTypes, setDeductionTypes] = useState([]);

  useEffect(() => {
    const fetchDeductionTypes = async () => {
      try {
        const response = await axiosInstance.get("/deduction-types");
        setDeductionTypes(response.data);
      } catch (error) {
        notification.error({ message: "Failed to fetch deduction types" });
      }
    };

    fetchDeductionTypes();
  }, []);

  useEffect(() => {
    const generatePreview = async () => {
      setIsPreviewLoading(true);

      if (!isModalOpen || !selectedEmployee || !cutOffDateRange) {
        setPdfPreview(null);
        setIsPreviewLoading(false);
        return;
      }

      // Fetch payslip number
      const period = `${dayjs(cutOffDateRange[0]).format(
        "YYYY-MM-DD"
      )} - ${dayjs(cutOffDateRange[1]).format("YYYY-MM-DD")}`;
      let currentPayslipNo = null;
      try {
        const res = await axiosInstance.get(
          `/employee-docs/next-payslip-number/${selectedEmployee.empId}`,
          { params: { period } }
        );
        currentPayslipNo = res.data.nextPayslipNumber;
        setPayslipNumber(currentPayslipNo);
      } catch (err) {
        console.error("Failed to fetch next payslip number", err);
        notification.error({
          message: "Error",
          description: "Failed to fetch next payslip number.",
        });
        setIsPreviewLoading(false);
        return;
      }

      const ratePerMonthValue = form.getFieldValue("ratePerMonth");
      const peraAcaValue = form.getFieldValue("peraAca") || 0;
      const peraAcaCutOff = form.getFieldValue("peraAcaCutOff") || "first";

      const cutOffPayValue = form.getFieldValue("cutOffPay");

      const secondPeriodEarned =
        form.getFieldValue("secondCutOffGrossAmount") ?? ratePerMonthValue / 2;
      const firstCutOffNetPayValue =
        form.getFieldValue("firstCutOffNetPay") ?? firstCutOffNetPay;

      // Helper for tax calculations
      const calculateTax = (earnings, deductions) => {
        const otherDeductions = (deductions || []).filter(
          (d) => d && d.type !== "Tax"
        );
        const totalOtherDeductions = otherDeductions.reduce(
          (sum, d) => sum + (d.amount || 0),
          0
        );
        const taxableIncome = earnings - totalOtherDeductions;
        return taxableIncome > 0 ? taxableIncome * 0.03 : 0;
      };

      const updateDeductionsAndTax = (
        deductions,
        earnings,
        fieldNamePrefix
      ) => {
        if (!deductions || selectedEmployee.empType === "Regular")
          return deductions;

        const newTaxAmount = calculateTax(earnings, deductions);
        const taxIndex = deductions.findIndex((d) => d && d.type === "Tax");

        if (taxIndex !== -1 && deductions[taxIndex].amount !== newTaxAmount) {
          setTimeout(() => {
            const currentDeductions = form.getFieldValue(fieldNamePrefix) || [];
            if (currentDeductions[taxIndex]) {
              const newDeductions = [...currentDeductions];
              newDeductions[taxIndex] = {
                ...newDeductions[taxIndex],
                amount: newTaxAmount,
              };
              form.setFieldsValue({ [fieldNamePrefix]: newDeductions });
            }
          }, 0);
        }

        return deductions.map((d) =>
          d && d.type === "Tax" ? { ...d, amount: newTaxAmount } : d
        );
      };

      const updatedFormDeductionsFirstCutOff = updateDeductionsAndTax(
        formDeductionsFirstCutOff,
        cutOffPayValue,
        "deductionsFirstCutOff"
      );
      const updatedFormDeductionsSecondCutOff = updateDeductionsAndTax(
        formDeductionsSecondCutOff,
        secondPeriodEarned,
        "deductionsSecondCutOff"
      );

      if (selectedEmployee.empType === "Regular") {
        // Aggregate deductions & incentives
        const allItems = isFullMonthRange
          ? [
              ...(form.getFieldValue("deductionsFirstCutOff") || []).map(
                (d) => ({ ...d, cutoff: 1 })
              ),
              ...(form.getFieldValue("deductionsSecondCutOff") || []).map(
                (d) => ({ ...d, cutoff: 2 })
              ),
            ]
          : (form.getFieldValue("deductions") || []).map((d) => ({
              ...d,
              cutoff: 1,
            }));

        const deductions = allItems.filter((item) => {
          const type = deductionTypes.find((d) => d.name === item.type);
          return !type || type.type === "deduction";
        });

        const incentives = allItems.filter((item) => {
          const type = deductionTypes.find((d) => d.name === item.type);
          return type && type.type === "incentive";
        });

        // Add PERA/ACA dynamically to the selected cut-off
        if (peraAcaValue > 0) {
          incentives.push({
            type: "PERA/ACA",
            amount: peraAcaValue,
            cutoff: peraAcaCutOff === "first" ? 1 : 2,
          });
        }

        const firstCutNet =
          peraAcaCutOff === "first"
            ? firstCutOffNetPay + peraAcaValue
            : firstCutOffNetPay;
        const secondCutNet =
          peraAcaCutOff === "second"
            ? secondCutOffNetPay + peraAcaValue
            : secondCutOffNetPay;

        const finalNetPay =
          form.getFieldValue("grandTotalNetPay") ?? grandNetPay;

        const payslipData = {
          name: selectedEmployee.name,
          empId: selectedEmployee.empId,
          position: selectedEmployee.position,
          empType: selectedEmployee.empType,
          cutOffStartDate: dayjs(cutOffDateRange[0]).format("YYYY-MM-DD"),
          cutOffEndDate: dayjs(cutOffDateRange[1]).format("YYYY-MM-DD"),
          grossIncome: {
            monthlySalary: ratePerMonthValue,
            grossAmountEarned: earningsForPeriod,
          },
          deductions,
          incentives,
          totalDeductions: grandTotalDeductions,
          netPay: finalNetPay,
          firstCutOffNetPay: firstCutNet,
          secondCutOffNetPay: secondCutNet,
          secondPeriodEarned: secondPeriodEarned,
        };

        setCurrentPayslipData(payslipData);
        const previewUri = generatePaySlipPreviewRegular(
          payslipData,
          currentPayslipNo,
          isFullMonthRange
        );
        setPdfPreview(previewUri);
      } else {
        // Contract employees
        const payslipData = {
          name: selectedEmployee.name,
          empId: selectedEmployee.empId,
          position: selectedEmployee.position,
          empType: selectedEmployee.empType,
          cutOffStartDate: dayjs(cutOffDateRange[0]).format("YYYY-MM-DD"),
          cutOffEndDate: dayjs(cutOffDateRange[1]).format("YYYY-MM-DD"),
          grossIncome: {
            rate: cutOffPayValue,
            earnPeriod: earningsForPeriod,
          },
          secondPeriodRatePerMonth: ratePerMonthValue,
          secondPeriodEarnedForPeriod: secondPeriodEarned,
          firstCutOffDeductions: updatedFormDeductionsFirstCutOff,
          firstCutOffTotalDeductions: firstCutOffTotalDeductions,
          secondCutOffDeductions: updatedFormDeductionsSecondCutOff,
          secondCutOffTotalDeductions: secondCutOffTotalDeductions,
          deductions: isFullMonthRange
            ? [
                ...(form.getFieldValue("deductionsFirstCutOff") || []).map(
                  (d) => ({
                    name: d.type,
                    days: d.days,
                    unit: d.unit,
                    value: d.value,
                    cutoff: 1,
                    amount: d.amount,
                  })
                ),
                ...(form.getFieldValue("deductionsSecondCutOff") || []).map(
                  (d) => ({
                    name: d.type,
                    days: d.days,
                    unit: d.unit,
                    value: d.value,
                    cutoff: 2,
                    amount: d.amount,
                  })
                ),
              ]
            : (form.getFieldValue("deductions") || []).map((d) => ({
                name: d.type,
                cutoff: 1,
                days: d.days,
                unit: d.unit,
                value: d.value,
                amount: d.amount,
              })),
          totalDeductions: grandTotalDeductions,
          netPay: grandNetPay,
        };

        setCurrentPayslipData(payslipData);
        const previewUri = generatePaySlipPreview(
          payslipData,
          currentPayslipNo,
          isFullMonthRange
        );
        setPdfPreview(previewUri);
      }

      setIsPreviewLoading(false);
    };

    const handler = setTimeout(generatePreview, 1000);
    return () => clearTimeout(handler);
  }, [
    isModalOpen,
    selectedEmployee,
    cutOffPay,
    earningsForPeriod,
    grandTotalDeductions,
    grandNetPay,
    isFullMonthRange,
    formDeductions,
    formDeductionsFirstCutOff,
    formDeductionsSecondCutOff,
    cutOffDateRange,
    refreshCounter,
    deductionTypes,
  ]);

  const handleRefreshPreview = () => {
    setRefreshCounter((c) => c + 1);
  };

  const handleGenerateAndOpen = () => {
    if (currentPayslipData) {
      handleGeneratePayslip(currentPayslipData, isFullMonthRange, "view");
    }
  };

  const handleDownloadPayslip = () => {
    if (currentPayslipData) {
      handleGeneratePayslip(currentPayslipData, isFullMonthRange, "download");
    }
  };

  const menu = (
    <Menu
      onClick={({ key }) => {
        if (key === "view") {
          handleGenerateAndOpen(); // This already opens in new tab
        } else if (key === "download") {
          handleDownloadPayslip();
        }
      }}
      items={[
        {
          label: "View Payslip",
          key: "view",
        },
        {
          label: "Download Payslip",
          key: "download",
        },
      ]}
    />
  );

  return (
    <Modal
      open={isModalOpen}
      onCancel={handleCancel}
      footer={[
        <Button key="back" onClick={handleCancel}>
          Cancel
        </Button>,
        <Dropdown overlay={menu} placement="topRight" arrow>
          <Button key="submit" type="primary">
            Generate Payslip
          </Button>
        </Dropdown>,
      ]}
      title="Generate Payslip"
      centered
      width={1200}
    >
      <Row gutter={16}>
        <Col span={12}>
          {selectedEmployee && (
            <div className="payslip-modal-content">
              <Form
                form={form}
                layout="vertical"
                size="small"
                onValuesChange={(_, allValues) =>
                  recalcPayslip(allValues, deductionTypes)
                }
              >
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
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
                    <Form.Item
                      label="Employee ID"
                      labelCol={{ style: { paddingBottom: "0px" } }}
                    >
                      <Input value={selectedEmployee.empId} readOnly />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      label="Employee No"
                      labelCol={{ style: { paddingBottom: "0px" } }}
                    >
                      <Input value={selectedEmployee.empNo} readOnly />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      label="Salary Type"
                      labelCol={{ style: { paddingBottom: "0px" } }}
                    >
                      <Input value={selectedEmployee.empType} readOnly />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      label="Name"
                      labelCol={{ style: { paddingBottom: "0px" } }}
                    >
                      <Input value={selectedEmployee.name} readOnly />
                    </Form.Item>
                  </Col>
                  <Col span={16}>
                    <Form.Item
                      label="Position"
                      labelCol={{ style: { paddingBottom: "0px" } }}
                    >
                      <Input value={selectedEmployee.position} readOnly />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      labelCol={{ style: { paddingBottom: "0px" } }}
                      label="Rate per Month"
                      name="ratePerMonth"
                      initialValue={
                        selectedEmployee.salaryInfo?.ratePerMonth ||
                        selectedEmployee.salaryInfo?.basicSalary ||
                        0
                      }
                    >
                      <InputNumber
                        min={0}
                        formatter={(value) =>
                          showSalaryAmounts
                            ? `₱${parseFloat(value || 0).toLocaleString(
                                undefined,
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }
                              )}`
                            : "*****"
                        }
                        parser={(value) => value.replace(/₱\s?|(,*)/g, "")}
                        style={{ width: "100%" }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      labelCol={{ style: { paddingBottom: "0px" } }}
                      label="PERA/ACA"
                      style={{ marginBottom: 0 }}
                    >
                      <Space.Compact
                        style={{ display: "flex", alignItems: "center" }}
                      >
                        {/* PERA/ACA Amount */}
                        <Form.Item name="peraAca" initialValue={0} noStyle>
                          <InputNumber
                            min={0}
                            precision={2}
                            formatter={(value) =>
                              showSalaryAmounts
                                ? `₱${parseFloat(value || 0).toLocaleString(
                                    undefined,
                                    {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    }
                                  )}`
                                : "*****"
                            }
                            parser={(value) => value.replace(/₱\s?|(,*)/g, "")}
                            style={{
                              width: "60%",
                              color: "green",
                              fontWeight: 600,
                            }}
                            onChange={(value) => {
                              // Trigger recalculation with the new value
                              recalcPayslip(
                                { ...form.getFieldsValue(), peraAca: value },
                                deductionTypes
                              );
                            }}
                          />
                        </Form.Item>

                        {/* Switch + Indicator */}
                        <Form.Item
                          name="peraAcaCutOff"
                          initialValue="first"
                          noStyle
                        >
                          <Switch
                            checkedChildren="1st"
                            unCheckedChildren="2nd"
                            checked={
                              form.getFieldValue("peraAcaCutOff") === "first"
                            }
                            onChange={(checked) => {
                              const cutOff = checked ? "first" : "second";
                              const allValues = {
                                ...form.getFieldsValue(),
                                peraAcaCutOff: cutOff,
                              };

                              form.setFieldsValue({ peraAcaCutOff: cutOff });
                              recalcPayslip(allValues, deductionTypes); // recalc immediately
                            }}
                            style={{ marginLeft: 8 }}
                          />
                        </Form.Item>
                      </Space.Compact>
                    </Form.Item>
                  </Col>

                  {selectedEmployee?.empType !== "Regular" && (
                    <>
                      <Col span={8}>
                        <Form.Item
                          labelCol={{ style: { paddingBottom: "0px" } }}
                          label="Rate per Cut Off"
                          name="cutOffPay"
                        >
                          <InputNumber
                            min={0}
                            formatter={(value) =>
                              `₱${parseFloat(value || 0).toLocaleString(
                                undefined,
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }
                              )}`
                            }
                            parser={(value) => value.replace(/₱\s?|(,*)/g, "")}
                            style={{ width: "100%" }}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item
                          labelCol={{ style: { paddingBottom: "0px" } }}
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
                              showSalaryAmounts
                                ? `₱${parseFloat(value || 0).toLocaleString(
                                    undefined,
                                    {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    }
                                  )}`
                                : "*****"
                            }
                            parser={(value) => value.replace(/₱\s?|(,*)/g, "")}
                            style={{ width: "100%" }}
                          />
                        </Form.Item>
                      </Col>
                    </>
                  )}
                </Row>

                {/* Deduction Section */}
                <h3>Add Deductions/Incentives</h3>

                {isFullMonthRange ? (
                  <>
                    {/* 1st Cut-Off */}
                    <Card
                      title={`1st Cut-Off (1–15 ${dayjs(
                        form.getFieldValue("cutOffDateRange")?.[0]
                      ).format("MMMM YYYY")})`}
                      size="small"
                      style={{ marginBottom: 10 }}
                    >
                      <Row
                        gutter={8}
                        style={{ width: "100%", marginBottom: 6 }}
                      >
                        <Col span={12}>
                          <Form.Item
                            label="Rate Per Month"
                            style={{ marginBottom: 6 }}
                          >
                            <Input
                              value={
                                showSalaryAmounts
                                  ? `₱${(monthlyRate || 0).toLocaleString(
                                      undefined,
                                      {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      }
                                    )}`
                                  : "*****"
                              }
                              readOnly
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label="Gross Amount Earned"
                            name="firstCutOffGross"
                            initialValue={firstCutOffGross}
                            style={{ marginBottom: 6 }}
                          >
                            <InputNumber
                              min={0}
                              precision={2}
                              style={{ width: "100%" }}
                              onChange={() => form.submit()}
                              formatter={(value) =>
                                showSalaryAmounts
                                  ? `₱${parseFloat(value || 0).toLocaleString(
                                      undefined,
                                      {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      }
                                    )}`
                                  : "*****"
                              }
                              parser={(value) =>
                                value.replace(/₱\s?|(,*)/g, "")
                              }
                            />
                          </Form.Item>
                        </Col>
                      </Row>

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
                                showSalaryAmounts={showSalaryAmounts}
                                deductionTypes={deductionTypes}
                              />
                            ))}

                            <Form.Item style={{ marginBottom: 6 }}>
                              <Button
                                type="primary"
                                size="small"
                                onClick={() =>
                                  add({ type: "Other", amount: 0 })
                                }
                                icon={<PlusOutlined />}
                              >
                                Add Item (1st Cut-Off)
                              </Button>
                            </Form.Item>

                            <Row
                              gutter={8}
                              style={{ width: "100%", marginTop: 6 }}
                            >
                              <Col span={12}>
                                <Card
                                  size="small"
                                  bordered
                                  bodyStyle={{ padding: "6px 8px" }}
                                  style={{ background: "#fafafa" }}
                                >
                                  <Form.Item
                                    label="Total Deductions"
                                    style={{ marginBottom: 0 }}
                                  >
                                    <Input
                                      value={
                                        showSalaryAmounts
                                          ? `₱${(
                                              firstCutOffTotalDeductions || 0
                                            ).toLocaleString()}`
                                          : "*****"
                                      }
                                      readOnly
                                    />
                                  </Form.Item>
                                </Card>
                              </Col>
                              <Col span={12}>
                                <Card
                                  size="small"
                                  bordered
                                  bodyStyle={{ padding: "6px 8px" }}
                                  style={{ background: "#fafafa" }}
                                >
                                  <Form.Item
                                    label="Net Pay"
                                    style={{ marginBottom: 0 }}
                                  >
                                    <Input
                                      value={
                                        showSalaryAmounts
                                          ? `₱${(
                                              firstCutOffNetPay || 0
                                            ).toLocaleString()}`
                                          : "*****"
                                      }
                                      readOnly
                                    />
                                  </Form.Item>
                                </Card>
                              </Col>
                            </Row>
                          </>
                        )}
                      </Form.List>
                    </Card>

                    {/* 2nd Cut-Off */}
                    <Card
                      title={`2nd Cut-Off (16–${dayjs(
                        form.getFieldValue("cutOffDateRange")?.[1]
                      ).format("MMMM YYYY")})`}
                      size="small"
                      style={{ marginBottom: 10 }}
                    >
                      <Row
                        gutter={8}
                        style={{ width: "100%", marginBottom: 6 }}
                      >
                        <Col span={12}>
                          <Form.Item
                            label="Rate Per Month"
                            style={{ marginBottom: 6 }}
                          >
                            <Input
                              value={
                                showSalaryAmounts
                                  ? `₱${(monthlyRate || 0).toLocaleString(
                                      undefined,
                                      {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      }
                                    )}`
                                  : "*****"
                              }
                              readOnly
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label="Gross Amount Earned"
                            name="secondCutOffGross"
                            initialValue={secondCutOffGross}
                            style={{ marginBottom: 6 }}
                          >
                            <InputNumber
                              min={0}
                              precision={2}
                              style={{ width: "100%" }}
                              onChange={() => form.submit()}
                              formatter={(value) =>
                                showSalaryAmounts
                                  ? `₱${parseFloat(value || 0).toLocaleString(
                                      undefined,
                                      {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      }
                                    )}`
                                  : "*****"
                              }
                              parser={(value) =>
                                value.replace(/₱\s?|(,*)/g, "")
                              }
                            />
                          </Form.Item>
                        </Col>
                      </Row>

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
                                showSalaryAmounts={showSalaryAmounts}
                                deductionTypes={deductionTypes}
                              />
                            ))}

                            <Form.Item style={{ marginBottom: 6 }}>
                              <Button
                                type="primary"
                                size="small"
                                onClick={() =>
                                  add({ type: "Other", amount: 0 })
                                }
                                icon={<PlusOutlined />}
                              >
                                Add Item (2nd Cut-Off)
                              </Button>
                            </Form.Item>

                            <Row
                              gutter={8}
                              style={{ width: "100%", marginTop: 6 }}
                            >
                              <Col span={12}>
                                <Card
                                  size="small"
                                  bordered
                                  bodyStyle={{ padding: "6px 8px" }}
                                  style={{ background: "#fafafa" }}
                                >
                                  <Form.Item
                                    label="Total Deductions"
                                    style={{ marginBottom: 0 }}
                                  >
                                    <Input
                                      value={
                                        showSalaryAmounts
                                          ? `₱${(
                                              secondCutOffTotalDeductions || 0
                                            ).toLocaleString()}`
                                          : "*****"
                                      }
                                      readOnly
                                    />
                                  </Form.Item>
                                </Card>
                              </Col>
                              <Col span={12}>
                                <Card
                                  size="small"
                                  bordered
                                  bodyStyle={{ padding: "6px 8px" }}
                                  style={{ background: "#fafafa" }}
                                >
                                  <Form.Item
                                    label="Net Pay"
                                    style={{ marginBottom: 0 }}
                                  >
                                    <Input
                                      value={
                                        showSalaryAmounts
                                          ? `₱${(
                                              secondCutOffNetPay || 0
                                            ).toLocaleString()}`
                                          : "*****"
                                      }
                                      readOnly
                                    />
                                  </Form.Item>
                                </Card>
                              </Col>
                            </Row>
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
                              showSalaryAmounts={showSalaryAmounts}
                              deductionTypes={deductionTypes}
                            />
                          ))}
                          <Form.Item>
                            <Space>
                              <Button
                                type="primary"
                                onClick={() =>
                                  add({ type: "Other", amount: 0 })
                                }
                                icon={<PlusOutlined />}
                              >
                                Add Item
                              </Button>
                              {fields.length > 0 && (
                                <Button
                                  type="default"
                                  danger
                                  onClick={() => remove(fields.length - 1)}
                                  icon={<MinusCircleOutlined />}
                                >
                                  Remove Last Item
                                </Button>
                              )}
                            </Space>
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
                    <Form.Item labelCol={{ style: { paddingBottom: "0px" } }}>
                      <Form.Item label="Grand Total Deductions">
                        <Input
                          value={
                            showSalaryAmounts
                              ? `₱${grandTotalDeductions.toLocaleString(
                                  undefined,
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }
                                )}`
                              : "*****"
                          }
                          readOnly
                        />
                      </Form.Item>
                    </Form.Item>
                  </Col>
                  {selectedEmployee.empType === "Regular" ? (
                    <Col span={12}>
                      <Form.Item
                        label="Grand Total Net Pay"
                        name="grandTotalNetPay"
                        initialValue={grandNetPay}
                      >
                        <InputNumber
                          formatter={(value) =>
                            `₱${parseFloat(value || 0).toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}`
                          }
                          parser={(value) => value.replace(/₱\s?|(,*)/g, "")}
                          style={{ width: "100%" }}
                        />
                      </Form.Item>
                    </Col>
                  ) : (
                    <Col span={12}>
                      <Col span={12}>
                        <Form.Item label="Grand Total Net Pay">
                          <Input
                            value={
                              showSalaryAmounts
                                ? `₱${grandNetPay.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}`
                                : "*****"
                            }
                            readOnly
                          />
                        </Form.Item>
                      </Col>
                    </Col>
                  )}
                </Row>
              </div>
            </div>
          )}
        </Col>
        <Col span={12}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <h3 style={{ flex: 1, margin: 0 }}>Payslip Preview</h3>
            <Button
              icon={<SyncOutlined />}
              onClick={handleRefreshPreview}
              loading={isPreviewLoading}
            >
              Refresh
            </Button>
          </div>
          <div style={{ position: "relative", height: "500px" }}>
            {isPreviewLoading && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(255, 255, 255, 0.5)",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  zIndex: 1,
                }}
              >
                <Spin size="large" />
              </div>
            )}
            {pdfPreview ? (
              <iframe
                src={pdfPreview}
                title="Payslip Preview"
                width="100%"
                height="100%"
                style={{ border: "1px solid #ccc" }}
              />
            ) : (
              <div
                style={{
                  border: "1px dashed #ccc",
                  height: "100%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  color: "#999",
                }}
              >
                <p>Fill out the form to see the preview.</p>
              </div>
            )}
          </div>
        </Col>
      </Row>
    </Modal>
  );
};

export default GeneratePayslipModal;

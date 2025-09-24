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
} from "antd";
import {
  MinusCircleOutlined,
  PlusOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  generatePaySlipPreview,
  openPayslipInNewTab,
  generatePaySlipPdf,
} from "../../../../../../utils/generatePaySlip.js";

const { Option } = Select;

const DeductionRow = ({
  fieldNamePrefix,
  name,
  restField,
  remove,
  form,
  selectedEmployee,
  showSalaryAmounts,
}) => {
  const type = form.getFieldValue([fieldNamePrefix, name, "type"]);
  const rawDailyRate = form.getFieldValue("dailyRate");
  const dailyRate =
    Number(String(rawDailyRate).replace(/[^\d.-]/g, "")) ||
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
              style={{ width: "80px" }}
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
                style={{ width: "100%" }}
              />
            </Form.Item>

            <Form.Item
              {...restField}
              name={[name, "amount"]}
              style={{ width: "120px" }}
            >
              <InputNumber
                min={0}
                readOnly
                precision={2}
                formatter={(value) =>
                  showSalaryAmounts
                    ? `₱${parseFloat(value || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : "*****"
                }
                parser={(value) => value.replace(/₱\s?|(,*)/g, "")}
                style={{ width: "100%" }}
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
                readOnly
                precision={2}
                onChange={() => form.submit()}
                formatter={(value) =>
                  showSalaryAmounts
                    ? `₱${parseFloat(value || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : "*****"
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
                showSalaryAmounts
                  ? `₱${parseFloat(value || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : "*****"
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
                showSalaryAmounts
                  ? `₱${parseFloat(value || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : "*****"
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
        style={{ marginBottom: 24}}
      />
    </Space>
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
  payslipNumber,
}) => {
  const [pdfPreview, setPdfPreview] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [currentPayslipData, setCurrentPayslipData] = useState(null);
  const [currentPayslipNumber, setCurrentPayslipNumber] = useState(null);

  useEffect(() => {
    setIsPreviewLoading(true);
    const handler = setTimeout(() => {
      if (!isModalOpen || !selectedEmployee || !cutOffDateRange) {
        setPdfPreview(null);
        setIsPreviewLoading(false);
        return;
      }

      const ratePerMonthValue =
        selectedEmployee.salaryInfo?.ratePerMonth ||
        selectedEmployee.salaryInfo?.basicSalary ||
        0;
      const secondPeriodEarned = ratePerMonthValue / 2;

      const rawDailyRate = form.getFieldValue("dailyRate");
      const dailyRate =
        Number(String(rawDailyRate).replace(/[^\d.-]/g, "")) ||
        Math.round(
          (selectedEmployee.salaryInfo?.ratePerMonth ||
            selectedEmployee.salaryInfo?.basicSalary ||
            0) / 22
        );

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
        if (!deductions) return [];

        const newTaxAmount = calculateTax(earnings, deductions);
        const taxDeductionIndex = deductions.findIndex(
          (d) => d && d.type === "Tax"
        );

        if (
          taxDeductionIndex !== -1 &&
          deductions[taxDeductionIndex].amount !== newTaxAmount
        ) {
          setTimeout(() => {
            const currentDeductions = form.getFieldValue(fieldNamePrefix) || [];
            if (currentDeductions[taxDeductionIndex]) {
              const newDeductions = [...currentDeductions];
              newDeductions[taxDeductionIndex] = {
                ...newDeductions[taxDeductionIndex],
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
        cutOffPay,
        "deductionsFirstCutOff"
      );
      const updatedFormDeductionsSecondCutOff = updateDeductionsAndTax(
        formDeductionsSecondCutOff,
        secondPeriodEarned,
        "deductionsSecondCutOff"
      );
      const updatedFormDeductions = updateDeductionsAndTax(
        formDeductions,
        cutOffPay,
        "deductions"
      );

      const payslipData = {
        name: selectedEmployee.name,
        empId: selectedEmployee.empId,
        position: selectedEmployee.position,
        cutOffStartDate: dayjs(cutOffDateRange[0]).format("YYYY-MM-DD"),
        cutOffEndDate: dayjs(cutOffDateRange[1]).format("YYYY-MM-DD"),
        grossIncome: {
          rate: cutOffPay,
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
              ...(updatedFormDeductionsFirstCutOff || []).map((d) => ({
                name: d.type,
                days: d.days,
                unit: d.unit,
                value: d.value,
                cutoff: 1,
                amount:
                  d.type === "Absent" && d.days ? d.days * dailyRate : d.amount,
              })),
              ...(updatedFormDeductionsSecondCutOff || []).map((d) => ({
                name: d.type,
                days: d.days,
                unit: d.unit,
                value: d.value,
                cutoff: 2,
                amount:
                  d.type === "Absent" && d.days ? d.days * dailyRate : d.amount,
              })),
            ]
          : (updatedFormDeductions || []).map((d) => ({
              name: d.type,
              cutoff: 1,
              days: d.days,
              unit: d.unit,
              value: d.value,
              amount:
                d.type === "Absent" && d.days ? d.days * dailyRate : d.amount,
            })),
        totalDeductions: grandTotalDeductions,
        netPay: grandNetPay,
      };

      //console.log("Payslip Data empId:", payslipData.empId);

      setCurrentPayslipData(payslipData);
      setCurrentPayslipNumber(payslipNumber);

      const previewUri = generatePaySlipPreview(
        payslipData,
        payslipNumber,
        isFullMonthRange
      );
      setPdfPreview(previewUri);
      setIsPreviewLoading(false);
    }, 1000);

    return () => {
      clearTimeout(handler);
    };
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
    payslipNumber,
  ]);

  const handleRefreshPreview = () => {
    setRefreshCounter((c) => c + 1);
  };

  const handleGenerateAndOpen = () => {
    if (currentPayslipData && currentPayslipNumber) {
      openPayslipInNewTab(
        currentPayslipData,
        currentPayslipNumber,
        isFullMonthRange
      );
      // Optionally, call the original handleGeneratePayslip if it has other side effects
      // handleGeneratePayslip();
    }
  };

  const handleDownloadPayslip = () => {
    if (currentPayslipData && currentPayslipNumber) {
      generatePaySlipPdf(
        currentPayslipData,
        currentPayslipNumber,
        isFullMonthRange
      );
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
                      <Input value={selectedEmployee.empId} readOnly />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Employee No">
                      <Input value={selectedEmployee.empNo} readOnly />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Salary Type">
                      <Input value={selectedEmployee.empType} readOnly />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Name">
                      <Input value={selectedEmployee.name} readOnly />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Position">
                      <Input value={selectedEmployee.position} readOnly />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item label="Rate per Month">
                      <Input
                        value={
                          showSalaryAmounts
                            ? `₱${(
                                selectedEmployee.salaryInfo?.ratePerMonth ||
                                selectedEmployee.salaryInfo?.basicSalary ||
                                0
                              ).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`
                            : "*****"
                        }
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Rate per Cut Off">
                      <Input
                        value={
                          showSalaryAmounts
                            ? `₱${cutOffPay.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`
                            : "*****"
                        }
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
                      style={{ marginBottom: 10 }}
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
                                showSalaryAmounts={showSalaryAmounts}
                              />
                            ))}
                            <Row
                              gutter={16}
                              style={{ width: "100%", marginTop: "16px" }}
                            >
                              <Col span={12}>
                                <Form.Item label="Total Deductions">
                                  <Input
                                    value={
                                      showSalaryAmounts
                                        ? `₱${firstCutOffTotalDeductions.toLocaleString(
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
                                <Form.Item label="Net Pay">
                                  <Input
                                    value={
                                      showSalaryAmounts
                                        ? `₱${firstCutOffNetPay.toLocaleString(
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
                            </Row>
                            <Form.Item>
                              <Button
                                type="primary"
                                onClick={() =>
                                  add({ type: "Other", amount: 0 })
                                }
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
                                showSalaryAmounts={showSalaryAmounts}
                              />
                            ))}
                            <Row
                              gutter={16}
                              style={{ width: "100%", marginTop: "16px" }}
                            >
                              <Col span={12}>
                                <Form.Item label="Total Deductions">
                                  <Input
                                    value={
                                      showSalaryAmounts
                                        ? `₱${secondCutOffTotalDeductions.toLocaleString(
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
                                <Form.Item label="Net Pay">
                                  <Input
                                    value={
                                      showSalaryAmounts
                                        ? `₱${secondCutOffNetPay.toLocaleString(
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
                            </Row>
                            <Form.Item>
                              <Button
                                type="primary"
                                onClick={() =>
                                  add({ type: "Other", amount: 0 })
                                }
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
                              showSalaryAmounts={showSalaryAmounts}
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
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Grand Net Pay">
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

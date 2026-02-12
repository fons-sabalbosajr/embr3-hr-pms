import React, { useState, useEffect, useRef } from "react";
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
  Alert,
  Tag,
} from "antd";
import {
  MinusCircleOutlined,
  PlusOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { generatePaySlipPreview } from "../../../../../../utils/generatePaySlipContract.js";
import { generatePaySlipPreviewRegular } from "../../../../../../utils/generatePaySlipRegular.js";
import useDemoMode from "../../../../../hooks/useDemoMode.js";
import useLoading from "../../../../../hooks/useLoading.js";
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
  const isCOS = empType !== "Regular";
  const isAbsent = itemType === "Absent";
  const isLate = itemType === "Late/Undertime";

  const colorStyle =
    itemType === "Tax" ||
    deductionTypes.find((d) => d.name === itemType)?.type === "deduction"
      ? { color: "red", fontWeight: 600 }
      : deductionTypes.find((d) => d.name === itemType)?.type === "incentive"
      ? { color: "green", fontWeight: 600 }
      : {};

  return (
    <Row gutter={6} align="middle" style={{ marginBottom: 4 }}>
      <Col span={7}>
        <Form.Item
          {...restField}
          name={[name, "type"]}
          style={{ marginBottom: 0 }}
        >
          <Select placeholder="Select Deduction/Incentive" size="middle">
            {deductionTypes.map((dt) => (
              <Select.Option key={dt.name} value={dt.name}>
                {dt.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Col>
      {/* COS-specific inputs for computed items */}
      {isCOS && isAbsent && (
        <Col span={5}>
          <Form.Item
            {...restField}
            name={[name, "days"]}
            style={{ marginBottom: 0 }}
            tooltip="Number of absent days"
          >
            <InputNumber min={0} precision={0} style={{ width: "100%" }} placeholder="Days" />
          </Form.Item>
        </Col>
      )}
      {isCOS && isLate && (
        <>
          <Col span={5}>
            <Form.Item
              {...restField}
              name={[name, "unit"]}
              style={{ marginBottom: 0 }}
              initialValue="hours"
              tooltip="Select unit for late/undertime"
            >
              <Select size="middle">
                <Select.Option value="minutes">Minutes</Select.Option>
                <Select.Option value="hours">Hours</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item
              {...restField}
              name={[name, "value"]}
              style={{ marginBottom: 0 }}
              tooltip="Enter minutes or hours"
            >
              <InputNumber min={0} precision={2} style={{ width: "100%" }} placeholder="Qty" />
            </Form.Item>
          </Col>
        </>
      )}
      <Col span={isCOS ? (isLate ? 6 : isAbsent ? 8 : 7) : 7}>
        <Form.Item
          {...restField}
          name={[name, "amount"]}
          style={{ marginBottom: 0 }}
        >
          <InputNumber
            
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
      <Col span={2} style={{ display: "flex", justifyContent: "flex-end" }}>
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
  const { isDemoActive, isDemoUser } = useDemoMode();
  const { withLoading } = useLoading();
  const [filteredDeductionTypes, setFilteredDeductionTypes] = useState([]);
  // --- New state for Send Payslip workflow ---
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [includeWetSignatureInstruction, setIncludeWetSignatureInstruction] = useState(true);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [createdRequestId, setCreatedRequestId] = useState(null);
  // Track auto-update vs manual edit for COS cutOffPay
  const autoUpdatingCutOffPayRef = useRef(false);
  const cutOffPayManuallyEditedRef = useRef(false);

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

  // Filter deduction types per employee type
  useEffect(() => {
    if (!selectedEmployee) {
      setFilteredDeductionTypes(deductionTypes);
      return;
    }
    const empType = selectedEmployee.empType;
    let filtered = (deductionTypes || []).filter((dt) => {
      if (!dt || !dt.applicableTo) return true; // backward compatibility
      return dt.applicableTo === "Both" || dt.applicableTo === empType;
    });

    // For Contract of Service, restrict to only Tax, Absent, Late/Undertime
    if (empType && empType !== "Regular") {
      const allowed = new Set(["Tax", "Absent", "Late/Undertime"]);
      let restricted = filtered.filter((dt) => allowed.has(dt.name));

      // Add placeholders for any missing required items
      const haveNames = new Set(restricted.map((d) => d.name));
      [
        { name: "Tax", type: "deduction", calculationType: "fixed" },
        { name: "Absent", type: "deduction", calculationType: "fixed" },
        { name: "Late/Undertime", type: "deduction", calculationType: "fixed" },
      ].forEach((req) => {
        if (!haveNames.has(req.name)) {
          restricted.push(req);
        }
      });

      filtered = restricted;
    }

    setFilteredDeductionTypes(filtered);
  }, [deductionTypes, selectedEmployee]);

  // Keep computed gross values in-sync with form fields so the inputs show
  // the calculated "Gross Amount Earned" for 1st/2nd cut-offs.
  useEffect(() => {
    try {
      // Only set when form is available and there's a selected date range
      if (form && cutOffDateRange) {
        const valuesToSet = {};
        // Ensure the form field names match the Form.Item names
        if (typeof firstCutOffGross !== "undefined") {
          valuesToSet.firstCutOffGross = firstCutOffGross;
        }
        if (typeof secondCutOffGross !== "undefined") {
          valuesToSet.secondCutOffGross = secondCutOffGross;
        }

        // Merge only if we have values to set to avoid touching unrelated fields
        if (Object.keys(valuesToSet).length > 0) {
          form.setFieldsValue(valuesToSet);
        }
      }
    } catch (e) {
      // non-fatal; keep UI resilient
      // eslint-disable-next-line no-console
      console.warn("Failed to sync gross values into form", e);
    }
  }, [firstCutOffGross, secondCutOffGross, cutOffDateRange, form]);

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

      // Read cut-off pay (Contract 'Rate per Cut Off') with sensible fallbacks
      const cutOffPayValue =
        form.getFieldValue("cutOffPay") ??
        cutOffPay ??
        ratePerMonthValue / 2;

      // secondPeriodEarned: prefer form -> prop -> half-month fallback
      const secondPeriodEarned =
        form.getFieldValue("secondCutOffGross") ??
        secondCutOffGross ??
        ratePerMonthValue / 2;
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
          const type = filteredDeductionTypes.find((d) => d.name === item.type);
          return !type || type.type === "deduction";
        });

        const incentives = allItems.filter((item) => {
          const type = filteredDeductionTypes.find((d) => d.name === item.type);
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
          isFullMonthRange,
          isDemoActive && isDemoUser // mask amounts in demo
        );
        setPdfPreview(previewUri);
      } else {
        // Contract employees
        const earnedForPeriodValue =
          earningsForPeriod ??
          form.getFieldValue("firstCutOffGross") ??
          firstCutOffGross ??
          ratePerMonthValue / 2;

        const payslipData = {
          name: selectedEmployee.name,
          empId: selectedEmployee.empId,
          position: selectedEmployee.position,
          empType: selectedEmployee.empType,
          cutOffStartDate: dayjs(cutOffDateRange[0]).format("YYYY-MM-DD"),
          cutOffEndDate: dayjs(cutOffDateRange[1]).format("YYYY-MM-DD"),
          grossIncome: {
            monthlySalary: ratePerMonthValue,
            rate: cutOffPayValue, // per cut-off
            earnPeriod: cutOffPayValue, // Earn for the period equals rate per cut-off
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
          isFullMonthRange,
          isDemoActive && isDemoUser // mask amounts in demo
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
    if (isDemoActive && isDemoUser) {
      notification.warning({
        message: "Download Disabled in Demo",
        description: "Payslip downloading is not available in demo mode.",
      });
      return;
    }
    if (currentPayslipData) {
      handleGeneratePayslip(currentPayslipData, isFullMonthRange, "download");
    }
  };

  // Compute default period display for email subject/body
  const periodDisplay = currentPayslipData
    ? `${currentPayslipData.cutOffStartDate} - ${currentPayslipData.cutOffEndDate}`
    : "";

  // Open Send Payslip modal (prefill email & body)
  const handleOpenSendModal = () => {
    if (!currentPayslipData) return;
    // Prefer first employee email if available
    const initialEmail = (selectedEmployee?.emails || [])[0] || selectedEmployee?.email || "";
    setSendEmail(initialEmail);
    const defaultBody = `Dear ${selectedEmployee?.name || "Employee"},\n\nAttached is your payslip for the period ${periodDisplay}.\n\n${includeWetSignatureInstruction ? "Important: This payslip is for reference only and is NOT valid without a wet signature. Please proceed to the Head of Personnel Unit to obtain the required wet signature." : ""}\n\nRegards,\nHR Personnel`;
    setCustomBody(defaultBody);
    setIsSendModalOpen(true);
    // Fallback: find last payslip request email if employee email missing
    if (!initialEmail && selectedEmployee?.empId) {
      (async () => {
        try {
          const res = await axiosInstance.get('/payslip-requests');
          const list = (res.data?.data || []).filter(r => r && r.employeeId === selectedEmployee.empId && !r.hidden);
          if (list.length > 0) {
            list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
            const lastEmail = list[0]?.email;
            if (lastEmail) setSendEmail(lastEmail);
          }
        } catch (_) { /* non-fatal */ }
      })();
    }
  };

  const buildHtmlBody = () => {
    // Convert newlines to <br/>
    const escaped = customBody
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
      .replace(/\n/g, "<br/>");
    return `<!DOCTYPE html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;">${escaped}</body></html>`;
  };

  const handleSendPayslip = async () => {
    if (!currentPayslipData || !pdfPreview) {
      notification.error({ message: "Preview not ready", description: "Generate the payslip first." });
      return;
    }
    if (!sendEmail) {
      notification.error({ message: "Email required", description: "Please enter a recipient email." });
      return;
    }
    setIsSendingEmail(true);
    await withLoading(async ({ updateProgress }) => {
      try {
        updateProgress(10, "Preparing payslip email…");
        // 1. Ensure a PayslipRequest exists (create if not yet)
        let requestId = createdRequestId;
        if (!requestId) {
          const createRes = await axiosInstance.post("/payslip-requests", {
            employeeId: selectedEmployee?.empId,
            period: periodDisplay || dayjs().format("YYYY-MM"),
            email: sendEmail,
          });
          if (!createRes.data?.data?._id) throw new Error("Failed to create payslip request record");
          requestId = createRes.data.data._id;
          setCreatedRequestId(requestId);
        }

        updateProgress(40, "Sending email…");
        // 2. Send email with PDF base64 (use preview URI)
        const subject = `Payslip ${periodDisplay}`;
        const bodyHtml = buildHtmlBody();
        const sendRes = await axiosInstance.post(`/payslip-requests/${requestId}/send-email`, {
          pdfBase64: (pdfPreview || '').split('#')[0], // strip any #toolbar from data URI
          filename: `payslip_${selectedEmployee?.empId || "employee"}.pdf`,
          subject,
          bodyHtml,
        });

        updateProgress(90, "Finalising…");

        if (sendRes.data?.success) {
          const isSimulated = !!sendRes.data?.simulated;
          const wasAlreadySent = !!sendRes.data?.alreadySent; // backward compatibility
          const resendCount = sendRes.data?.resendCount ?? 0;
          notification.success({
            message: isSimulated ? "Payslip email simulated" : wasAlreadySent ? "Already emailed" : (resendCount > 0 ? `Payslip re-sent (${resendCount}/5)` : "Payslip email sent"),
            description: isSimulated
              ? `Email capture logged server-side. SMTP not configured; no email delivered.`
              : wasAlreadySent
              ? `This payslip was already emailed earlier. No duplicate email was sent.`
              : `Email dispatched to ${sendEmail}`,
          });
          setIsSendModalOpen(false);
        } else {
          throw new Error(sendRes.data?.message || "Unknown send error");
        }
      } catch (e) {
        const code = e?.response?.data?.code;
        if (code === 'RESEND_LIMIT_REACHED') {
          notification.warning({
            message: 'Resend limit reached',
            description: e?.response?.data?.message || 'You have reached the maximum number of resends for this payslip.',
          });
        } else {
          notification.error({ message: "Failed to send", description: e.message });
        }
      } finally {
        setIsSendingEmail(false);
      }
    }, "Sending payslip email…");
  };

  const menu = (
    <Menu
      onClick={({ key }) => {
        if (key === "view") {
          handleGenerateAndOpen();
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
          label: (
            <span style={{ opacity: isDemoActive && isDemoUser ? 0.5 : 1 }}>
              Download Payslip
              {isDemoActive && isDemoUser && (
                <Tag color="red" style={{ marginLeft: 6 }}>Demo</Tag>
              )}
            </span>
          ),
          key: "download",
          disabled: isDemoActive && isDemoUser,
        },
      ]}
    />
  );

  return (
    <>
    <Modal
      open={isModalOpen}
      onCancel={handleCancel}
      footer={[
        <Button key="back" onClick={handleCancel}>
          Cancel
        </Button>,
        <Button
          key="send"
          type="default"
          disabled={!currentPayslipData || isPreviewLoading}
          onClick={handleOpenSendModal}
        >
          Send
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
                onValuesChange={(changedValues, allValues) => {
                  const isCOS = selectedEmployee?.empType !== "Regular";
                  if (
                    isCOS &&
                    Object.prototype.hasOwnProperty.call(
                      changedValues || {},
                      "ratePerMonth"
                    ) &&
                    !cutOffPayManuallyEditedRef.current
                  ) {
                    const monthly =
                      changedValues.ratePerMonth ?? allValues.ratePerMonth;
                    const computed = (parseFloat(monthly) || 0) / 2;
                    autoUpdatingCutOffPayRef.current = true;
                    form.setFieldsValue({ cutOffPay: computed });
                    const nextValues = { ...allValues, cutOffPay: computed };
                    recalcPayslip(nextValues, filteredDeductionTypes);
                    autoUpdatingCutOffPayRef.current = false;
                    return;
                  }

                  recalcPayslip(allValues, filteredDeductionTypes);
                }}
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
                  {selectedEmployee?.empType === "Regular" && (
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
                  )}

                  {selectedEmployee?.empType !== "Regular" && (
                    <>
                      <Col span={8}>
                        <Form.Item
                          labelCol={{ style: { paddingBottom: "0px" } }}
                          label="Rate per Cut Off"
                          name="cutOffPay"
                          initialValue={
                            typeof cutOffPay !== "undefined" && cutOffPay !== null
                              ? cutOffPay
                              : ((selectedEmployee.salaryInfo?.ratePerMonth ||
                                  selectedEmployee.salaryInfo?.basicSalary ||
                                  0) / 2)
                          }
                        >
                          <InputNumber
                            min={0}
                              formatter={(value) =>
                                isDemoActive && isDemoUser
                                  ? "*****"
                                  : `₱${parseFloat(value || 0).toLocaleString(
                                      undefined,
                                      {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      }
                                    )}`
                              }
                            parser={(value) => value.replace(/₱\s?|(,*)/g, "")}
                            style={{ width: "100%" }}
                            onChange={() => {
                              if (!autoUpdatingCutOffPayRef.current) {
                                cutOffPayManuallyEditedRef.current = true;
                              }
                            }}
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
                                deductionTypes={filteredDeductionTypes}
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
                      title={`2nd Cut-Off (16-${
                        form.getFieldValue("cutOffDateRange")?.[1]
                          ? dayjs(
                              form.getFieldValue("cutOffDateRange")[1]
                            )
                              .endOf("month")
                              .format("D")
                          : ""
                      } ${
                        form.getFieldValue("cutOffDateRange")?.[1]
                          ? dayjs(
                              form.getFieldValue("cutOffDateRange")[1]
                            ).format("MMMM YYYY")
                          : ""
                      })`}
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
                                deductionTypes={filteredDeductionTypes}
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
                              deductionTypes={filteredDeductionTypes}
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

    {/* Send Payslip Email Modal */}
    <Modal
      open={isSendModalOpen}
      onCancel={() => setIsSendModalOpen(false)}
      title="Send Payslip via Email"
      width={900}
      footer={[
        <Button key="cancel" onClick={() => setIsSendModalOpen(false)} disabled={isSendingEmail}>Cancel</Button>,
        <Button
          key="send"
            type="primary"
            loading={isSendingEmail}
            disabled={!pdfPreview || !sendEmail}
            onClick={handleSendPayslip}
        >
          {isSendingEmail ? "Sending..." : "Send Payslip"}
        </Button>,
      ]}
      centered
    >
      <Row gutter={16}>
        <Col span={12}>
          <div style={{ border: "1px solid #eee", height: 500, overflow: "hidden", borderRadius: 4 }}>
            {pdfPreview ? (
              <iframe
                title="Payslip Preview"
                src={pdfPreview}
                style={{ width: "100%", height: "100%", border: "none" }}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                <Spin />
              </div>
            )}
          </div>
          <p style={{ fontSize: 11, marginTop: 8, color: "#666" }}>
            This preview reflects the current payslip data. Adjust values in the Generate modal then reopen Send if you need changes.
          </p>
        </Col>
        <Col span={12}>
          <Form layout="vertical" size="small">
            <Form.Item label="Recipient Email" required>
              <Input
                value={sendEmail}
                onChange={(e) => setSendEmail(e.target.value)}
                placeholder="employee@example.com"
              />
            </Form.Item>
            <Form.Item label="Custom Message (editable)">
              <Input.TextArea
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value)}
                autoSize={{ minRows: 10, maxRows: 18 }}
                placeholder="Enter custom email body"
              />
            </Form.Item>
            <Form.Item label="Wet Signature Instruction" tooltip="Include instruction that a wet signature is required for validity.">
              <Space>
                <Switch
                  checked={includeWetSignatureInstruction}
                  onChange={(checked) => {
                    setIncludeWetSignatureInstruction(checked);
                    // Regenerate body preserving other edits only if untouched beyond default
                    if (!customBody || customBody.includes("Attached is your payslip") ) {
                      const updated = `Dear ${selectedEmployee?.name || "Employee"},\n\nAttached is your payslip for the period ${periodDisplay}.\n\n${checked ? "Important: This payslip is for reference only and is NOT valid without a wet signature. Please proceed to the Head of Personnel Unit to obtain the required wet signature." : ""}\n\nRegards,\nHR Personnel`;
                      setCustomBody(updated);
                    }
                  }}
                  size="small"
                />
                <span style={{ fontSize: 12 }}>
                  {includeWetSignatureInstruction ? "Included" : "Excluded"}
                </span>
              </Space>
            </Form.Item>
            <Alert
              type="warning"
              message="Reminder: The attached payslip is not valid without a wet signature. Instruct the employee to visit the Head of Personnel Unit for signing."
              showIcon
            />
          </Form>
        </Col>
      </Row>
    </Modal>
    </>
  );
};

export default GeneratePayslipModal;

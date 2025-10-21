import React from "react";
import { Card, Typography, Button, Form, Input, DatePicker, message, Modal, List } from "antd";
import { Link } from "react-router-dom";
import bgImage from "../../assets/bgemb.webp";
import axiosInstance from "../../api/axiosInstance";
import { NotificationsContext } from "../../context/NotificationsContext";
import { generateDTRPdf } from "../../../utils/generateDTRpdf";
import { LoadingOutlined, CheckCircleTwoTone, CloseCircleTwoTone } from "@ant-design/icons";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import "./requestdtrclient.css";

dayjs.extend(utc);
dayjs.extend(timezone);

const { Title, Text } = Typography;

const RequestDTRClient = () => {
  const [form] = Form.useForm();
  const { setNotifications } = React.useContext(NotificationsContext);
  const [confirmVisible, setConfirmVisible] = React.useState(false);
  const [confirmInfo, setConfirmInfo] = React.useState({ total: 0, employeeId: "", start: null, end: null });
  const [processingVisible, setProcessingVisible] = React.useState(false);
  const [steps, setSteps] = React.useState([
    { key: "check", label: "Checking data availability", status: "idle" },
    { key: "employee", label: "Fetching employee info", status: "idle" },
    { key: "logs", label: "Fetching biometric logs", status: "idle" },
    { key: "pdf", label: "Generating DTR PDF", status: "idle" },
    { key: "request", label: "Creating DTR request", status: "idle" },
  ]);
  const [submitting, setSubmitting] = React.useState(false);

  const markStep = (key, status) => {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, status } : s)));
  };

  const onFinish = async (values) => {
    try {
      setSubmitting(true);
      setSteps((prev) => prev.map((s) => ({ ...s, status: "idle" })));

      const [startDate, endDate] = values.dateRange;

      // Step: check availability
      markStep("check", "in-progress");
      const existsRes = await axiosInstance.get("/dtr-requests/check", {
        params: {
          employeeId: values.employeeId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      });
      markStep("check", existsRes.data?.data?.available ? "done" : "error");
      if (!existsRes.data?.data?.available) {
        message.error("DTR for that cut off is not yet available.");
        setSubmitting(false);
        return;
      }

      // Show confirm modal before proceeding
      setConfirmInfo({ total: existsRes.data?.data?.total || 0, employeeId: values.employeeId, start: startDate, end: endDate });
      setConfirmVisible(true);
    } catch (error) {
      message.error("An error occurred while processing your request.");
      console.error("DTR request error:", error);
      setSubmitting(false);
    }
  };

  const runGeneration = async () => {
    try {
      setConfirmVisible(false);
      setProcessingVisible(true);

      const startDate = confirmInfo.start;
      const endDate = confirmInfo.end;
      const employeeId = confirmInfo.employeeId;

      // Step: employee
      markStep("employee", "in-progress");
      const employeeResponse = await axiosInstance.get(`/employees/by-emp-id/${employeeId}`);
      const employee = employeeResponse.data.data;
      markStep("employee", "done");

      // Step: logs
      markStep("logs", "in-progress");
      const normalizedEmpId = (employee.empId || "").replace(/-/g, "").replace(/^0+/, "");
      const dtrLogsResponse = await axiosInstance.get(`/dtrlogs/merged`, { params: { acNo: normalizedEmpId, startDate: startDate.toISOString(), endDate: endDate.toISOString() } });
      const dtrLogs = dtrLogsResponse.data.data || [];
      const STATE_LABELS = { "C/In": "Time In", "Out": "Break Out", "Out Back": "Break In", "C/Out": "Time Out" };
      const logsByDay = dtrLogs.reduce((acc, log) => {
        const dateKey = dayjs(log.time).tz("Asia/Manila").format("YYYY-MM-DD");
        if (!acc[dateKey]) acc[dateKey] = {};
        const stateLabel = STATE_LABELS[log.state];
        if (stateLabel) acc[dateKey][stateLabel] = dayjs(log.time).tz("Asia/Manila").format("h:mm");
        return acc;
      }, {});
      const dtrLogsForPdf = { [employee.empId]: logsByDay };
      markStep("logs", "done");

      // Step: pdf
      markStep("pdf", "in-progress");
      const selectedRecord = { DTR_Cut_Off: { start: startDate.toDate(), end: endDate.toDate() } };
      await generateDTRPdf({ employee, dtrLogs: dtrLogsForPdf, selectedRecord });
      markStep("pdf", "done");

      // Step: request
      markStep("request", "in-progress");
      const reqRes = await axiosInstance.post("/dtr-requests", { employeeId, startDate: startDate.toISOString(), endDate: endDate.toISOString(), email: form.getFieldValue("email") });
      if (reqRes.data?.success && reqRes.data?.data) {
        setNotifications((prev) => [ { id: reqRes.data.data._id || Date.now(), employeeId: reqRes.data.data.employeeId, createdAt: reqRes.data.data.createdAt || new Date(), read: false, type: "DTRRequest" }, ...prev ]);
      }
      markStep("request", "done");

      message.success("DTR generated successfully!");
      form.resetFields();
    } catch (err) {
      console.error("DTR generation error:", err);
      message.error(err?.response?.data?.message || "Failed to generate DTR");
      setSteps((prev) => prev.map((s) => (s.status === "in-progress" ? { ...s, status: "error" } : s)));
    } finally {
      setSubmitting(false);
      setTimeout(() => setProcessingVisible(false), 800);
    }
  };

  return (
    <div
      className="request-dtr-container"
      style={{
        minHeight: "100vh",
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <Card style={{ maxWidth: 520, width: "100%" }}>
        <Title level={3} style={{ textAlign: "center" }}>Request DTR</Title>
        <Text type="secondary" style={{ display: "block", textAlign: "center", marginBottom: 16 }}>
          Enter your Employee ID, date range, and email to receive your DTR PDF.
        </Text>

        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item label="Employee ID" name="employeeId" rules={[{ required: true, message: "Employee ID is required" }]}>
            <Input placeholder="Enter your Employee ID" />
          </Form.Item>

          <Form.Item label="Date Range" name="dateRange" rules={[{ required: true, message: "Please select a date range" }]}>
            <DatePicker.RangePicker style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            label="Email Address"
            name="email"
            rules={[
              { required: true, message: "Email is required" },
              { type: "email", message: "Please enter a valid email address" },
            ]}
          >
            <Input placeholder="Enter your email where DTR will be sent" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={submitting} disabled={submitting}>
              Submit Request
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <Link to="/requests">
            <Button type="link">⬅ Back to Requests</Button>
          </Link>
        </div>
      </Card>

      {/* Confirm Modal */}
      <Modal
        title="DTR data found"
        open={confirmVisible}
        onOk={runGeneration}
        onCancel={() => { setConfirmVisible(false); setSubmitting(false); }}
        okText="Generate DTR"
        cancelText="Cancel"
      >
        <p>
          Found <b>{confirmInfo.total}</b> biometric log(s) for employee <b>{confirmInfo.employeeId}</b> between
          {" "}
          <b>{confirmInfo.start ? confirmInfo.start.format("YYYY-MM-DD") : ""}</b> and {" "}
          <b>{confirmInfo.end ? confirmInfo.end.format("YYYY-MM-DD") : ""}</b>.
        </p>
        <p>Proceed to generate the DTR PDF and send the request to the admin panel?</p>
      </Modal>

      {/* Processing Modal */}
      <Modal title="Processing DTR Request" open={processingVisible} footer={null} closable={false}>
        <List
          dataSource={steps}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                avatar={
                  item.status === "in-progress" ? (
                    <LoadingOutlined style={{ color: "#1677ff" }} />
                  ) : item.status === "done" ? (
                    <CheckCircleTwoTone twoToneColor="#52c41a" />
                  ) : item.status === "error" ? (
                    <CloseCircleTwoTone twoToneColor="#ff4d4f" />
                  ) : (
                    <span style={{ display: "inline-block", width: 16 }} />
                  )
                }
                title={item.label}
                description={item.status === "error" ? "Failed" : item.status === "done" ? "Completed" : item.status === "in-progress" ? "Working..." : "Pending"}
              />
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
};

export default RequestDTRClient;

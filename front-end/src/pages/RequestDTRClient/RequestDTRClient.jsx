import React from "react";
import { Card, Typography, Button, Form, Input, DatePicker, message } from "antd";
import { Link } from "react-router-dom";
import bgImage from "../../assets/bgemb.webp";
import axiosInstance from "../../api/axiosInstance";
import { generateDTRPdf } from "../../../utils/generateDTRpdf";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import "./requestdtrclient.css";

dayjs.extend(utc);
dayjs.extend(timezone);

const { Title, Text } = Typography;

const RequestDTRClient = () => {
  const [form] = Form.useForm();

  const onFinish = async (values) => {
    try {
      const [startDate, endDate] = values.dateRange;

      // 1. Check for DTR data availability
      const checkResponse = await axiosInstance.get("/dtrdatas/check", {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      });

      if (!checkResponse.data.data.available) {
        message.error("DTR for that cut off is not yet available.");
        return;
      }

      const selectedRecord = checkResponse.data.data.record;

      // 2. Fetch employee data
      const employeeResponse = await axiosInstance.get(`/employees/by-emp-id/${values.employeeId}`);
      const employee = employeeResponse.data.data;

      // 3. Fetch DTR logs
      const dtrLogsResponse = await axiosInstance.get(`/dtrlogs/merged?acNo=${employee.normalizedEmpId}`);
      const dtrLogs = dtrLogsResponse.data.data;

      const STATE_LABELS = {
        "C/In": "Time In",
        "Out": "Break Out",
        "Out Back": "Break In",
        "C/Out": "Time Out",
      };

      const logsByDay = dtrLogs.reduce((acc, log) => {
        const dateKey = dayjs(log.time).tz("Asia/Manila").format("YYYY-MM-DD");
        if (!acc[dateKey]) {
          acc[dateKey] = {};
        }
        const stateLabel = STATE_LABELS[log.state];
        if (stateLabel) {
            acc[dateKey][stateLabel] = dayjs(log.time).tz("Asia/Manila").format("h:mm");
        }
        return acc;
      }, {});

      const dtrLogsForPdf = {
        [employee.empId]: logsByDay
      };

      // 4. Generate PDF
      await generateDTRPdf({
        employee,
        dtrLogs: dtrLogsForPdf,
        selectedRecord,
      });

      // 5. Log generation and notify
      await axiosInstance.post("/dtr/log-generation", {
        employeeId: values.employeeId,
        period: `${startDate.format("YYYY-MM-DD")} to ${endDate.format("YYYY-MM-DD")}`,
        generatedBy: values.email,
      });

      message.success("DTR generated successfully!");
      form.resetFields();

    } catch (error) {
      message.error("An error occurred while processing your request.");
      console.error("DTR request error:", error);
    }
  };

  return (
    <div
      className="auth-container"
      style={{
        backgroundImage: `linear-gradient(
          135deg,
          rgba(0, 75, 128, 0.85),
          rgba(154, 205, 50, 0.85),
          rgba(245, 216, 163, 0.85)
        ), url(${bgImage})`,
      }}
    >
      <Card className="auth-card">
        <Title level={3} className="auth-title">
          DTR Request
        </Title>
        <Text>Please fill out the form below to request a copy of your DTR.</Text>

        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: "1rem" }}
          onFinish={onFinish}
        >
          <Form.Item
            label="Employee ID"
            name="employeeId"
            rules={[{ required: true, message: "Employee ID is required" }]}
          >
            <Input placeholder="Enter your Employee ID" />
          </Form.Item>

          <Form.Item
            label="Date Range"
            name="dateRange"
            rules={[{ required: true, message: "Please select a date range" }]}
          >
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
            <Button type="primary" htmlType="submit" block>
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
    </div>
  );
};

export default RequestDTRClient;

import React from "react";
import { Card, Typography, Button, Form, Input, DatePicker, message } from "antd";
import { Link } from "react-router-dom";
import bgImage from "../../assets/bgemb.webp";
import axiosInstance from "../../api/axiosInstance";
import "./paysliprequest.css";

const { Title, Text } = Typography;

const PayslipRequest = () => {
  const [form] = Form.useForm();

  const onFinish = async (values) => {
    try {
      const response = await axiosInstance.post("/payslip-requests", {
        employeeId: values.employeeId,
        period: values.month.format("YYYY-MM"),
        email: values.email,
      });

      if (response.data.success) {
        message.success("Payslip request submitted successfully!");
        form.resetFields();
      } else {
        message.error(response.data.message || "Failed to submit payslip request.");
      }
    } catch (error) {
      message.error("An error occurred while submitting the request.");
      console.error("Payslip request error:", error);
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
          Payslip Request
        </Title>
        <Text>Please fill out the form below to securely request your payslip.</Text>

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
            label="Payslip Month"
            name="month"
            rules={[{ required: true, message: "Please select a month" }]}
          >
            <DatePicker picker="month" style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            label="Email Address"
            name="email"
            rules={[
              { required: true, message: "Email is required" },
              { type: "email", message: "Please enter a valid email address" },
            ]}
          >
            <Input placeholder="Enter your email where payslip will be sent" />
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

export default PayslipRequest;

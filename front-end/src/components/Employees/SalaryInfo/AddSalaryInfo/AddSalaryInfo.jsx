import React, { useState, useEffect } from "react";
import {
  Form,
  Input,
  Button,
  Select,
  InputNumber,
  Space,
  notification,
  Row,
  Col,
} from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import axiosInstance from "../../../../api/axiosInstance";

const { Option } = Select;

const AddSalaryInfo = ({ onClose }) => {
  const [form] = Form.useForm();
  const [employees, setEmployees] = useState([]);
  const [existingSalaryEmployeeIds, setExistingSalaryEmployeeIds] = useState(
    new Set()
  );
  const [selectedSalaryType, setSelectedSalaryType] = useState(null);

  useEffect(() => {
    fetchEmployeesAndSalaries();
  }, []);

  

  const fetchEmployeesAndSalaries = async () => {
    try {
      const [employeesRes, salariesRes] = await Promise.all([
        axiosInstance.get("/employees"),
        axiosInstance.get("/employee-salaries"),
      ]);
      const sortedEmployees = employeesRes.data.sort((a, b) =>
        a.empNo.localeCompare(b.empNo, undefined, { numeric: true })
      );
      setEmployees(sortedEmployees);
      const existingIds = new Set(
        salariesRes.data.map((sal) => sal.employeeId._id)
      );
      setExistingSalaryEmployeeIds(existingIds);
    } catch (error) {
      console.error("Failed to fetch employees or salaries:", error);
      notification.error({
        message: "Error",
        description: "Failed to load employee list or existing salaries.",
      });
    }
  };

  const onFinish = async (values) => {
    try {
      await axiosInstance.post("/employee-salaries", values);
      notification.success({
        message: "Success",
        description: "Employee salary information added successfully!",
      });
      onClose();
    } catch (error) {
      console.error("Failed to add employee salary:", error);
      notification.error({
        message: "Error",
        description:
          error.response?.data?.message ||
          "Failed to add employee salary information.",
      });
    }
  };

  const handleSalaryTypeChange = (value) => {
    setSelectedSalaryType(value);
    form.setFieldsValue({ employeeId: null }); // Reset employee selection
  };

  const handleFormValuesChange = (changedValues, allValues) => {
    if (changedValues.ratePerMonth !== undefined) {
      const cutOffRate = (changedValues.ratePerMonth || 0) / 2;
      form.setFieldsValue({ cutOffRate });
    }
  };

  const availableEmployees = employees.filter(
    (emp) =>
      !existingSalaryEmployeeIds.has(emp._id) &&
      emp.empType === selectedSalaryType
  );

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onFinish}
      onValuesChange={handleFormValuesChange}
      initialValues={{
        payrollType: "monthly",
        benefitsAndAllowances: [{ name: "", amount: 0 }],
        deductions: [{ name: undefined, amount: 0 }],
        leaveCredits: [{ type: "", total: 0, used: 0, remaining: 0 }],
      }}
    >
      <Form.Item
        label="Salary Type"
        name="salaryType"
        rules={[{ required: true, message: "Please select a salary type!" }]}
      >
        <Select
          placeholder="Select salary type"
          onChange={handleSalaryTypeChange}
        >
          <Option value="Regular">Regular Position</Option>
          <Option value="Contract of Service">Contract of Service</Option>
        </Select>
      </Form.Item>

      {selectedSalaryType && (
        <Form.Item
          label="Employee"
          name="employeeId"
          rules={[{ required: true, message: "Please select an employee!" }]}
        >
          <Select
            showSearch
            placeholder="Select an employee"
            optionFilterProp="children"
            filterOption={(input, option) =>
              String(option.children)
                .toLowerCase()
                .includes(input.toLowerCase())
            }
            disabled={!selectedSalaryType}
          >
            {availableEmployees.map((emp) => (
              <Option key={emp._id} value={emp._id}>
                {emp.name} (ID: {emp.empId}, Emp No: {emp.empNo})
              </Option>
            ))}
          </Select>
        </Form.Item>
      )}

      {selectedSalaryType === "Contract of Service" ? (
        <>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Rate per Month" name="ratePerMonth">
                <InputNumber
                  min={0}
                  formatter={(value) =>
                    `₱ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                  }
                  parser={(value) => value.replace(/₱\s?|(,*)/g, "")}
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Cut off Rate" name="cutOffRate">
                <InputNumber
                  min={0}
                  formatter={(value) =>
                    `₱ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                  }
                  parser={(value) => value.replace(/₱\s?|(,*)/g, "")}
                  style={{ width: "100%" }}
                  disabled
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Daily Rate" name="dailyRate">
                <InputNumber
                  min={0}
                  formatter={(value) =>
                    `₱ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                  }
                  parser={(value) => value.replace(/₱\s?|(,*)/g, "")}
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </Col>
          </Row>

          
        </>
      ) : selectedSalaryType === "Regular" ? (
        <>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Rate per Month" name="ratePerMonth">
                <InputNumber
                  min={0}
                  formatter={(value) =>
                    `₱ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                  }
                  parser={(value) => value.replace(/₱\s?|(,*)/g, "")}
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Cut off Rate" name="cutOffRate">
                <InputNumber
                  min={0}
                  formatter={(value) =>
                    `₱ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                  }
                  parser={(value) => value.replace(/₱\s?|(,*)/g, "")}
                  style={{ width: "100%" }}
                  disabled
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Payroll Type" name="payrollType">
            <Select>
              <Option value="monthly">Monthly</Option>
              <Option value="semi-monthly">Semi-Monthly</Option>
              <Option value="weekly">Weekly</Option>
              <Option value="daily">Daily</Option>
            </Select>
          </Form.Item>
        </>
      ) : null}

      <Form.Item>
        <Button type="primary" htmlType="submit" style={{ marginRight: 8 }}>
          Add Salary Info
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </Form.Item>
    </Form>
  );
};

export default AddSalaryInfo;

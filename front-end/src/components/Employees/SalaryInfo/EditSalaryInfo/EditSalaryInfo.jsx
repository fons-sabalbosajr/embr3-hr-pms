import React, { useEffect } from "react";
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
import { secureGet } from "../../../../../utils/secureStorage";

const { Option } = Select;

const EditSalaryInfo = ({ onClose, salaryData }) => {
  const [form] = Form.useForm();

  const currentUser = secureGet("user");
  const showSalaryAmounts = currentUser?.showSalaryAmounts ?? true;

  useEffect(() => {
    if (salaryData) {
      const cutOffRate = (salaryData.ratePerMonth || 0) / 2;
      form.setFieldsValue({
        ...salaryData,
        employeeId: salaryData.employeeId._id,
        cutOffRate,
      });
    }
  }, [salaryData, form]);

  const onFinish = async (values) => {
    try {
      await axiosInstance.put(`/employee-salaries/${salaryData._id}`, values);
      notification.success({
        message: "Success",
        description: "Employee salary information updated successfully!",
      });
      onClose();
    } catch (error) {
      console.error("Failed to update employee salary:", error);
      notification.error({
        message: "Error",
        description:
          error.response?.data?.message ||
          "Failed to update employee salary information.",
      });
    }
  };

  const handleFormValuesChange = (changedValues, allValues) => {
    if (changedValues.ratePerMonth !== undefined) {
      const cutOffRate = (changedValues.ratePerMonth || 0) / 2;
      form.setFieldsValue({ cutOffRate });
    }
  };

  const salaryType = salaryData?.salaryType;

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onFinish}
      onValuesChange={handleFormValuesChange}
    >
      <Form.Item label="Employee">
        <Input value={salaryData?.employeeId?.name} disabled />
      </Form.Item>

      {salaryType === "Contract of Service" ? (
        <>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Rate per Month" name="ratePerMonth">
                <InputNumber
                  min={0}
                  formatter={(value) =>
                    showSalaryAmounts
                      ? `₱ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                      : "*****"
                  }
                  parser={(value) => value.replace(/₱\s?|(,*)/g, "")}
                  style={{ width: "100%" }}
                  disabled={!showSalaryAmounts}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Cut off Rate" name="cutOffRate">
                <InputNumber
                  min={0}
                  formatter={(value) =>
                    showSalaryAmounts
                      ? `₱ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                      : "*****"
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
                    showSalaryAmounts
                      ? `₱ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                      : "*****"
                  }
                  parser={(value) => value.replace(/₱\s?|(,*)/g, "")}
                  style={{ width: "100%" }}
                  disabled={!showSalaryAmounts}
                />
              </Form.Item>
            </Col>
          </Row>

          
        </>
      ) : (
        // Render fields for Regular employees
        <>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Rate per Month" name="ratePerMonth">
                <InputNumber
                  min={0}
                  formatter={(value) =>
                    showSalaryAmounts
                      ? `₱ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                      : "*****"
                  }
                  parser={(value) => value.replace(/₱\s?|(,*)/g, "")}
                  style={{ width: "100%" }}
                  disabled={!showSalaryAmounts}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Cut off Rate" name="cutOffRate">
                <InputNumber
                  min={0}
                  formatter={(value) =>
                    showSalaryAmounts
                      ? `₱ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                      : "*****"
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
      )}

      <Form.Item>
        <Button type="primary" htmlType="submit" style={{ marginRight: 8 }}>
          Update Salary Info
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </Form.Item>
    </Form>
  );
};

export default EditSalaryInfo;

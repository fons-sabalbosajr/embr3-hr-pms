import React, { useEffect, useState } from "react";
import { Form, Input, Select, Button, message } from "antd";
import axios from "../../../../api/axiosInstance";

const { Option } = Select;

const EditEmployee = ({ employee, onClose }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false); // <-- loading state

  useEffect(() => {
    if (employee) {
      form.setFieldsValue(employee);
    }
  }, [employee, form]);

  const handleSubmit = async (values) => {
    setLoading(true);

    try {
      let altIds = [];

      if (values.alternateEmpIds) {
        if (Array.isArray(values.alternateEmpIds)) {
          altIds = values.alternateEmpIds.map((id) => id.trim());
        } else if (typeof values.alternateEmpIds === "string") {
          altIds = values.alternateEmpIds.split(",").map((id) => id.trim());
        }
      }

      await axios.put(`/employees/${employee._id}`, {
        ...values,
        alternateEmpIds: altIds,
      });

      message.success("Employee updated successfully.");
      onClose();
    } catch (error) {
      console.error("Failed to update employee:", error);
      message.error("Failed to update employee.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={employee}
    >
      <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item name="empId" label="ID Number" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item
        name="alternateEmpIds"
        label="Alternate Employee IDs (comma separated)"
      >
        <Input placeholder="e.g. 12345, 67890" />
      </Form.Item>
      <Form.Item name="position" label="Position" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item name="sectionOrUnit" label="Section/Unit">
        <Input />
      </Form.Item>
      <Form.Item name="division" label="Division">
        <Input />
      </Form.Item>
      <Form.Item
        name="empType"
        label="Employee Type"
        rules={[{ required: true }]}
      >
        <Select placeholder="Select employee type">
          <Option value="Regular">Regular</Option>
          <Option value="Contractual">Contractual</Option>
        </Select>
      </Form.Item>
  
      <Form.Item>
        <Button
          htmlType="submit"
          type="primary"
          block
          loading={loading}
          disabled={loading}
        >
          {loading ? "Updating..." : "Save Changes"}
        </Button>
      </Form.Item>
    </Form>
  );
};

export default EditEmployee;

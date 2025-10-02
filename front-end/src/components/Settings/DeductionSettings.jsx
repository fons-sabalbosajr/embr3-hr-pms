import React, { useState, useEffect } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  notification,
  Popconfirm,
  InputNumber,
  Radio,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import axiosInstance from "../../api/axiosInstance.js";

const { Option } = Select;

const DeductionSettings = () => {
  const [deductionTypes, setDeductionTypes] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeduction, setEditingDeduction] = useState(null);
  const [form] = Form.useForm();

  const fetchDeductionTypes = async () => {
    try {
      const response = await axiosInstance.get("/deduction-types");
      setDeductionTypes(response.data);
    } catch (error) {
      notification.error({
        message: "Error fetching deduction types",
        description: "Could not fetch deduction types from the server.",
      });
    }
  };

  useEffect(() => {
    fetchDeductionTypes();
  }, []);

  const handleAdd = () => {
    setEditingDeduction(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (record) => {
    setEditingDeduction(record);
    form.setFieldsValue(record);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await axiosInstance.delete(`/deduction-types/${id}`);
      notification.success({ message: "Deduction type deleted successfully" });
      fetchDeductionTypes(); // Refresh the list
    } catch (error) {
      notification.error({
        message: "Error deleting deduction type",
        description: "This deduction type might be in use.",
      });
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingDeduction) {
        // Update existing deduction
        await axiosInstance.put(
          `/deduction-types/${editingDeduction._id}`,
          values
        );
        notification.success({
          message: "Deduction type updated successfully",
        });
      } else {
        // Create new deduction
        await axiosInstance.post("/deduction-types", values);
        notification.success({
          message: "Deduction type added successfully",
        });
      }
      fetchDeductionTypes();
      setIsModalOpen(false);
      form.resetFields();
    } catch (error) {
      notification.error({
        message: "Validation Failed",
        description: "Please check the form fields.",
      });
    }
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    form.resetFields();
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      render: (text) => (
        <span style={{ color: text === "incentive" ? "green" : "red" }}>
          {text}
        </span>
      ),
    },
    {
        title: "Calculation Type",
        dataIndex: "calculationType",
        key: "calculationType",
    },
    {
      title: "Amount/Formula",
      dataIndex: "amount",
      key: "amount",
      render: (text, record) => {
        if (record.calculationType === 'formula') {
            return record.formula;
        }
        return `₱${text.toLocaleString()}`;
      }
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <span>
          <Button
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            style={{ marginRight: 8 }}
          >
            Edit
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this?"
            onConfirm={() => handleDelete(record._id)}
            okText="Yes"
            cancelText="No"
          >
            <Button icon={<DeleteOutlined />} danger>
              Delete
            </Button>
          </Popconfirm>
        </span>
      ),
    },
  ];

  return (
    <div>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={handleAdd}
        style={{ marginBottom: 16 }}
      >
        Add Deduction/Incentive
      </Button>
      <Table
        columns={columns}
        dataSource={deductionTypes}
        rowKey="_id"
        bordered
      />

      <Modal
        title={editingDeduction ? "Edit Deduction Type" : "Add Deduction Type"}
        open={isModalOpen}
        onOk={handleOk}
        onCancel={handleCancel}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: "Please enter a name" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="type"
            label="Type"
            rules={[{ required: true, message: "Please select a type" }]}
          >
            <Select>
              <Option value="deduction">Deduction</Option>
              <Option value="incentive">Incentive</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="calculationType"
            label="Calculation Type"
            initialValue="fixed"
            rules={[{ required: true, message: 'Please select a calculation type' }]}
          >
            <Radio.Group>
                <Radio value="fixed">Fixed Amount</Radio>
                <Radio value="formula">Formula</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.calculationType !== currentValues.calculationType}
          >
            {({ getFieldValue }) =>
              getFieldValue('calculationType') === 'formula' ? (
                <Form.Item
                    name="formula"
                    label="Formula"
                    rules={[{ required: true, message: 'Please enter the formula' }]}
                >
                    <Input.TextArea rows={2} placeholder="e.g., salary * 0.1" />
                </Form.Item>
              ) : (
                <Form.Item
                    name="amount"
                    label="Amount"
                    rules={[{ required: true, message: "Please enter an amount" }]}
                >
                    <InputNumber style={{ width: '100%' }} min={0} />
                </Form.Item>
              )
            }
          </Form.Item>
          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: "Please enter a description" }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DeductionSettings;


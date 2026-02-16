import React, { useState, useEffect, useMemo } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Radio,
  Space,
  Typography,
  Card,
  Tag,
  Divider,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import axiosInstance from "../../api/axiosInstance.js";
import { swalSuccess, swalError, swalWarning, swalConfirm } from "../../utils/swalHelper";
import useDemoMode from "../../hooks/useDemoMode";

const { Option } = Select;

const DeductionSettings = () => {
  const [deductionTypes, setDeductionTypes] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeduction, setEditingDeduction] = useState(null);
  const [form] = Form.useForm();
  const { readOnly, isDemoActive, isDemoUser } = useDemoMode();
  const [newlyAddedIds, setNewlyAddedIds] = useState(new Set());

  const fetchDeductionTypes = async () => {
    try {
      const response = await axiosInstance.get("/deduction-types");
      setDeductionTypes(response.data);
    } catch (error) {
      swalError("Could not fetch deduction types from the server.");
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
      swalSuccess("Deduction type deleted successfully");
      fetchDeductionTypes(); // Refresh the list
    } catch (error) {
      swalError("This deduction type might be in use.");
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingDeduction) {
        // Update existing deduction
        await axiosInstance.put(
          `/deduction-types/${editingDeduction._id}`,
          values,
        );
        swalSuccess("Deduction type updated successfully");
      } else {
        // Create new deduction
        const { data } = await axiosInstance.post("/deduction-types", values);
        swalSuccess("Deduction type added successfully");
        // Track as newly added for this session (allow delete even in demo)
        if (data && (data._id || data.id)) {
          setNewlyAddedIds(
            (prev) => new Set([...Array.from(prev), data._id || data.id]),
          );
        }
      }
      fetchDeductionTypes();
      setIsModalOpen(false);
      form.resetFields();
    } catch (error) {
      swalError("Please check the form fields.");
    }
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    form.resetFields();
  };

  const canDelete = useMemo(
    () => (record) => {
      if (!(isDemoActive && isDemoUser)) return true; // non-demo unaffected
      // In demo: allow delete only for newly added in this session
      return newlyAddedIds.has(record._id);
    },
    [isDemoActive, isDemoUser, newlyAddedIds],
  );

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (text) => (
        <span style={{ fontSize: 12, fontWeight: 500 }}>{text}</span>
      ),
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      render: (text) => (
        <Tag
          color={text === "incentive" ? "green" : "red"}
          style={{ fontSize: 11, padding: "0 6px", lineHeight: "18px" }}
        >
          {text}
        </Tag>
      ),
    },
    {
      title: "Calculation Type",
      dataIndex: "calculationType",
      key: "calculationType",
      render: (val) => (
        <Tag
          color={val === "formula" ? "purple" : "blue"}
          style={{ fontSize: 11, padding: "0 6px", lineHeight: "18px" }}
        >
          {val}
        </Tag>
      ),
    },
    {
      title: "Amount/Formula",
      dataIndex: "amount",
      key: "amount",
      render: (text, record) => {
        if (record.calculationType === "formula") {
          return <code style={{ fontSize: 11 }}>{record.formula}</code>;
        }
        return <span style={{ fontSize: 12 }}>₱{text.toLocaleString()}</span>;
      },
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      render: (val) => (
        <span style={{ fontSize: 11, color: "#aaa" }}>{val}</span>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space size={4} wrap>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            disabled={readOnly && isDemoActive && isDemoUser}
          >
            Edit
          </Button>
          <Button
            size="small"
            icon={<DeleteOutlined />}
            danger
            disabled={!canDelete(record)}
            onClick={async () => {
              const result = await swalConfirm({
                title: "Delete this deduction type?",
                text: "This action cannot be undone.",
                confirmText: "Yes",
                cancelText: "No",
                dangerMode: true,
              });
              if (result.isConfirmed) handleDelete(record._id);
            }}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={
        <Space direction="vertical" size={2} style={{ width: "100%" }}>
          <Typography.Title
            level={4}
            style={{ margin: 0, fontSize: 18, fontWeight: 600 }}
          >
            Payroll Deductions & Incentives
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Configure standardized deduction and incentive types used in payslip
            calculations.
          </Typography.Text>
        </Space>
      }
      extra={
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={handleAdd}
          disabled={readOnly && isDemoActive && isDemoUser}
        >
          New Type
        </Button>
      }
    >
      <div className="corp-toolbar">
        <Tag color="blue" style={{ fontSize: 11 }}>
          Total: {deductionTypes.length}
        </Tag>
        {isDemoActive && isDemoUser && (
          <Tag color="gold" style={{ fontSize: 11 }}>
            Demo Mode: edits restricted
          </Tag>
        )}
      </div>
      <Table
        columns={columns}
        dataSource={deductionTypes}
        rowKey="_id"
        size="small"
        className="compact-table"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: [5, 10, 20, 50],
        }}
      />

      <Modal
        title={editingDeduction ? "Edit Deduction Type" : "Add Deduction Type"}
        open={isModalOpen}
        onOk={handleOk}
        onCancel={handleCancel}
        width={520}
        okButtonProps={{ disabled: readOnly && isDemoActive && isDemoUser }}
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: "Please enter a name" }]}
          >
            <Input
              disabled={readOnly && isDemoActive && isDemoUser}
              placeholder="e.g., SSS Contribution"
            />
          </Form.Item>
          <Form.Item
            name="type"
            label="Type"
            rules={[{ required: true, message: "Please select a type" }]}
          >
            <Select
              disabled={readOnly && isDemoActive && isDemoUser}
              placeholder="Select category"
            >
              <Option value="deduction">Deduction</Option>
              <Option value="incentive">Incentive</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="calculationType"
            label="Calculation Type"
            initialValue="fixed"
            rules={[
              { required: true, message: "Please select a calculation type" },
            ]}
          >
            <Radio.Group disabled={readOnly && isDemoActive && isDemoUser}>
              <Radio value="fixed">Fixed Amount</Radio>
              <Radio value="formula">Formula</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.calculationType !== currentValues.calculationType
            }
          >
            {({ getFieldValue }) =>
              getFieldValue("calculationType") === "formula" ? (
                <Form.Item
                  name="formula"
                  label="Formula"
                  rules={[
                    { required: true, message: "Please enter the formula" },
                  ]}
                >
                  <Input.TextArea
                    rows={2}
                    placeholder="e.g., grossIncome * 0.05"
                    disabled={readOnly && isDemoActive && isDemoUser}
                    style={{ fontSize: 12 }}
                  />
                </Form.Item>
              ) : (
                <Form.Item
                  name="amount"
                  label="Amount"
                  rules={[
                    { required: true, message: "Please enter an amount" },
                  ]}
                >
                  <InputNumber
                    style={{ width: "100%" }}
                    min={0}
                    disabled={readOnly && isDemoActive && isDemoUser}
                    size="small"
                  />
                </Form.Item>
              )
            }
          </Form.Item>
          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: "Please enter a description" }]}
          >
            <Input.TextArea
              rows={3}
              disabled={readOnly && isDemoActive && isDemoUser}
              style={{ fontSize: 12 }}
              placeholder="Short description for internal reference"
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default DeductionSettings;

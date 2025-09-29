import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, InputNumber, notification, Space } from 'antd';
import axiosInstance from '../../api/axiosInstance';

const { Option } = Select;

const DeductionSettings = () => {
  const [deductionTypes, setDeductionTypes] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingDeduction, setEditingDeduction] = useState(null);
  const [form] = Form.useForm();
  const calculationType = Form.useWatch('calculationType', form);

  const fetchDeductionTypes = async () => {
    try {
      const response = await axiosInstance.get('/deduction-types');
      setDeductionTypes(response.data);
    } catch (error) {
      notification.error({ message: 'Failed to fetch deduction types' });
    }
  };

  useEffect(() => {
    fetchDeductionTypes();
  }, []);

  const showModal = (deduction = null) => {
    setEditingDeduction(deduction);
    form.setFieldsValue(deduction || { name: '', description: '', type: 'deduction', calculationType: 'fixed', amount: 0 });
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    setEditingDeduction(null);
    form.resetFields();
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingDeduction) {
        await axiosInstance.put(`/deduction-types/${editingDeduction._id}`, values);
        notification.success({ message: 'Deduction/Incentive updated successfully' });
      } else {
        await axiosInstance.post('/deduction-types', values);
        notification.success({ message: 'Deduction/Incentive added successfully' });
      }
      fetchDeductionTypes();
      handleCancel();
    } catch (error) {
      notification.error({ message: 'Failed to save deduction/incentive' });
    }
  };

  const handleDelete = async (id) => {
    try {
      await axiosInstance.delete(`/deduction-types/${id}`);
      notification.success({ message: 'Deduction/Incentive deleted successfully' });
      fetchDeductionTypes();
    } catch (error) {
      notification.error({ message: 'Failed to delete deduction/incentive' });
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <span style={{ color: record.type === 'deduction' ? 'red' : 'green' }}>
          {text}
        </span>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => type.charAt(0).toUpperCase() + type.slice(1),
    },
    {
      title: 'Calculation',
      dataIndex: 'calculationType',
      key: 'calculationType',
      render: (calculationType, record) => {
        if (calculationType === 'formula') {
          return `Formula: ${record.formula}`;
        }
        return `Fixed: ₱${record.amount.toLocaleString()}`;
      }
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button onClick={() => showModal(record)}>Edit</Button>
          <Button danger onClick={() => handleDelete(record._id)}>Delete</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Button type="primary" onClick={() => showModal()} style={{ marginBottom: 16 }}>
        Add Deduction/Incentive
      </Button>
      <Table columns={columns} dataSource={deductionTypes} rowKey="_id" />
      <Modal
        title={editingDeduction ? 'Edit Deduction/Incentive' : 'Add Deduction/Incentive'}
        visible={isModalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea />
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select>
              <Option value="deduction">Deduction</Option>
              <Option value="incentive">Incentive</Option>
            </Select>
          </Form.Item>
          <Form.Item name="calculationType" label="Calculation Type" rules={[{ required: true }]}>
            <Select>
              <Option value="fixed">Fixed Amount</Option>
              <Option value="formula">Formula</Option>
            </Select>
          </Form.Item>
          {calculationType === 'fixed' ? (
            <Form.Item name="amount" label="Amount" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          ) : (
            <Form.Item name="formula" label="Formula" rules={[{ required: true }]}>
              <Input placeholder="e.g., monthlySalary" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default DeductionSettings;

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Form, Input, Button, Typography } from 'antd';
import useNotify from '../../hooks/useNotify';
import axiosInstance from '../../api/axiosInstance';

const ConfirmPasswordChange = () => {
  const { notification } = useNotify();
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    if (values.newPassword !== values.confirmPassword) {
      notification.error({ message: 'New passwords do not match' });
      return;
    }
    setLoading(true);
    try {
      await axiosInstance.post('/users/confirm-password-change', {
        token,
        newPassword: values.newPassword,
      });
      notification.success({ message: 'Password changed successfully' });
      navigate('/auth');
    } catch (err) {
      notification.error({ message: err.response?.data?.message || 'Failed to change password' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--app-content-bg)' }}>
      <Card title="Confirm Password Change" className="corp-panel" style={{ width: 420 }}>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          Enter your new password to complete the change for your account.
        </Typography.Paragraph>
        <Form layout="vertical" size="small" onFinish={onFinish}>
          <Form.Item label="New Password" name="newPassword" rules={[{ required: true, message: 'Please enter a new password' }]}> 
            <Input.Password />
          </Form.Item>
          <Form.Item label="Confirm New Password" name="confirmPassword" rules={[{ required: true, message: 'Please confirm the new password' }]}> 
            <Input.Password />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} size="small" block>
              Update Password
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ConfirmPasswordChange;

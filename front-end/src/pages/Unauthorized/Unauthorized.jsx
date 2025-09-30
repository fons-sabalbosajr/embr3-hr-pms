import React from 'react';
import { Result, Button, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

const Unauthorized = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const handleContactAdmin = () => {
    window.location.href = "mailto:admin@example.com?subject=Unauthorized Access Issue";
  };

  return (
    <Result
      status="403"
      title="403 - Unauthorized"
      subTitle="Sorry, you are not authorized to access this page or your session has expired."
      extra={
        <Space>
          <Button type="primary" onClick={handleLogout}>
            Logout
          </Button>
          <Button onClick={handleContactAdmin}>
            Contact Admin
          </Button>
        </Space>
      }
    />
  );
};

export default Unauthorized;
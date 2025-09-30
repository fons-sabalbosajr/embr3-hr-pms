import React, { useState, useEffect } from "react";
import { Card, Switch, Typography, message, Table, Modal, Button } from "antd";
import axiosInstance from "../../../api/axiosInstance";
import useAuth from "../../../hooks/useAuth";

const { Title } = Typography;

const UserAccess = () => {
  const { user: currentUser, updateCurrentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axiosInstance.get("/users");
        if (response.data.success) {
          setUsers(response.data.data);
        }
      } catch (error) {
        message.error("Failed to fetch users");
        console.error("Failed to fetch users:", error);
      }
    };

    fetchUsers();
  }, []);

  const handleToggle = async (userId, key, value) => {
    try {
      const response = await axiosInstance.put(`/users/${userId}/access`, { [key]: value });
      if (response.data.success) {
        const updatedUser = response.data.data;
        setUsers(users.map(user => user._id === userId ? updatedUser : user));
        setSelectedUser(updatedUser);
        if (currentUser._id === userId) {
          updateCurrentUser(updatedUser);
        }
        message.success(`Successfully updated ${key} for user.`);
      } else {
        message.error(response.data.message || "Failed to update user access");
      }
    } catch (error) {
      message.error("Failed to update user access");
      console.error("Error updating user access:", error);
    }
  };

  const showModal = (user) => {
    setSelectedUser(user);
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    setSelectedUser(null);
  };

  const userColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (text, record) => (
        <Button type="primary" onClick={() => showModal(record)}>
          Manage Access
        </Button>
      ),
    },
  ];

  const accessColumns = [
      {
          title: 'Permission',
          dataIndex: 'permission',
          key: 'permission',
      },
      {
          title: 'Status',
          dataIndex: 'status',
          key: 'status',
      }
  ]

  const getAccessDataSource = (user) => {
      if (!user) return [];
      return [
          {
              key: '1',
              permission: 'Verified',
              status: <Switch checked={user.isVerified} onChange={(val) => handleToggle(user._id, "isVerified", val)} style={{ backgroundColor: user.isVerified ? 'green' : '' }} />
          },
          {
            key: '2',
            permission: 'Admin Access',
            status: <Switch checked={user.isAdmin || false} onChange={(val) => handleToggle(user._id, "isAdmin", val)} />
          },
          {
            key: '3',
            permission: 'Can Manage Users',
            status: <Switch checked={user.canManageUsers || false} onChange={(val) => handleToggle(user._id, "canManageUsers", val)} />
          },
          {
            key: '4',
            permission: 'Can View Dashboard',
            status: <Switch checked={user.canViewDashboard || false} onChange={(val) => handleToggle(user._id, "canViewDashboard", val)} />
          },
          {
            key: '5',
            permission: 'Can View Employees',
            status: <Switch checked={user.canViewEmployees || false} onChange={(val) => handleToggle(user._id, "canViewEmployees", val)} />
          },
          {
            key: '6',
            permission: 'Can Edit Employees',
            status: <Switch checked={user.canEditEmployees || false} onChange={(val) => handleToggle(user._id, "canEditEmployees", val)} />
          },
          {
            key: '7',
            permission: 'Can View DTR',
            status: <Switch checked={user.canViewDTR || false} onChange={(val) => handleToggle(user._id, "canViewDTR", val)} />
          },
          {
            key: '8',
            permission: 'Can Process DTR',
            status: <Switch checked={user.canProcessDTR || false} onChange={(val) => handleToggle(user._id, "canProcessDTR", val)} />
          },
          {
            key: '9',
            permission: 'Can View Payroll',
            status: <Switch checked={user.canViewPayroll || false} onChange={(val) => handleToggle(user._id, "canViewPayroll", val)} />
          },
          {
            key: '10',
            permission: 'Can Process Payroll',
            status: <Switch checked={user.canProcessPayroll || false} onChange={(val) => handleToggle(user._id, "canProcessPayroll", val)} />
          },
          {
            key: '11',
            permission: 'Can View Trainings',
            status: <Switch checked={user.canViewTrainings || false} onChange={(val) => handleToggle(user._id, "canViewTrainings", val)} />
          },
          {
            key: '12',
            permission: 'Can Edit Trainings',
            status: <Switch checked={user.canEditTrainings || false} onChange={(val) => handleToggle(user._id, "canEditTrainings", val)} />
          },
          {
            key: '13',
            permission: 'Can Access Settings',
            status: <Switch checked={user.canAccessSettings || false} onChange={(val) => handleToggle(user._id, "canAccessSettings", val)} />
          },
          {
            key: '14',
            permission: 'Can Change Deductions',
            status: <Switch checked={user.canChangeDeductions || false} onChange={(val) => handleToggle(user._id, "canChangeDeductions", val)} />
          },
          {
            key: '15',
            permission: 'Can Perform Backup',
            status: <Switch checked={user.canPerformBackup || false} onChange={(val) => handleToggle(user._id, "canPerformBackup", val)} />
          },
          {
            key: '16',
            permission: 'Can Manipulate Biometrics',
            status: <Switch checked={user.canManipulateBiometrics} onChange={(val) => handleToggle(user._id, "canManipulateBiometrics", val)} />
          },
          {
            key: '17',
            permission: 'Show Salary Amounts',
            status: <Switch checked={user.showSalaryAmounts} onChange={(val) => handleToggle(user._id, "showSalaryAmounts", val)} />
          },
      ]
  }

  return (
    <Card style={{ margin: "10px", borderRadius: 12 }}>
      <Title level={3}>User Account Access Settings</Title>
      <Table dataSource={users} columns={userColumns} rowKey="_id" pagination={{ pageSize: 10 }} />

      {selectedUser && (
        <Modal
          title={`Access for ${selectedUser.name}`}
          open={isModalVisible}
          onCancel={handleCancel}
          footer={[
            <Button key="back" onClick={handleCancel}>
              Close
            </Button>,
          ]}
        >
            <Table dataSource={getAccessDataSource(selectedUser)} columns={accessColumns} pagination={false} />
        </Modal>
      )}
    </Card>
  );
};

export default UserAccess;

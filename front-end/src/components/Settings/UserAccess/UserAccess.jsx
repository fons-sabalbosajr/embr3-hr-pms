import React, { useState, useEffect } from "react";
import {
  Card,
  Switch,
  Typography,
  message,
  Table,
  Modal,
  Button,
  Collapse,
  List,
  Tag,
  Radio,
} from "antd";
import axiosInstance from "../../../api/axiosInstance";
import useAuth from "../../../hooks/useAuth";

const { Title, Text } = Typography;
const { Panel } = Collapse;

// Permission config for clean mapping
const accessGroups = [
  {
    key: "general",
    title: "General Access",
    permissions: [
      {
        key: "canViewDashboard",
        label: "Can View Dashboard",
        description: "Allows user to view the system dashboard with analytics.",
      },
      {
        key: "canAccessSettings",
        label: "Can Access Settings",
        description: "Allows user to configure system settings and preferences.",
      },
      {
        key: "showSalaryAmounts",
        label: "Show Salary Amounts",
        description: "Allows user to view sensitive salary details in payroll.",
      },
    ],
  },
  {
    key: "employees",
    title: "Employee Management",
    permissions: [
      {
        key: "canViewEmployees",
        label: "Can View Employees",
        description: "Allows user to view employee records.",
      },
      {
        key: "canEditEmployees",
        label: "Can Edit Employees",
        description: "Allows user to modify employee records.",
      },
    ],
  },
  {
    key: "dtrPayroll",
    title: "DTR & Payroll",
    permissions: [
      {
        key: "canViewDTR",
        label: "Can View DTR",
        description: "Allows user to view daily time records.",
      },
      {
        key: "canProcessDTR",
        label: "Can Process DTR",
        description: "Allows user to generate or process daily time records.",
      },
      {
        key: "canViewPayroll",
        label: "Can View Payroll",
        description: "Allows user to view payroll data.",
      },
      {
        key: "canProcessPayroll",
        label: "Can Process Payroll",
        description: "Allows user to process payroll runs.",
      },
    ],
  },
  {
    key: "trainings",
    title: "Trainings & Others",
    permissions: [
      {
        key: "canViewTrainings",
        label: "Can View Trainings",
        description: "Allows user to view training schedules and records.",
      },
      {
        key: "canEditTrainings",
        label: "Can Edit Trainings",
        description: "Allows user to create or modify trainings.",
      },
      {
        key: "canChangeDeductions",
        label: "Can Change Deductions",
        description: "Allows user to configure deductions.",
      },
      {
        key: "canPerformBackup",
        label: "Can Perform Backup",
        description: "Allows user to perform database backups.",
      },
      {
        key: "canManipulateBiometrics",
        label: "Can Manipulate Biometrics",
        description: "Allows user to override or change biometrics data.",
      },
    ],
  },
  {
    key: "messaging",
    title: "Messaging",
    permissions: [
      {
        key: "canViewMessages",
        label: "Can View Messages",
        description: "Allows user to view real-time DTR messages in the popover.",
      },
      {
        key: "canManageMessages",
        label: "Can Manage Messages",
        description: "Allows user to mark messages as read in the popover.",
      },
    ],
  },
];


// Danger Zone Config
const dangerZone = {
  key: "danger",
  title: "Navigation & Security Hierarchy (Danger Zone)",
  permissions: [
    {
      key: "isAdmin",
      label: "Administrator Access",
      description: "Full admin privileges for this user.",
    },
    {
      key: "canManageUsers",
      label: "Can Manage Users",
      description: "Allows user to create, update, and remove user accounts.",
    },
  ],
};

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
      const response = await axiosInstance.put(`/users/${userId}/access`, {
        [key]: value,
      });
      if (response.data.success) {
        const updatedUser = response.data.data;
        setUsers((prev) =>
          prev.map((u) => (u._id === userId ? updatedUser : u))
        );
        setSelectedUser(updatedUser);
        if (currentUser._id === userId) {
          updateCurrentUser(updatedUser);
        }
        message.success("Updated successfully.");
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
    { title: "Name", dataIndex: "name", key: "name" },
    { title: "Username", dataIndex: "username", key: "username" },
    { title: "Email", dataIndex: "email", key: "email" },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Button type="primary" onClick={() => showModal(record)}>
          Manage Access
        </Button>
      ),
    },
  ];

  return (
    <Card style={{ margin: "10px", borderRadius: 12 }}>
      <Title level={3}>User Account Access Settings</Title>
      <Table
        dataSource={users}
        columns={userColumns}
        rowKey="_id"
        pagination={{ pageSize: 10 }}
      />

      {selectedUser && (
        <Modal
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>Access for {selectedUser.name}</span>
              {selectedUser.isVerified && <Tag color="green">Verified</Tag>}
            </div>
          }
          open={isModalVisible}
          onCancel={handleCancel}
          footer={[
            <Button key="back" onClick={handleCancel}>
              Close
            </Button>,
          ]}
          width={700}
          style={{ top: 40 }}
        >
          <Collapse defaultActiveKey={["general"]} bordered={false}>
            {accessGroups.map((group) => (
              <Panel header={group.title} key={group.key}>
                <List
                  itemLayout="horizontal"
                  dataSource={group.permissions}
                  renderItem={(perm) => (
                    <List.Item
                      actions={[
                        <Switch
                          key={perm.key}
                          checked={selectedUser[perm.key] || false}
                          onChange={(val) =>
                            handleToggle(selectedUser._id, perm.key, val)
                          }
                        />,
                      ]}
                    >
                      <List.Item.Meta
                        title={perm.label}
                        description={perm.description}
                      />
                    </List.Item>
                  )}
                />
              </Panel>
            ))}

            {/* 🚨 Danger Zone */}
            <Panel
              header={
                <Text strong type="danger">
                  {dangerZone.title}
                </Text>
              }
              key={dangerZone.key}
            >
              <List
                itemLayout="horizontal"
                dataSource={dangerZone.permissions}
                renderItem={(perm) => (
                  <List.Item
                    actions={[
                      <Switch
                        key={perm.key}
                        checked={selectedUser[perm.key] || false}
                        onChange={(val) =>
                          handleToggle(selectedUser._id, perm.key, val)
                        }
                      />,
                    ]}
                  >
                    <List.Item.Meta
                      title={perm.label}
                      description={perm.description}
                    />
                  </List.Item>
                )}
              />

              {/* User Hierarchy */}
              <div style={{ marginTop: 16 }}>
                <Text strong>User Hierarchy</Text>
                <br />
                <Radio.Group
                  value={selectedUser.userType || "guest"}
                  onChange={(e) =>
                    handleToggle(selectedUser._id, "userType", e.target.value)
                  }
                  style={{ marginTop: 8 }}
                >
                  <Radio value="developer">Developer</Radio>
                  <Radio value="admin">Administrator</Radio>
                  <Radio value="coadmin">Co-Admin</Radio>
                  <Radio value="guest">Guest User</Radio>
                </Radio.Group>
              </div>
            </Panel>
          </Collapse>
        </Modal>
      )}
    </Card>
  );
};

export default UserAccess;

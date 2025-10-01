import React from "react";
import { Modal, Avatar, Typography, Divider, Space, Button } from "antd";
import {
  UserOutlined,
  IdcardOutlined,
  ClockCircleOutlined,
  MailOutlined,
} from "@ant-design/icons";

const ProfileModal = ({ isModalOpen, handleCancel, selectedEmployee }) => {
  return (
    <Modal
      title={null}
      open={isModalOpen}
      onCancel={handleCancel}
      footer={null}
      centered
      width={500}
    >
      <div style={{ textAlign: "center", padding: "20px" }}>
        <Avatar
          size={100}
          style={{ backgroundColor: "#1677ff", marginBottom: 15 }}
        >
          {selectedEmployee?.name?.charAt(0).toUpperCase() || (
            <UserOutlined />
          )}
        </Avatar>
        <Typography.Title level={4} style={{ marginBottom: 0 }}>
          {selectedEmployee?.name || "Unknown User"}
        </Typography.Title>
        <Typography.Text type="secondary">
          @{selectedEmployee?.username || "unknown"}
        </Typography.Text>
        <Divider />
        
        <Divider />
        <Button type="primary" block onClick={handleCancel}>
          Close
        </Button>
      </div>
    </Modal>
  );
};
export default ProfileModal;
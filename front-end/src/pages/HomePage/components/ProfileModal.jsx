import { Modal, Avatar, Typography, Divider, Space, Button } from "antd";
import {
  UserOutlined,
  IdcardOutlined,
  ClockCircleOutlined,
  MailOutlined,
} from "@ant-design/icons";

const ProfileModal = ({ open, onClose, user }) => {
  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={500}
    >
      <div style={{ textAlign: "center", padding: "20px" }}>
        <Avatar
          size={100}
          src={user?.avatarUrl || undefined}
          style={{ backgroundColor: "#1677ff", marginBottom: 15 }}
          onError={(e) => {
            try { e.currentTarget.src = ''; } catch(_) {}
            return false;
          }}
        >
          {!user?.avatarUrl && (user?.name?.charAt(0).toUpperCase() || <UserOutlined />)}
        </Avatar>
        <Typography.Title level={4} style={{ marginBottom: 0 }}>
          {user?.name || "Unknown User"}
        </Typography.Title>
        <Typography.Text type="secondary">
          @{user?.username || "unknown"}
        </Typography.Text>
        <Divider />
        <Space
          direction="vertical"
          style={{ width: "100%", textAlign: "left", marginTop: 10 }}
        >
          <Typography.Text>
            <IdcardOutlined style={{ marginRight: 8, color: "#1677ff" }} />
            Role: {user?.role || "Employee"}
          </Typography.Text>
          <Typography.Text>
            <ClockCircleOutlined style={{ marginRight: 8, color: "#1677ff" }} />
            Joined:{" "}
            {user?.createdAt ? new Date(user.createdAt).toDateString() : "N/A"}
          </Typography.Text>
          <Typography.Text>
            <MailOutlined style={{ marginRight: 8, color: "#1677ff" }} />
            Email: {user?.email || "Not Provided"}
          </Typography.Text>
        </Space>
        <Divider />
        <Button type="primary" block onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
};

export default ProfileModal;

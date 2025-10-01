import { Modal, Typography, Divider, Space, Input, Button, message } from "antd";
import { BulbOutlined } from "@ant-design/icons";
import { useState } from "react";
import axiosInstance from "../../../api/axiosInstance";

const FeatureModal = ({ open, onClose, user }) => {
  const [featureTitle, setFeatureTitle] = useState("");
  const [featureDescription, setFeatureDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!featureTitle || !featureDescription) {
      message.warning("Please fill in all fields before submitting.");
      return;
    }
    try {
      setLoading(true);
      await axiosInstance.post("/features/suggest", {
        title: featureTitle,
        description: featureDescription,
        emailTo: "embrhrpms@gmail.com",
        submittedBy: user?.username || "unknown",
      });
      message.success("Your suggestion has been sent!");
      setFeatureTitle("");
      setFeatureDescription("");
      onClose();
    } catch (error) {
      console.error("Feature suggestion failed:", error);
      message.error("Failed to send suggestion. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={500}
    >
      <div style={{ padding: "20px" }}>
        <Typography.Title
          level={4}
          style={{ textAlign: "center", marginBottom: 10 }}
        >
          <BulbOutlined style={{ marginRight: 8, color: "#faad14" }} />
          Suggest a Feature
        </Typography.Title>
        <Typography.Paragraph style={{ textAlign: "center" }}>
          Have an idea to improve the system? Share it with us!
        </Typography.Paragraph>
        <Divider />
        <Space direction="vertical" style={{ width: "100%" }}>
          <Input
            placeholder="Feature Title"
            value={featureTitle}
            onChange={(e) => setFeatureTitle(e.target.value)}
          />
          <Input.TextArea
            placeholder="Describe your feature suggestion..."
            autoSize={{ minRows: 4, maxRows: 6 }}
            value={featureDescription}
            onChange={(e) => setFeatureDescription(e.target.value)}
          />
        </Space>
        <Divider />
        <Space
          style={{
            display: "flex",
            justifyContent: "flex-end",
            width: "100%",
          }}
        >
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={loading} onClick={handleSubmit}>
            Submit
          </Button>
        </Space>
      </div>
    </Modal>
  );
};

export default FeatureModal;

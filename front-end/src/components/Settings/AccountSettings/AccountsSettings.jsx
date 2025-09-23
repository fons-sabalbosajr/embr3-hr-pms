import React, { useState, useEffect } from "react";
import {
  Form,
  Input,
  Button,
  Card,
  Row,
  Col,
  Switch,
  notification,
  Spin,
  Typography,
  Divider,
} from "antd";
import axiosInstance from "../../../api/axiosInstance";
import { secureGet, secureStore } from "../../../../utils/secureStorage";

// A placeholder for a hook to get current user from context/storage
// You would replace this with your actual auth context
const useAuth = () => {
  // Placeholder logic
  const [user, setUser] = useState(null);
  useEffect(() => {
    // In a real app, you'd get this from a context or secure storage
    const storedUser = secureGet("user");
    setUser(storedUser);
  }, []);
  return { user };
};

const { Title } = Typography;

const AccountsSettings = () => {
  const [loading, setLoading] = useState(false);
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const { user } = useAuth(); // Get the current user

  // States for preferences
  const [showSalary, setShowSalary] = useState(true);
  const [canManipulate, setCanManipulate] = useState(false);

  useEffect(() => {
    if (user) {
      profileForm.setFieldsValue({ name: user.name, username: user.username });
      // Fetch full user data for preferences
      const fetchUserPreferences = async () => {
        try {
          const response = await axiosInstance.get(`/users/${user._id}`); 
          setShowSalary(response.data.showSalaryAmounts);
          setCanManipulate(response.data.canManipulateBiometrics);
        } catch (error) {
            console.error("Failed to fetch user preferences:", error);
            // Fallback to default values if fetching fails
            setShowSalary(true);
            setCanManipulate(false);
        }
      };
      fetchUserPreferences();
    }
  }, [user, profileForm]);

  const handleProfileUpdate = async (values) => {
    setLoading(true);
    try {
      await axiosInstance.put("/users/profile", values);
      notification.success({ message: "Profile updated successfully!" });
      // You might want to update the user in your auth context here
    } catch (error) {
      notification.error({ message: error.response?.data?.message || "Failed to update profile." });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (values) => {
    if (values.newPassword !== values.confirmPassword) {
      notification.error({ message: "New passwords do not match!" });
      return;
    }
    setLoading(true);
    try {
      await axiosInstance.put("/users/change-password", {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });
      notification.success({ message: "Password changed successfully!" });
      passwordForm.resetFields();
    } catch (error) {
      notification.error({ message: error.response?.data?.message || "Failed to change password." });
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceChange = async (preference, value) => {
    //console.log(`Attempting to change preference: ${preference} to ${value}`);
    setLoading(true);
    try {
      await axiosInstance.put("/users/preferences", { [preference]: value });
      notification.success({ message: "Preference updated!" });

      // Update the user object in secure storage
      const updatedUser = { ...user, [preference]: value };
      secureStore("user", updatedUser);
      //console.log("User object updated in secureStorage:", updatedUser);

      if (preference === 'showSalaryAmounts') setShowSalary(value);
      if (preference === 'canManipulateBiometrics') setCanManipulate(value);
    } catch (error) {
      console.error("Error updating preference:", error);
      notification.error({ message: error.response?.data?.message || "Failed to update preference." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]}>
        {/* Profile Information Card */}
        <Col xs={24} md={12}>
          <Card title="Profile Information">
            <Form form={profileForm} layout="vertical" onFinish={handleProfileUpdate}>
              <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="username" label="Username" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">
                  Update Profile
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* Change Password Card */}
        <Col xs={24} md={12}>
          <Card title="Change Password">
            <Form form={passwordForm} layout="vertical" onFinish={handlePasswordChange}>
              <Form.Item name="oldPassword" label="Old Password" rules={[{ required: true }]}>
                <Input.Password />
              </Form.Item>
              <Form.Item name="newPassword" label="New Password" rules={[{ required: true }]}>
                <Input.Password />
              </Form.Item>
              <Form.Item name="confirmPassword" label="Confirm New Password" rules={[{ required: true }]}>
                <Input.Password />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">
                  Change Password
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* Preferences Card */}
        <Col xs={24} md={24}>
            <Card title="Preferences">
                 <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
                    <Col>
                        <Title level={5}>Salary Visibility</Title>
                        <Typography.Text type="secondary">Show literal salary amounts or hide them with asterisks (*).</Typography.Text>
                    </Col>
                    <Col>
                        <Switch checked={showSalary} onChange={(checked) => handlePreferenceChange('showSalaryAmounts', checked)} />
                    </Col>
                </Row>
                <Divider />
                 <Row align="middle" justify="space-between">
                    <Col>
                        <Title level={5}>Biometrics Time Manipulation</Title>
                        <Typography.Text type="secondary">Allow time to be manually adjusted when uploading biometrics data. (Requires admin approval)</Typography.Text>
                    </Col>
                    <Col>
                        <Switch checked={canManipulate} onChange={(checked) => handlePreferenceChange('canManipulateBiometrics', checked)} />
                    </Col>
                </Row>
            </Card>
        </Col>
      </Row>
    </Spin>
  );
};

export default AccountsSettings;
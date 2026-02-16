import React, { useState, useEffect } from "react";
import {
  Form,
  Input,
  Button,
  Card,
  Row,
  Col,
  Radio,
  Segmented,
  Space,
  Spin,
  Typography,
  Modal,
  Upload,
  Slider,
} from "antd";
import axiosInstance from "../../../api/axiosInstance";
import { useTheme } from "../../../context/ThemeContext";
import "./accountsettings.css";
import useAuth from "../../../hooks/useAuth";
import useDemoMode from "../../../hooks/useDemoMode";
import { UploadOutlined, UserOutlined, ZoomInOutlined, ZoomOutOutlined } from "@ant-design/icons";
import UserAvatar from "../../common/UserAvatar";
import Cropper from 'react-easy-crop';
import { swalSuccess, swalError, swalInfo } from "../../../utils/swalHelper";

const { Title } = Typography;

const AccountsSettings = () => {
  const [loading, setLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [pendingNewPassword, setPendingNewPassword] = useState("");
  const [confirmToken, setConfirmToken] = useState("");
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const { user, updateCurrentUser } = useAuth();
  const { isDemoActive, isDemoUser } = useDemoMode();
  const { theme, setTheme, appSettings, userPrimaryPreset, setUserPrimaryPreset, applyPresetToChrome, setApplyPresetToChrome } = useTheme();

  useEffect(() => {
    if (user) {
      profileForm.setFieldsValue({ name: user.name, username: user.username });
    }
  }, [user, profileForm, setTheme]);

  const handleProfileUpdate = async (values) => {
    setLoading(true);
    try {
      // Back end mounts auth routes at /api/users; both /profile and /users/profile are available
      const res = await axiosInstance.put("/users/profile", values);
      updateCurrentUser({ ...user, ...res.data });
      swalSuccess("Profile updated successfully!");
    } catch (error) {
      swalError(error.response?.data?.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (values) => {
    if (values.newPassword !== values.confirmPassword) {
      swalError("New passwords do not match!");
      return;
    }
    // Step 1: request email verification
    setLoading(true);
    try {
      await axiosInstance.post("/users/request-password-change", {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });
      setPendingNewPassword(values.newPassword);
      setPwdModalOpen(true);
      swalInfo("Verification email sent. Please check your inbox.");
    } catch (error) {
      swalError(error.response?.data?.message || "Failed to start password change.");
    } finally {
      setLoading(false);
    }
  };

  const submitPasswordConfirm = async () => {
    if (!confirmToken) {
      swalError("Please paste the verification token from your email.");
      return;
    }
    setLoading(true);
    try {
      await axiosInstance.post("/users/confirm-password-change", {
        token: confirmToken,
        newPassword: pendingNewPassword,
      });
      swalSuccess("Password changed successfully!");
      setPwdModalOpen(false);
      setConfirmToken("");
      setPendingNewPassword("");
      passwordForm.resetFields();
    } catch (error) {
      swalError(error.response?.data?.message || "Failed to change password.");
    } finally {
      setLoading(false);
    }
  };

  const beforeUpload = (file) => {
    const isImage = file.type.startsWith("image/");
    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isImage) swalError("You can only upload image files");
    if (!isLt5M) swalError("Image must be smaller than 5MB");
    if (!(isImage && isLt5M)) return Upload.LIST_IGNORE;
    // Open cropper
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    return false; // prevent auto upload
  };

  const getCroppedBlob = (image, cropPixels) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_AVATAR = 512;
      const rawSize = Math.max(cropPixels.width, cropPixels.height);
      const size = Math.min(rawSize, MAX_AVATAR);
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(
        img,
        cropPixels.x,
        cropPixels.y,
        cropPixels.width,
        cropPixels.height,
        0,
        0,
        size,
        size
      );
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Canvas is empty'));
        resolve(blob);
      }, 'image/jpeg', 0.85);
    };
    img.onerror = reject;
    img.src = image;
  });

  const onCropComplete = (_, croppedPixels) => setCroppedAreaPixels(croppedPixels);

  const uploadCropped = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setAvatarUploading(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      const formData = new FormData();
      formData.append('avatar', new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
      const res = await axiosInstance.post('/users/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const avatarUrl = res.data?.avatarUrl;
      if (avatarUrl) {
        // Skip cache-busting for data: URLs (base64) – they are unique by content
        const finalUrl = avatarUrl.startsWith('data:') ? avatarUrl : `${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;
        updateCurrentUser({ ...user, avatarUrl: finalUrl });
        swalSuccess('Avatar updated.');
      }
      setCropModalOpen(false);
      setImageSrc(null);
    } catch (e) {
      swalError(e.response?.data?.message || 'Failed to upload avatar.');
    } finally {
      setAvatarUploading(false);
    }
  };

  // Theme presets (fixed, no custom pickers)
  const colorPresets = [
    { key: 'default', label: 'Default' },
    { key: 'blue', label: 'Blue' },
    { key: 'green', label: 'Green' },
    { key: 'purple', label: 'Purple' },
    { key: 'yellow', label: 'Yellow' },
    { key: 'red', label: 'Red' },
    { key: 'orange', label: 'Orange' },
    { key: 'cyan', label: 'Cyan' },
    { key: 'magenta', label: 'Magenta' },
    { key: 'geekblue', label: 'Geek Blue' },
    { key: 'gold', label: 'Gold' },
    { key: 'lime', label: 'Lime' },
  ];

  const presetColorMap = {
    default: undefined,
    blue: '#1677ff',
    green: '#52c41a',
    purple: '#722ed1',
    yellow: '#fadb14',
    red: '#ff4d4f',
    orange: '#fa8c16',
    cyan: '#13c2c2',
    magenta: '#eb2f96',
    geekblue: '#2f54eb',
    gold: '#faad14',
    lime: '#a0d911',
  };

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]}>
        {/* Profile Information Card */}
        <Col xs={24} md={isDemoActive && isDemoUser ? 24 : 12}>
          <Card title="Profile Information" className="account-settings-panel corp-panel compact-table">
            <Space align="start" size={16} style={{ width: '100%', marginBottom: 8 }}>
              <UserAvatar
                size={64}
                src={user?.avatarUrl}
                name={user?.name}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  if (user?.avatarUrl) {
                    updateCurrentUser({ ...user, avatarUrl: `${user.avatarUrl.split('?')[0]}?v=${Date.now()}` });
                  }
                }}
              />
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={beforeUpload}
                disabled={avatarUploading || (isDemoActive && isDemoUser)}
              >
                <Button size="small" icon={<UploadOutlined />} loading={avatarUploading} disabled={isDemoActive && isDemoUser}>
                  Change Avatar
                </Button>
              </Upload>
            </Space>
            <Form form={profileForm} layout="vertical" size="small" onFinish={handleProfileUpdate}>
              <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="username" label="Username" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" size="small" disabled={isDemoActive && isDemoUser}>
                  Update Profile
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* Change Password Card (hidden in demo mode) */}
        {!(isDemoActive && isDemoUser) && (
          <Col xs={24} md={12}>
            <Card title="Change Password" className="account-settings-panel corp-panel compact-table">
              <Form form={passwordForm} layout="vertical" size="small" onFinish={handlePasswordChange}>
                <Form.Item name="oldPassword" label="Old Password" rules={[{ required: true }]}>
                  <Input.Password />
                </Form.Item>
                <Form.Item name="newPassword" label="New Password" rules={[
                  { required: true },
                  { min: appSettings?.security?.passwordMinLength || 8, message: `Password must be at least ${appSettings?.security?.passwordMinLength || 8} characters` },
                  ...(appSettings?.security?.passwordRequiresNumber !== false ? [{ pattern: /\d/, message: "Password must contain at least one number" }] : []),
                  ...(appSettings?.security?.passwordRequiresSymbol !== false ? [{ pattern: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/, message: "Password must contain at least one special character" }] : []),
                ]}>
                  <Input.Password />
                </Form.Item>
                <Form.Item name="confirmPassword" label="Confirm New Password" rules={[{ required: true }]}>
                  <Input.Password />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" size="small">
                    Change Password
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          </Col>
        )}

        {/* Theme Preferences (User-level, fixed presets) */}
        <Col xs={24}>
          <Card title="Theme Preferences" className="theme-preferences-card account-settings-panel corp-panel compact-table">
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Form layout="vertical" size="small">
                  <Form.Item label="Mode">
                    <Segmented
                      block
                      options={[
                        { label: 'Light', value: 'light' },
                        { label: 'Dark', value: 'dark' },
                      ]}
                      value={theme}
                      onChange={(val) => setTheme(val)}
                    />
                  </Form.Item>
                  <Form.Item label="Primary color preset">
                    <Radio.Group
                      value={userPrimaryPreset}
                      onChange={(e) => setUserPrimaryPreset(e.target.value)}
                      className="preset-grid"
                    >
                      {colorPresets.map((p) => {
                        const color = presetColorMap[p.key];
                        return (
                          <Radio key={p.key} value={p.key} className="preset-item">
                            <div
                              className="preset-swatch"
                              style={{
                                background: color || 'transparent',
                                borderColor: color ? 'transparent' : 'var(--app-menu-item-color, #999)'
                              }}
                              aria-label={`Preset ${p.label}`}
                            />
                            <div className="preset-label">{p.label}</div>
                          </Radio>
                        );
                      })}
                    </Radio.Group>
                  </Form.Item>
                  <Form.Item>
                    <Radio.Group
                      value={applyPresetToChrome ? 'on' : 'off'}
                      onChange={(e) => setApplyPresetToChrome(e.target.value === 'on')}
                    >
                      <Radio value="off">Apply to content only</Radio>
                      <Radio value="on">Also apply to Header & Sider</Radio>
                    </Radio.Group>
                  </Form.Item>
                </Form>
              </Col>
              <Col xs={24} md={12}>
                <Card size="small" title="Preview" className="theme-preview-card corp-panel compact-table">
                  <Space direction="vertical">
                    <Space>
                      <Button type="primary" size="small">Primary</Button>
                      <Button type="default" size="small">Default</Button>
                      <Button type="dashed" size="small">Dashed</Button>
                    </Space>
                    <Space>
                      <a>Link</a>
                      <Button type="link" size="small">Link Button</Button>
                    </Space>
                  </Space>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Modal
        title="Confirm Password Change"
        open={pwdModalOpen}
        onOk={submitPasswordConfirm}
        onCancel={() => setPwdModalOpen(false)}
        okText="Confirm"
        cancelText="Cancel"
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          We sent a verification link to your email. Paste the token from the URL here to confirm.
        </Typography.Paragraph>
        <Input
          placeholder="Paste verification token"
          value={confirmToken}
          onChange={(e) => setConfirmToken(e.target.value)}
        />
      </Modal>

      <Modal
        title="Crop Avatar"
        open={cropModalOpen}
        onOk={uploadCropped}
        okButtonProps={{ loading: avatarUploading }}
        onCancel={() => setCropModalOpen(false)}
        width={560}
      >
        <div style={{ position: 'relative', width: '100%', height: 320, background: '#000', borderRadius: 4, overflow: 'hidden' }}>
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              showGrid={false}
              minZoom={0.5}
              maxZoom={3}
              zoomSpeed={0.1}
              zoomWithScroll={true}
              restrictPosition={true}
            />
          )}
        </div>
        <div style={{ marginTop: 12 }}>
          <Space align="center" style={{ width: '100%' }}>
            <Button
              size="small"
              icon={<ZoomOutOutlined />}
              onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
              disabled={zoom <= 0.5}
            />
            <div style={{ flex: 1, paddingLeft: 8, paddingRight: 8 }}>
              <Slider
                min={0.5}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(val) => setZoom(Array.isArray(val) ? val[0] : val)}
                tooltip={{ open: false }}
              />
            </div>
            <Button
              size="small"
              icon={<ZoomInOutlined />}
              onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}
              disabled={zoom >= 3}
            />
            <span style={{ minWidth: 48, textAlign: 'right', fontSize: 12 }}>{(zoom * 100).toFixed(0)}%</span>
          </Space>
        </div>
      </Modal>
    </Spin>
  );
};

export default AccountsSettings;

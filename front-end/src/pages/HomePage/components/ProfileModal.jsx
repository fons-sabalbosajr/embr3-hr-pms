import React, { useState, useRef, useCallback } from "react";
import { Modal, Typography, Divider, Space, Button, Slider, notification } from "antd";
import {
  UserOutlined,
  IdcardOutlined,
  ClockCircleOutlined,
  MailOutlined,
  CameraOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons";
import Cropper from "react-easy-crop";
import UserAvatar from "../../../components/common/UserAvatar";
import axiosInstance from "../../../api/axiosInstance";
import useAuth from "../../../hooks/useAuth";

const ProfileModal = ({ open, onClose, user }) => {
  const { updateCurrentUser } = useAuth();
  const fileInputRef = useRef(null);

  // Crop state
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [uploading, setUploading] = useState(false);

  const onCropComplete = useCallback((_, croppedPixels) => setCroppedAreaPixels(croppedPixels), []);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isImage) { notification.error({ message: "Only image files are allowed." }); return; }
    if (!isLt10M) { notification.error({ message: "Image must be smaller than 10 MB." }); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  };

  const getCroppedBlob = (image, cropPixels) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_AVATAR = 512;
        const rawSize = Math.max(cropPixels.width, cropPixels.height);
        const size = Math.min(rawSize, MAX_AVATAR);
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, cropPixels.x, cropPixels.y, cropPixels.width, cropPixels.height, 0, 0, size, size);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Canvas is empty"))),
          "image/jpeg",
          0.85
        );
      };
      img.onerror = reject;
      img.src = image;
    });

  const uploadCropped = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setUploading(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      const formData = new FormData();
      formData.append("avatar", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      const res = await axiosInstance.post("/users/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const avatarUrl = res.data?.avatarUrl;
      if (avatarUrl) {
        // Skip cache-busting for data: URLs (base64) – they are unique by content
        const finalUrl = avatarUrl.startsWith('data:') ? avatarUrl : `${avatarUrl}${avatarUrl.includes("?") ? "&" : "?"}v=${Date.now()}`;
        updateCurrentUser({ ...user, avatarUrl: finalUrl });
        notification.success({ message: "Profile photo updated!" });
      }
      setCropModalOpen(false);
      setImageSrc(null);
    } catch (e) {
      notification.error({ message: e.response?.data?.message || "Failed to upload photo." });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Modal
        title={null}
        open={open}
        onCancel={onClose}
        footer={null}
        centered
        width={500}
      >
        <div style={{ textAlign: "center", padding: "20px" }}>
          {/* Clickable avatar with camera overlay */}
          <div
            style={{ position: "relative", display: "inline-block", cursor: "pointer" }}
            onClick={() => fileInputRef.current?.click()}
            title="Change profile photo"
          >
            <UserAvatar
              size={100}
              src={user?.avatarUrl}
              name={user?.name}
              style={{ backgroundColor: "#1677ff", marginBottom: 0 }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "#1677ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #fff",
                boxShadow: "0 2px 6px rgba(0,0,0,.2)",
              }}
            >
              <CameraOutlined style={{ color: "#fff", fontSize: 14 }} />
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />

          <div style={{ marginTop: 15 }}>
            <Typography.Title level={4} style={{ marginBottom: 0 }}>
              {user?.name || "Unknown User"}
            </Typography.Title>
            <Typography.Text type="secondary">
              @{user?.username || "unknown"}
            </Typography.Text>
          </div>
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

      {/* Crop Modal */}
      <Modal
        title="Crop Profile Photo"
        open={cropModalOpen}
        onOk={uploadCropped}
        okText="Upload"
        okButtonProps={{ loading: uploading }}
        onCancel={() => { setCropModalOpen(false); setImageSrc(null); }}
        width={560}
        centered
        zIndex={1100}
      >
        <div style={{ position: "relative", width: "100%", height: 320, background: "#000", borderRadius: 4, overflow: "hidden" }}>
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
              zoomWithScroll
              restrictPosition
            />
          )}
        </div>
        <div style={{ marginTop: 12 }}>
          <Space align="center" style={{ width: "100%" }}>
            <Button size="small" icon={<ZoomOutOutlined />} onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} disabled={zoom <= 0.5} />
            <div style={{ flex: 1, paddingLeft: 8, paddingRight: 8 }}>
              <Slider min={0.5} max={3} step={0.01} value={zoom} onChange={(val) => setZoom(Array.isArray(val) ? val[0] : val)} tooltip={{ open: false }} />
            </div>
            <Button size="small" icon={<ZoomInOutlined />} onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))} disabled={zoom >= 3} />
            <span style={{ minWidth: 48, textAlign: "right", fontSize: 12 }}>{(zoom * 100).toFixed(0)}%</span>
          </Space>
        </div>
      </Modal>
    </>
  );
};

export default ProfileModal;

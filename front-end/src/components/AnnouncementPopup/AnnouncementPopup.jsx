import React, { useEffect, useState, useCallback } from "react";
import { Modal, Typography, Tag, Space, Button, Badge } from "antd";
import {
  BellOutlined,
  RocketOutlined,
  ToolOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  RightOutlined,
} from "@ant-design/icons";
import axiosInstance from "../../api/axiosInstance";
import useAuth from "../../hooks/useAuth";

const { Title, Paragraph } = Typography;

const TYPE_META = {
  announcement: { icon: <BellOutlined />, color: "#1890ff", label: "Announcement" },
  "app-update": { icon: <RocketOutlined />, color: "#52c41a", label: "App Update" },
  maintenance: { icon: <ToolOutlined />, color: "#fa8c16", label: "Maintenance Notice" },
  general: { icon: <InfoCircleOutlined />, color: "#8c8c8c", label: "General" },
};

const PRIORITY_BADGE = {
  critical: "error",
  high: "warning",
  normal: "processing",
  low: "default",
};

/**
 * AnnouncementPopup
 * Fetches active announcements and shows them in a modal one-by-one.
 * Dismissed announcements are tracked server-side so they don't reappear after refresh.
 */
const AnnouncementPopup = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  const userId = user?._id || user?.id || user?.email;

  const fetchAndFilter = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await axiosInstance.get("/announcements/active");
      const all = res.data?.data || [];

      // Filter to only show pop-ups not yet dismissed by this user
      const undismissed = all.filter(
        (a) => a.showPopup && !(a.dismissedBy || []).includes(userId)
      );

      // Sort: critical first, then by createdAt desc
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      undismissed.sort((a, b) => {
        const pa = priorityOrder[a.priority] ?? 99;
        const pb = priorityOrder[b.priority] ?? 99;
        if (pa !== pb) return pa - pb;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      setAnnouncements(undismissed);
      setCurrentIndex(0);
      if (undismissed.length > 0) setVisible(true);
    } catch (err) {
      // silently fail — pop-up is non-critical
      console.error("[AnnouncementPopup] fetch error:", err);
    }
  }, [userId]);

  useEffect(() => {
    // Small delay to avoid blocking initial page render
    const timer = setTimeout(fetchAndFilter, 1500);
    return () => clearTimeout(timer);
  }, [fetchAndFilter]);

  const current = announcements[currentIndex];

  const dismiss = async () => {
    if (!current) return;
    try {
      await axiosInstance.put(`/announcements/${current._id}/dismiss`);
    } catch {}

    const remaining = announcements.filter((_, i) => i !== currentIndex);
    setAnnouncements(remaining);
    if (remaining.length === 0) {
      setVisible(false);
    } else {
      setCurrentIndex((prev) => Math.min(prev, remaining.length - 1));
    }
  };

  const dismissAll = async () => {
    // Fire-and-forget dismiss calls
    for (const a of announcements) {
      try {
        await axiosInstance.put(`/announcements/${a._id}/dismiss`);
      } catch {}
    }
    setAnnouncements([]);
    setVisible(false);
  };

  if (!current || !visible) return null;

  const meta = TYPE_META[current.type] || TYPE_META.general;
  const total = announcements.length;

  return (
    <Modal
      open={visible}
      onCancel={dismiss}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            {total > 1 && (
              <Space size="small">
                <Button
                  size="small"
                  icon={<LeftOutlined />}
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((i) => i - 1)}
                />
                <span style={{ fontSize: 12, color: "#888" }}>
                  {currentIndex + 1} of {total}
                </span>
                <Button
                  size="small"
                  icon={<RightOutlined />}
                  disabled={currentIndex === total - 1}
                  onClick={() => setCurrentIndex((i) => i + 1)}
                />
              </Space>
            )}
          </div>
          <Space>
            {total > 1 && (
              <Button size="small" onClick={dismissAll}>
                Dismiss All
              </Button>
            )}
            <Button type="primary" onClick={dismiss}>
              Got It
            </Button>
          </Space>
        </div>
      }
      width={520}
      centered
      closable
      styles={{
        header: { background: meta.color, borderRadius: "8px 8px 0 0" },
      }}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: meta.color, fontSize: 20 }}>{meta.icon}</span>
          <span>{meta.label}</span>
          {current.priority && current.priority !== "normal" && (
            <Badge status={PRIORITY_BADGE[current.priority]} text={current.priority.toUpperCase()} />
          )}
        </div>
      }
    >
      <Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>
        {current.title}
      </Title>
      <Paragraph
        style={{
          whiteSpace: "pre-wrap",
          fontSize: 14,
          lineHeight: 1.7,
          maxHeight: 340,
          overflowY: "auto",
        }}
      >
        {current.body}
      </Paragraph>
      <div style={{ marginTop: 12, color: "#999", fontSize: 12 }}>
        {current.createdBy && <span>Posted by {current.createdBy} &bull; </span>}
        {new Date(current.createdAt).toLocaleDateString("en-PH", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </div>
    </Modal>
  );
};

export default AnnouncementPopup;

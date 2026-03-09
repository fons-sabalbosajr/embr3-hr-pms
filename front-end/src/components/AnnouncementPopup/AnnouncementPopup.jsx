import React, { useEffect, useState, useCallback } from "react";
import { Modal, Typography, Tag, Space, Button, Badge, Divider } from "antd";
import {
  BellOutlined,
  RocketOutlined,
  ToolOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  RightOutlined,
  CalendarOutlined,
  UserOutlined,
} from "@ant-design/icons";
import axiosInstance from "../../api/axiosInstance";
import useAuth from "../../hooks/useAuth";
import "./AnnouncementPopup.css";

const { Title, Paragraph } = Typography;

const TYPE_META = {
  announcement: { icon: <BellOutlined />, color: "#1890ff", bg: "linear-gradient(135deg, #1890ff 0%, #096dd9 100%)", label: "Announcement", tagColor: "blue" },
  "app-update": { icon: <RocketOutlined />, color: "#52c41a", bg: "linear-gradient(135deg, #52c41a 0%, #389e0d 100%)", label: "App Update", tagColor: "green" },
  maintenance: { icon: <ToolOutlined />, color: "#fa8c16", bg: "linear-gradient(135deg, #fa8c16 0%, #d48806 100%)", label: "Maintenance Notice", tagColor: "orange" },
  general: { icon: <InfoCircleOutlined />, color: "#8c8c8c", bg: "linear-gradient(135deg, #8c8c8c 0%, #595959 100%)", label: "General", tagColor: "default" },
};

const PRIORITY_LABEL = {
  critical: { color: "#ff4d4f", text: "CRITICAL" },
  high: { color: "#fa8c16", text: "HIGH PRIORITY" },
  normal: null,
  low: null,
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
  const priorityInfo = PRIORITY_LABEL[current.priority];
  const formattedDate = new Date(current.createdAt).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const isHtml = /<[a-z][\s\S]*>/i.test(current.body || "");

  return (
    <Modal
      open={visible}
      onCancel={dismiss}
      footer={null}
      width={560}
      centered
      closable={false}
      styles={{
        content: { padding: 0, borderRadius: 12, overflow: "hidden" },
        body: { padding: 0 },
      }}
    >
      {/* ── Gradient Header Banner ── */}
      <div
        style={{
          background: meta.bg,
          padding: "28px 32px 20px",
          position: "relative",
        }}
      >
        {/* Close button */}
        <button
          onClick={dismiss}
          aria-label="Close"
          style={{
            position: "absolute", top: 12, right: 16,
            background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%",
            width: 28, height: 28, cursor: "pointer", color: "#fff", fontSize: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.35)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
        >
          ✕
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div
            style={{
              background: "rgba(255,255,255,0.2)", borderRadius: 10,
              width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, color: "#fff",
            }}
          >
            {meta.icon}
          </div>
          <div>
            <Tag
              color={meta.tagColor}
              style={{ marginBottom: 0, fontWeight: 600, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" }}
            >
              {meta.label}
            </Tag>
            {priorityInfo && (
              <Tag
                style={{
                  marginBottom: 0, fontWeight: 700, fontSize: 10, letterSpacing: 0.5,
                  background: priorityInfo.color, color: "#fff", border: "none",
                }}
              >
                {priorityInfo.text}
              </Tag>
            )}
          </div>
        </div>

        <Title level={4} style={{ color: "#fff", margin: 0, fontWeight: 700, lineHeight: 1.3 }}>
          {current.title}
        </Title>
      </div>

      {/* ── Body Content ── */}
      <div style={{ padding: "20px 32px 8px" }}>
        {isHtml ? (
          <div
            className="announcement-html-body"
            dangerouslySetInnerHTML={{ __html: current.body }}
          />
        ) : (
          <Paragraph
            style={{
              whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.8,
              color: "#333", maxHeight: 300, overflowY: "auto", marginBottom: 0,
            }}
          >
            {current.body}
          </Paragraph>
        )}
      </div>

      {/* ── Meta & Footer ── */}
      <div style={{ padding: "0 32px 20px" }}>
        <Divider style={{ margin: "16px 0 12px" }} />
        <div
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            flexWrap: "wrap", gap: 8,
          }}
        >
          <div style={{ color: "#999", fontSize: 12, display: "flex", alignItems: "center", gap: 12 }}>
            {current.createdBy && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <UserOutlined style={{ fontSize: 11 }} /> {current.createdBy}
              </span>
            )}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <CalendarOutlined style={{ fontSize: 11 }} /> {formattedDate}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {total > 1 && (
              <Space size={4}>
                <Button
                  size="small" type="text"
                  icon={<LeftOutlined />}
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((i) => i - 1)}
                />
                <span style={{ fontSize: 12, color: "#999", minWidth: 40, textAlign: "center" }}>
                  {currentIndex + 1} / {total}
                </span>
                <Button
                  size="small" type="text"
                  icon={<RightOutlined />}
                  disabled={currentIndex === total - 1}
                  onClick={() => setCurrentIndex((i) => i + 1)}
                />
              </Space>
            )}
            {total > 1 && (
              <Button size="small" onClick={dismissAll}>
                Dismiss All
              </Button>
            )}
            <Button
              type="primary" onClick={dismiss}
              style={{ background: meta.color, borderColor: meta.color, fontWeight: 600 }}
            >
              Got It
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AnnouncementPopup;

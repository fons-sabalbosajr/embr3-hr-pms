// src/components/GlobalLoadingOverlay.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Full-screen overlay shown while any global loading task is active.
// Displays the task label and an optional progress percentage.
//
// Uses Ant Design <Spin> + <Progress> for a consistent look.
// ─────────────────────────────────────────────────────────────────────────────
import React from "react";
import { Spin, Progress } from "antd";
import useLoading from "../hooks/useLoading";

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0, 0, 0, 0.35)",
  backdropFilter: "blur(2px)",
  transition: "opacity 0.25s ease",
};

const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: "32px 48px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 16,
  minWidth: 260,
  maxWidth: 400,
};

const labelStyle = {
  fontSize: 15,
  fontWeight: 500,
  color: "#333",
  textAlign: "center",
  wordBreak: "break-word",
};

const GlobalLoadingOverlay = () => {
  const { isLoading, activeTask } = useLoading();

  if (!isLoading) return null;

  const { label, progress } = activeTask || {};
  const hasProgress = typeof progress === "number";

  return (
    <div style={overlayStyle} role="alert" aria-busy="true">
      <div style={cardStyle}>
        <Spin size="large" />

        {label && <div style={labelStyle}>{label}</div>}

        {hasProgress && (
          <Progress
            percent={Math.round(progress)}
            status="active"
            strokeColor={{ from: "#1677ff", to: "#52c41a" }}
            style={{ width: "100%" }}
          />
        )}
      </div>
    </div>
  );
};

export default GlobalLoadingOverlay;

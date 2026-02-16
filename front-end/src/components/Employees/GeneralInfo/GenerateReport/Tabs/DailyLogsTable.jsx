import React from "react";
import useDemoMode from "../../../../../hooks/useDemoMode";
import { Table, Button, Tag, Divider, Typography, Tooltip } from "antd";
import { swalWarning } from "../../../../../utils/swalHelper";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const { Text } = Typography;

/** Color-coded tag for each resolved time slot */
const slotColors = {
  "Time In": "green",
  "Break Out": "orange",
  "Break In": "blue",
  "Time Out": "red",
};

const DailyLogsTable = ({ dailySummary, onSendReminder }) => {
  const { isDemoActive, isDemoUser, allowSubmissions, isPrivileged } = useDemoMode();
  const demoReadOnly = isDemoActive && isDemoUser && !allowSubmissions && !isPrivileged;
  if (!dailySummary) return null;

  const { rawLogs = [], timeIn, breakOut, breakIn, timeOut, date, isWfh, wfhAttachment } = dailySummary;

  // Default Break Out/In only when Time In + Time Out both exist
  const finalBreakOut = breakOut || (timeIn && timeOut ? "12:00 PM" : "");
  const finalBreakIn = breakIn || (timeIn && timeOut ? "1:00 PM" : "");

  const hasMissingTime = !timeIn || !timeOut;

  // ── Resolved Summary Row ──
  const summarySource = [
    {
      key: "resolved",
      date: date || (rawLogs[0]?.time ? dayjs(rawLogs[0].time).tz("Asia/Manila").format("YYYY-MM-DD") : "—"),
      timeIn: timeIn || null,
      breakOut: finalBreakOut || null,
      breakIn: finalBreakIn || null,
      timeOut: timeOut || null,
    },
  ];

  const summaryColumns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 130,
      render: (value) => {
        const d = dayjs(value).tz("Asia/Manila");
        return d.isValid() ? d.format("MMM D, YYYY (ddd)") : value;
      },
    },
    {
      title: "Time In",
      dataIndex: "timeIn",
      key: "timeIn",
      render: (value) => (
        <span style={{ color: value ? "inherit" : "#cf1322", fontWeight: value ? 600 : 400 }}>
          {value || "Missing"}
        </span>
      ),
    },
    {
      title: "Break Out",
      dataIndex: "breakOut",
      key: "breakOut",
      render: (value) => (
        <span style={{ color: value ? "inherit" : "#faad14" }}>
          {value || "—"}
        </span>
      ),
    },
    {
      title: "Break In",
      dataIndex: "breakIn",
      key: "breakIn",
      render: (value) => (
        <span style={{ color: value ? "inherit" : "#faad14" }}>
          {value || "—"}
        </span>
      ),
    },
    {
      title: "Time Out",
      dataIndex: "timeOut",
      key: "timeOut",
      render: (value) => (
        <span style={{ color: value ? "inherit" : "#cf1322", fontWeight: value ? 600 : 400 }}>
          {value || "Missing"}
        </span>
      ),
    },
  ];

  if (hasMissingTime) {
    summaryColumns.push({
      title: "Action",
      key: "action",
      width: 130,
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          disabled={demoReadOnly}
          onClick={() => {
            if (onSendReminder) {
              onSendReminder(record);
            } else {
              swalWarning("Under Maintenance: Reminder feature coming soon.");
            }
          }}
        >
          Send Reminder
        </Button>
      ),
    });
  }

  // ── Raw Biometric Punches — resolve which slot each punch maps to ──
  const resolveSlotLabel = (punchTime) => {
    if (!punchTime) return null;
    const t = dayjs(punchTime).tz("Asia/Manila");
    const formatted = t.format("h:mm A");
    if (timeIn === formatted) return "Time In";
    if (breakOut === formatted) return "Break Out";
    if (breakIn === formatted) return "Break In";
    if (timeOut === formatted) return "Time Out";
    return null;
  };

  const rawPunchData = rawLogs
    .slice()
    .sort((a, b) => new Date(a.time) - new Date(b.time))
    .map((log, idx) => {
      const t = dayjs(log.time).tz("Asia/Manila");
      const slot = resolveSlotLabel(log.time);
      return {
        key: idx,
        punchNo: idx + 1,
        rawTime: t.format("h:mm:ss A"),
        biometricState: log.state ?? "—",
        resolvedSlot: slot,
      };
    });

  const rawColumns = [
    { title: "#", dataIndex: "punchNo", key: "punchNo", width: 40 },
    { title: "Biometric Punch Time", dataIndex: "rawTime", key: "rawTime", width: 160 },
    {
      title: "Device State",
      dataIndex: "biometricState",
      key: "biometricState",
      width: 100,
      render: (v) => <Text type="secondary">{String(v)}</Text>,
    },
    {
      title: "Resolved As",
      dataIndex: "resolvedSlot",
      key: "resolvedSlot",
      render: (slot) =>
        slot ? (
          <Tag color={slotColors[slot] || "default"}>{slot}</Tag>
        ) : (
          <Tooltip title="This punch was not assigned to any time slot">
            <Tag>Unused</Tag>
          </Tooltip>
        ),
    },
  ];

  // ── Status summary ──
  const filledCount = [timeIn, finalBreakOut, finalBreakIn, timeOut].filter(Boolean).length;
  const statusColor = filledCount === 4 ? "#52c41a" : filledCount >= 2 ? "#faad14" : "#cf1322";
  const statusLabel = filledCount === 4 ? "Complete" : filledCount >= 2 ? "Partial" : "Incomplete";

  return (
    <div>
      {/* Status indicator */}
      <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Tag color={statusColor} style={{ fontSize: 12 }}>
          {statusLabel} ({filledCount}/4 slots)
        </Tag>
        {isWfh && (
          <Tag color="#096dd9" style={{ fontSize: 12 }}>
            🏠 Work From Home
          </Tag>
        )}
        <Text type="secondary" style={{ fontSize: 12 }}>
          {rawPunchData.length} biometric punch{rawPunchData.length !== 1 ? "es" : ""} recorded
        </Text>
        {isWfh && wfhAttachment && (
          <a href={wfhAttachment} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
            View WFH Attachment
          </a>
        )}
      </div>

      {/* Resolved Time Summary */}
      <Text strong style={{ fontSize: 13, display: "block", marginBottom: 4 }}>
        Resolved Time Record
      </Text>
      <Table
        columns={summaryColumns}
        dataSource={summarySource}
        pagination={false}
        size="small"
        bordered
      />

      {/* Raw Biometric Punches */}
      {rawPunchData.length > 0 && (
        <>
          <Divider style={{ margin: "12px 0 8px" }} />
          <Text strong style={{ fontSize: 13, display: "block", marginBottom: 4 }}>
            Raw Biometric Punches
          </Text>
          <Table
            columns={rawColumns}
            dataSource={rawPunchData}
            pagination={false}
            size="small"
            bordered
            style={{ marginBottom: 0 }}
          />
        </>
      )}
    </div>
  );
};

export default DailyLogsTable;

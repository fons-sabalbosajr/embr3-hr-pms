import React from "react";
import useDemoMode from "../../../../../hooks/useDemoMode";
import { Table, Button, message } from "antd";
import dayjs from "dayjs";

const DailyLogsTable = ({ dailySummary, onSendReminder }) => {
  const { isDemoActive, isDemoUser, allowSubmissions, isPrivileged } = useDemoMode();
  const demoReadOnly = isDemoActive && isDemoUser && !allowSubmissions && !isPrivileged;
  if (!dailySummary) return null;

  const { rawLogs, timeIn, breakOut, breakIn, timeOut } = dailySummary;

  // Default Break Out/In if missing
  const finalBreakOut = breakOut || "12:00";
  const finalBreakIn = breakIn || "1:00";

  const dataSource = [
    {
      key: dayjs(rawLogs[0]?.time).format("YYYY-MM-DD") || "1",
      date: rawLogs[0]?.time || new Date(),
      timeIn: timeIn || null,
      breakOut: finalBreakOut,
      breakIn: finalBreakIn,
      timeOut: timeOut || null,
    },
  ];

  const hasMissingTime = !timeIn || !timeOut;

  const columns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      render: (value) => dayjs(value).tz("Asia/Manila").format("MMM D, YYYY"),
    },
    {
      title: "Time In",
      dataIndex: "timeIn",
      key: "timeIn",
      render: (value) => (
        <span style={{ color: value ? "inherit" : "red" }}>
          {value || "Missing"}
        </span>
      ),
    },
    {
      title: "Break Out",
      dataIndex: "breakOut",
      key: "breakOut",
      render: (value) => <span>{value}</span>,
    },
    {
      title: "Break In",
      dataIndex: "breakIn",
      key: "breakIn",
      render: (value) => <span>{value}</span>,
    },
    {
      title: "Time Out",
      dataIndex: "timeOut",
      key: "timeOut",
      render: (value) => (
        <span style={{ color: value ? "inherit" : "red" }}>
          {value || "Missing"}
        </span>
      ),
    },
  ];

  // Conditionally show Send Reminder button if there’s a missing time
  if (hasMissingTime) {
    columns.push({
      title: "Action",
      key: "action",
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          disabled={demoReadOnly}
          onClick={() => {
            if (onSendReminder) {
              onSendReminder(record);
            } else {
              message.warning("Under Maintenance: Reminder feature coming soon.");
            }
          }}
        >
          Send Reminder
        </Button>
      ),
    });
  }

  return (
    <Table
      columns={columns}
      dataSource={dataSource}
      pagination={false}
      size="small"
    />
  );
};

export default DailyLogsTable;

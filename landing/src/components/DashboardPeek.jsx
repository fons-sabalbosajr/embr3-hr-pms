import React from "react";
import { Card, Statistic, Progress, Table, Tag } from "antd";
import Sparkline from "./Sparkline.jsx";

const columns = [
  { title: "Employee", dataIndex: "employee", key: "employee" },
  { title: "Date", dataIndex: "date", key: "date" },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    render: (s) => (
      <Tag
        color={s === "On-time" ? "green" : s === "Late" ? "volcano" : "blue"}
      >
        {s}
      </Tag>
    ),
  },
  { title: "IN", dataIndex: "in", key: "in" },
  { title: "OUT", dataIndex: "out", key: "out" },
];

const data = [
  {
    key: 1,
    employee: "Santos, Juan",
    date: "2025-10-08",
    status: "On-time",
    in: "08:01",
    out: "17:05",
  },
  {
    key: 2,
    employee: "Dela Cruz, Maria",
    date: "2025-10-08",
    status: "Late",
    in: "08:21",
    out: "17:15",
  },
  {
    key: 3,
    employee: "Reyes, Ana",
    date: "2025-10-08",
    status: "Filed OT",
    in: "07:55",
    out: "19:40",
  },
];

const statCardStyle = {
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--shadow-md)",
};

const DashboardPeek = () => {
  return (
    <div className="peek-grid container">
      <Card style={statCardStyle} bodyStyle={{ padding: 16 }}>
        <Statistic
          title="Attendance Health"
          value={95}
          suffix="%"
          valueStyle={{ color: "var(--app-primary)" }}
        />
        <Progress
          percent={95}
          status="active"
          strokeColor={{ from: "var(--app-primary)", to: "var(--app-accent)" }}
        />
      </Card>
      <Card style={statCardStyle} bodyStyle={{ padding: 16 }}>
        <Statistic title="Requests Approved" value={30} />
        <div className="text-muted" style={{ marginTop: 6 }}>
          This month
        </div>
      </Card>
      <Card style={statCardStyle} bodyStyle={{ padding: 16 }}>
        <Statistic title="People Managed" value={262} />
        <div className="text-muted" style={{ marginTop: 6 }}>
          Across divisions, units, and sections
        </div>
      </Card>

      <Card
        style={{
          gridColumn: "1 / -1",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
        }}
        bodyStyle={{ padding: 0 }}
      >
        <div
          style={{
            padding: 16,
            borderBottom: "1px solid var(--app-border-color)",
          }}
        >
          <strong>Latest Attendance Activity</strong>
        </div>
        <Table
          size="small"
          columns={columns}
          dataSource={data}
          pagination={false}
          rowKey="key"
        />
      </Card>
    </div>
  );
};

export default DashboardPeek;

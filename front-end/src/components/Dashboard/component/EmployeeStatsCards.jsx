import React from "react";
import { Card, Col, Row, Statistic, Skeleton } from "antd";
import {
  UserOutlined,
  TeamOutlined,
  CalendarOutlined,
} from "@ant-design/icons";

const EmployeeStatsCards = ({
  loadingEmployees,
  totalEmployees,
  employeeTypeCounts,
  loadingAttendance,
  lastAttendanceDate,
  lastTwoAttendanceDates,
  presentCount,
}) => {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} md={8} lg={6}>
        <Card className="dashboard-card dashboard-card-total-employees">
          {loadingEmployees ? (
            <Skeleton active paragraph={{ rows: 1 }} />
          ) : (
            <Statistic
              title="Total Employees"
              value={totalEmployees}
              prefix={
                <UserOutlined className="stats-icon stats-icon-total" />
              }
            />
          )}
        </Card>
      </Col>

      <Col xs={24} sm={12} md={8} lg={6}>
        <Card className="dashboard-card dashboard-card-regular-employees">
          {loadingEmployees ? (
            <Skeleton active paragraph={{ rows: 1 }} />
          ) : (
            <Statistic
              title="Regular Employees"
              value={employeeTypeCounts.Regular || 0}
              prefix={
                <TeamOutlined className="stats-icon stats-icon-regular" />
              }
            />
          )}
        </Card>
      </Col>

      <Col xs={24} sm={12} md={8} lg={6}>
        <Card className="dashboard-card dashboard-card-cos-employees">
          {loadingEmployees ? (
            <Skeleton active paragraph={{ rows: 1 }} />
          ) : (
            <Statistic
              title="COS Employees"
              value={employeeTypeCounts.COS || 0}
              prefix={
                <TeamOutlined className="stats-icon stats-icon-cos" />
              }
            />
          )}
        </Card>
      </Col>

      <Col xs={24} sm={12} md={8} lg={6}>
        <Card className="dashboard-card dashboard-card-present-employees">
          {loadingAttendance ? (
            <Skeleton active paragraph={{ rows: 1 }} />
          ) : (
            <Statistic
              title={(() => {
                if (lastTwoAttendanceDates && lastTwoAttendanceDates.length === 2) {
                  const [d1, d2] = lastTwoAttendanceDates;
                  return `Present (${d1} – ${d2})`;
                }
                return `Present as of ${lastAttendanceDate || "-"}`;
              })()}
              value={`${presentCount}/${totalEmployees}`}
              prefix={<CalendarOutlined className="stats-icon stats-icon-present" />}
            />
          )}
        </Card>
      </Col>
    </Row>
  );
};

export default EmployeeStatsCards;

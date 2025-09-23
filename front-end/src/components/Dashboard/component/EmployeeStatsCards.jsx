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
                <UserOutlined style={{ color: "#1890ff", fontSize: 40 }} />
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
                <TeamOutlined style={{ color: "#52c41a", fontSize: 40 }} />
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
                <TeamOutlined style={{ color: "#faad14", fontSize: 40 }} />
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
              title={`Present as of ${lastAttendanceDate || "-"}`}
              value={`${presentCount} / ${totalEmployees}`}
              prefix={
                <CalendarOutlined style={{ color: "#eb2f96", fontSize: 40 }} />
              }
            />
          )}
        </Card>
      </Col>
    </Row>
  );
};

export default EmployeeStatsCards;

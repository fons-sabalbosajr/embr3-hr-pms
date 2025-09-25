import React from "react";
import { Tabs, Typography } from "antd";
import Payslip from "../DTRReports/Payslip/Payslip";
import Signatory from "./Signatory/Signatory";
import SystemReports from "./SystemReports/SystemReport"

const { TabPane } = Tabs;
const { Title } = Typography;

const DTRReports = () => {
  return (
    <div className="p-4 bg-white rounded shadow-md">
      {/* Page Title */}
      <Title level={3} className="mb-4">
        Daily Time Record Reports
      </Title>

      {/* Tabs */}
      <Tabs defaultActiveKey="1" type="card">
        <TabPane tab="System Reports" key="1">
          <SystemReports />
        </TabPane>

        <TabPane tab="Payroll Signatories" key="2">
         <Signatory />
        </TabPane>

        <TabPane tab="Generate Payslip" key="4">
          <Payslip />
        </TabPane>
      </Tabs>
    </div>
  );
};

export default DTRReports;

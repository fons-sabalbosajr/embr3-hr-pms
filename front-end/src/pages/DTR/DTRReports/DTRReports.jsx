import React from "react";
import { Tabs, Typography } from "antd";
import Payslip from "../DTRReports/Payslip/Payslip";
import Signatory from "./Signatory/Signatory";

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
        <TabPane tab="DTR Generation Data" key="1">
          <h2 className="text-lg font-semibold">DTR Generation Data</h2>
          <p>Put your DTR generation data components or logic here.</p>
        </TabPane>

        <TabPane tab="Payroll Signatories" key="2">
         <Signatory />
        </TabPane>

        <TabPane tab="Demand of Payment" key="3">
          <h2 className="text-lg font-semibold">Demand of Payment</h2>
          <p>Insert demand of payment table or form here.</p>
        </TabPane>

        <TabPane tab="Generate Payslip" key="4">
          <Payslip />
        </TabPane>
      </Tabs>
    </div>
  );
};

export default DTRReports;

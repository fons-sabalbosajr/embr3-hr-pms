import React, { useEffect, useState } from "react";
import { Tabs, Typography } from "antd";
import { useLocation } from "react-router-dom";
import Payslip from "../DTRReports/Payslip/Payslip";
import Signatory from "./Signatory/Signatory";
import SystemReports from "./SystemReports/SystemReport"

const { TabPane } = Tabs;
const { Title } = Typography;

const DTRReports = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const gotoPayslip = params.get('payslip') === '1';
  const initialActive = gotoPayslip ? '4' : '1';
  const [activeKey, setActiveKey] = useState(initialActive);

  useEffect(() => {
    // If navigation happened with different query (e.g., back/forward)
    const p = new URLSearchParams(location.search);
    if (p.get('payslip') === '1') {
      setActiveKey('4');
    }
  }, [location.search]);

  return (
    <div className="p-4 bg-white rounded shadow-md">
      {/* Page Title */}
      <Title level={3} className="mb-4">
        Daily Time Record Reports
      </Title>

      {/* Tabs */}
      <Tabs activeKey={activeKey} onChange={setActiveKey} type="card">
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

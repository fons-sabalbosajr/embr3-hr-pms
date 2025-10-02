import React from "react";
import { Tabs } from "antd";
import DTRDataTab from "./Tabs/DTRDataTab";
import DTRLogTab from "./Tabs/DTRLogsTab";
import EmployeeTab from "./Tabs/EmployeeTab";

const { TabPane } = Tabs;

const Backup = () => {
  return (
    <div>
      <div><h2>Records Configuration</h2></div>
      <Tabs defaultActiveKey="1" type="card">
        <TabPane tab="Daily Time Record Data" key="1">
          <DTRDataTab />
        </TabPane>
        <TabPane tab="Daily Time Back Up" key="2">
          <DTRLogTab />
        </TabPane>
        <TabPane tab="Employee List" key="3">
          <EmployeeTab />
        </TabPane>
      </Tabs>
    </div>
  );
};

export default Backup;

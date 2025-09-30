import React from "react";
import { Tabs } from "antd";
import WorkCalendar from "./Tabs/WorkCalendar";
import Trainings from "./Tabs/Trainings";
import OtherDetails from "./Tabs/OtherDetails";
import BiometricsData from "./Tabs/BiometricsData";

const GenerateReport = ({ employee }) => {
  const items = [
    {
      key: "1",
      label: "Work / Office Calendar",
      children: <WorkCalendar employee={employee} />,
    },
    {
      key: "2",
      label: "Trainings",
      children: <Trainings employee={employee} />,
    },
    {
      key: "3",
      label: "Employee Records",
      children: <OtherDetails employee={employee} />,
    },
    {
      key: "4",
      label: "Biometrics Data",
      children: <BiometricsData employee={employee} />,
    },
  ];

  return (
    <div>
      <Tabs defaultActiveKey="1" type="card" items={items} />
    </div>
  );
};

export default GenerateReport;

import React, { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Row, Col, Typography, Modal, Table, Tag } from "antd";

const { Title } = Typography;

const sectionUnitAcronyms = {
  CPD: {
    "Air and Water Permitting Section": "AIR & WATER",
    "Environmental Impact Assessment Section": "EIA",
    "Chemical and Hazardous Waste Permitting Section": "CHWPS",
  },
  FAD: {
    "Budget Unit": "BUDGET UNIT",
    "Cashier Unit": "CASHIER UNIT",
    "Finance Section": "FINANCE UNIT",
    "Personnel Unit": "PERSONNEL UNIT",
    "Property and General Services Unit": "PGSU",
    "Records Unit": "RECORDS",
  },
  EMED: {
    "Ecological Solid Waste Management Section": "ESWM",
    "Air, Water and ECC Compliance Monitoring and Enforcement Section":
      "AWECMES",
    "Ambient Monitoring and Technical Services Section": "AMTSS",
    "Chemicals and Hazardous Waste Monitoring Section": "CHWMS",
  },
  ORD: {
    "Environmental Education and Information Unit": "EEIU",
    "Environmental Laboratory Unit": "LABORATORY",
    "Legal Services Unit": "LSU",
    "Manila Bay Unit": "MBU",
    "Planning and Information System Management Unit": "PISMU",
    "Provincial Environmental Management Unit": "PEMU",
  },
  Specialized: {
    "Commission On Audit": "COA",
  },
};

const divisionAcronyms = {
  "Office of the Regional Director": "ORD",
  "Finance and Administrative Division": "FAD",
  "Environmental Monitoring and Enforcement Division": "EMED",
  "Clearance and Permitting Division": "CPD",
};

const sectionColorMap = {
  "Legal Services Unit": "magenta",
  "Ambient Monitoring and Technical Services Section": "volcano",
  "Provincial Environmental Management Unit": "gold",
  "Environmental Laboratory Unit": "lime",
  "Ecological Solid Waste Management Section": "green",
  "Personnel Unit": "cyan",
  "Property and General Services Unit": "blue",
  "Manila Bay Unit": "geekblue",
  "Chemical and Hazardous Waste Permitting Section": "purple",
  "Planning and Information System Management Unit": "red",
  "Commission On Audit": "orange",
  "Records Unit": "lime",
  "Budget Unit": "green",
  "Office of the Regional Director": "cyan",
  "Environmental Education and Information Unit": "blue",
  "Air, Water and ECC Compliance Monitoring and Enforcement Section":
    "geekblue",
  "Air and Water Permitting Section": "purple",
  "Cashier Unit": "red",
  "Environmental Impact Assessment Section": "orange",
  "Accounting Unit": "magenta",
  "Chemicals and Hazardous Waste Monitoring Section": "volcano",
  "Finance Section": "gold",
  "N/A": "default",
};

const divisionColorMap = {
  ORD: "cyan",
  EMED: "blue",
  FAD: "geekblue",
  CPD: "purple",
};

const getSectionAcronym = (sectionName) => {
  for (const division in sectionUnitAcronyms) {
    if (sectionUnitAcronyms[division][sectionName]) {
      return sectionUnitAcronyms[division][sectionName];
    }
  }
  return sectionName || "N/A";
};

const getDivisionAcronym = (sectionName) => {
  for (const division in sectionUnitAcronyms) {
    if (sectionUnitAcronyms[division][sectionName]) {
      return divisionAcronyms[division] || division;
    }
  }
  return "N/A";
};

const divisionShortNames = {
  "Environmental Monitoring and Enforcement Division": "EMED",
  "Office of the Regional Director": "ORD",
  "Finance and Administrative Division": "FAD",
  "Clearance and Permitting Division": "CPD",
};

const shortDivisionNames = {
  EMED: "Environmental Monitoring and Enforcement Division",
  ORD: "Office of the Regional Director",
  FAD: "Finance and Administrative Division",
  CPD: "Clearance and Permitting Division",
};

const PieChartComponent = ({ data, colors, employees = [] }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedDivision, setSelectedDivision] = useState(null);

  const handlePieClick = (entry) => {
    setSelectedDivision(entry.name);
    setIsModalVisible(true);
  };

  const handleClose = () => {
    setIsModalVisible(false);
    setSelectedDivision(null);
  };

  const pieData = [
    { name: "Regular", value: data.Regular || 0 },
    { name: "Contract of Service", value: data.COS || 0 },
  ];

  const employeesByDivision = employees.reduce((acc, employee) => {
    const division = employee.division || "N/A";
    const shortName = divisionShortNames[division] || division;
    acc[shortName] = (acc[shortName] || 0) + 1;
    return acc;
  }, {});

  const divisionData = Object.entries(employeesByDivision).map(
    ([name, value]) => ({ name, value })
  );

  const filteredEmployees = employees.filter((emp) => {
    const fullDivisionName = shortDivisionNames[selectedDivision];
    return emp.division === fullDivisionName;
  });

  const columns = [
    { title: "ID", dataIndex: "empId", key: "empId" },
    { title: "Name", dataIndex: "name", key: "name" },
    { title: "Type", dataIndex: "empType", key: "empType" },
    {
      title: "Section/Unit",
      key: "sectionOrUnit",
      render: (text, record) => {
        if (record.sectionOrUnit) {
          return (
            <Tag color={sectionColorMap[record.sectionOrUnit] || "default"}>
              {`${getSectionAcronym(
                record.sectionOrUnit
              )} (${getDivisionAcronym(record.sectionOrUnit)})`}
            </Tag>
          );
        }
        const divisionAcronym =
          divisionShortNames[record.division] || record.division;
        return (
          <Tag color={divisionColorMap[divisionAcronym] || "default"}>
            {divisionAcronym}
          </Tag>
        );
      },
      sorter: (a, b) => {
        const sectionA = a.sectionOrUnit || a.division;
        const sectionB = b.sectionOrUnit || b.division;
        return sectionA.localeCompare(sectionB);
      },
      defaultSortOrder: 'ascend',
    },
  ];

  return (
    <>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Title level={5} style={{ textAlign: "center" }}>
            Employee Type Distribution
          </Title>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={colors[index % colors.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Col>
        <Col xs={24} md={12}>
          <Title level={5} style={{ textAlign: "center" }}>
            Employees per Division
          </Title>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={divisionData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
                onClick={handlePieClick}
              >
                {divisionData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={colors[index % colors.length]}
                    style={{ cursor: "pointer" }}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Col>
      </Row>
      <Modal
        title={`Employees - ${selectedDivision || ""}`}
        open={isModalVisible}
        onCancel={handleClose}
        footer={null}
        width={1100}
      >
        <Table
          dataSource={filteredEmployees}
          columns={columns}
          rowKey="empId"
          size="small"
          pagination={{ pageSize: 10 }}
        />
      </Modal>
    </>
  );
};

export default PieChartComponent;

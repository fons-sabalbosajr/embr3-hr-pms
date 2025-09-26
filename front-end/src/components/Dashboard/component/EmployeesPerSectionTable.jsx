import React, { useState, useLayoutEffect, useRef } from "react";
import { Card, Col, Row, Skeleton, Modal, Table, Typography } from "antd";
import { TeamOutlined, UserOutlined } from "@ant-design/icons";

const { Text } = Typography;

// Division → Sections mapping
const divisionMap = {
  ORD: [
    "Environmental Education and Information Unit",
    "Environmental Laboratory Unit",
    "Legal Services Unit",
    "Planning and Information System Management Unit",
    "Provincial Environmental Management Unit",
    "Manila Bay Unit",
  ],
  EMED: [
    "Air, Water and ECC Compliance Monitoring and Enforcement Section",
    "Ecological Solid Waste Management Section",
    "Ambient Monitoring and Technical Services Section",
    "Chemicals and Hazardous Waste Monitoring Section",
  ],
  FAD: [
    "Budget Unit",
    "Cashier Unit",
    "Finance Section",
    "Property and General Services Unit",
    "Records Unit",
    "Accounting Unit",
    "Personnel Unit",
  ],
  CPD: [
    "Air and Water Permitting Section",
    "Environmental Impact Assessment Section",
    "Chemical and Hazardous Waste Permitting Section",
  ],
  "Specialized Units": ["Commission On Audit"],
};

// Section color mapping
const sectionColorMap = {
  "Legal Services Unit": "magenta",
  "Ambient Monitoring and Technical Services Section": "orange",
  "Provincial Environmental Management Unit": "gold",
  "Environmental Laboratory Unit": "lime",
  "Ecological Solid Waste Management Section": "green",
  "Personnel Unit": "cyan",
  "Property and General Services Unit": "blue",
  "Manila Bay Unit": "cyan",
  "Chemical and Hazardous Waste Permitting Section": "purple",
  "Planning and Information System Management Unit": "red",
  "Commission On Audit": "orange",
  "Records Unit": "lime",
  "Budget Unit": "green",
  "Office of the Regional Director": "cyan",
  "Environmental Education and Information Unit": "blue",
  "Air, Water and ECC Compliance Monitoring and Enforcement Section": "blue",
  "Air and Water Permitting Section": "purple",
  "Cashier Unit": "red",
  "Environmental Impact Assessment Section": "orange",
  "Accounting Unit": "magenta",
  "Chemicals and Hazardous Waste Monitoring Section": "purple",
  "Finance Section": "gold",
  "N/A": "default",
  Other: "gold",
  "Section Chief": "blue",
};

const chiefs = {
  CPD: "03-016",
  FAD: "03-024",
  EMED: "03-673",
};

const EmployeesPerSectionTable = ({
  loadingEmployees,
  employeesPerSection = [],
  employees = [],
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [maxHeight, setMaxHeight] = useState(0);
  const cardRefs = useRef([]);

  useLayoutEffect(() => {
    if (loadingEmployees) return;
    const heights = cardRefs.current.map((ref) => ref?.scrollHeight || 0);
    const max = Math.max(...heights);
    setMaxHeight(max);
  }, [loadingEmployees, employees]);

  const handleCardClick = (sectionName, divisionName) => {
    setSelectedSection(sectionName);
    setSelectedDivision(divisionName);
    setIsModalVisible(true);
  };

  const handleClose = () => {
    setIsModalVisible(false);
    setSelectedSection(null);
    setSelectedDivision(null);
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

  const filteredEmployees = employees
    .filter((emp) => {
      if (selectedSection === "Other") {
        const fullDivisionName = shortDivisionNames[selectedDivision];
        return emp.division === fullDivisionName && !emp.sectionOrUnit;
      }
      if (selectedSection === "Division Chief") {
        const chiefId = chiefs[selectedDivision];
        return emp.empId === chiefId;
      }
      return emp.sectionOrUnit === selectedSection;
    })
    .sort((a, b) => {
      // Prioritize "Regular" employees
      if (a.empType === "Regular" && b.empType !== "Regular") {
        return -1; // a comes before b
      }
      if (a.empType !== "Regular" && b.empType === "Regular") {
        return 1; // b comes before a
      }
      return 0; // maintain original order for same empType or if both are not "Regular"
    });

  const columns = [
    { title: "ID", dataIndex: "empId", key: "empId" },
    { title: "Name", dataIndex: "name", key: "name" },
    { title: "Type", dataIndex: "empType", key: "empType" },
    { title: "Division", dataIndex: "division", key: "division" },
  ];

  return (
    <>
      <Card
        title="Employee List per Section/Unit"
        className="dashboard-card"
        size="small"
      >
        <Row gutter={[16, 16]} justify="space-around" align="stretch">
          {Object.entries(divisionMap).map(([division, sections], index) => {
            const otherEmployeesCount = employees.filter(
              (emp) =>
                divisionShortNames[emp.division] === division &&
                !emp.sectionOrUnit
            ).length;

            const divisionChief = employees.find(
              (emp) => emp.empId === chiefs[division]
            );

            const sectionsWithOther = [...sections, "Other"];
            return (
              <Col
                xs={24}
                sm={12}
                md={8}
                lg={{ flex: "1 1 20%" }}
                xl={{ flex: "1 1 20%" }}
                key={division}
                style={{ display: "flex" }}
              >
                <Card
                  ref={(el) => (cardRefs.current[index] = el)}
                  size="small"
                  title={division}
                  styles={{
                    header: {
                      background: "linear-gradient(to right, #e6f7ff, #ffffff)",
                      borderBottom: "1px solid #d9d9d9",
                    },
                  }}
                  style={{
                    minHeight: 200,
                    display: "flex",
                    flexDirection: "column",
                    fontSize: "0.85rem",
                    width: "100%",
                  }}
                >
                  {loadingEmployees ? (
                    <Skeleton active paragraph={{ rows: 10 }} />
                  ) : (
                    <ul
                      style={{
                        paddingLeft: 5,
                        margin: 0,
                        listStyle: "none",
                        flex: 1,
                        overflowY: "auto",
                      }}
                    >
                      {divisionChief && (
                        <li
                          key="chief"
                          style={{ marginBottom: 8, cursor: "pointer" }}
                          onClick={() =>
                            handleCardClick("Division Chief", division)
                          }
                        >
                          <span
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "2px 6px",
                              borderLeft: `4px solid ${sectionColorMap["Section Chief"]}`,
                              background: "#fafafa",
                              borderRadius: 4,
                              fontSize: "12px",
                            }}
                          >
                            <Text style={{ fontSize: "12px" }} strong>Division Chief</Text>
                            <span
                              style={{
                                color: "#1890ff",
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              <TeamOutlined style={{ marginRight: 4 }} />1
                            </span>
                          </span>
                        </li>
                      )}
                      {sectionsWithOther.map((section) => {
                        const isOther = section === "Other";
                        const sec = isOther
                          ? { count: otherEmployeesCount }
                          : employeesPerSection.find(
                              (s) => s.section === section
                            ) || { count: 0, regular: 0, cos: 0 };

                        if (isOther && otherEmployeesCount === 0) {
                          return null;
                        }
                        const color = sectionColorMap[section] || "darkgrey";

                        return (
                          <li
                            key={section}
                            style={{
                              marginBottom: 8,
                              cursor: "pointer",
                            }}
                            onClick={() => handleCardClick(section, division)}
                          >
                            <span
                              style={{
                                display: "flex", // Use flexbox
                                justifyContent: "space-between", // Push content to ends
                                alignItems: "center", // Vertically align items
                                padding: "2px 6px",
                                borderLeft: `4px solid ${color}`,
                                background: "#fafafa",
                                borderRadius: 4,
                                // minWidth: "90%", // Removed, flexbox handles width
                                fontSize: "12px", // Slightly larger font for readability
                              }}
                            >
                              {section}{" "}
                              <span
                                style={{
                                  color: "#1890ff",
                                  display: "flex",
                                  alignItems: "center",
                                }}
                              >
                                <TeamOutlined style={{ marginRight: 4 }} />{" "}
                                {sec.count}
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
      </Card>

      {/* Modal */}
      <Modal
        title={`Employees - ${selectedSection || ""}`}
        open={isModalVisible}
        onCancel={handleClose}
        footer={null}
        width={800}
        destroyOnHidden
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

export default EmployeesPerSectionTable;

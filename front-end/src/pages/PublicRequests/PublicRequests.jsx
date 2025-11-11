import React from "react";
import { Card, Typography, Row, Col } from "antd";
import { Link } from "react-router-dom";
import { FileTextOutlined, ClockCircleOutlined } from "@ant-design/icons";
// Switch background to SVG logo watermark
import embLogo from "../../assets/emblogo.svg";
import "./publicrequests.css";

const { Title } = Typography;

const PublicRequests = () => {
  return (
    <div
      className="public-container"
      style={{
        // Use the emblogo.svg as underlying watermark image layered under gradient
        backgroundImage: `linear-gradient(
          135deg,
          rgba(0, 75, 128, 0.88),
          rgba(154, 205, 50, 0.85),
          rgba(245, 216, 163, 0.85)
        ), url(${embLogo})`,
        backgroundSize: "cover, contain",
        backgroundRepeat: "no-repeat, no-repeat",
        backgroundPosition: "center, center",
      }}
    >
      <Card className="public-card">
        <Title level={3} className="public-title" style={{ textAlign: "center" }}>
          Employee Request Portal
        </Title>
        <p style={{ textAlign: "center", marginBottom: "2rem" }}>
          Select the type of request you want to make
        </p>

        <Row gutter={[24, 24]} justify="center">
          <Col xs={24} sm={12}>
            <Link to="/payslip">
              <Card
                hoverable
                className="request-card"
                style={{ textAlign: "center" }}
              >
                <FileTextOutlined style={{ fontSize: "2rem", color: "#004B80" }} />
                <Title level={4} style={{ marginTop: "1rem" }}>
                  Payslip Request
                </Title>
              </Card>
            </Link>
          </Col>

          <Col xs={24} sm={12}>
            <Link to="/dtr-employee-request">
              <Card
                hoverable
                className="request-card"
                style={{ textAlign: "center" }}
              >
                <ClockCircleOutlined style={{ fontSize: "2rem", color: "#9ACD32" }} />
                <Title level={4} style={{ marginTop: "1rem" }}>
                  DTR Request
                </Title>
              </Card>
            </Link>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default PublicRequests;

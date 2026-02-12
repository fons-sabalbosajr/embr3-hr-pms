import React from "react";
import { Card, Typography, Row, Col, Grid, ConfigProvider, theme } from "antd";
import { Link } from "react-router-dom";
import { FileTextOutlined, ClockCircleOutlined } from "@ant-design/icons";
import bgImage from "../../assets/bgemb.webp";
import "./publicrequests.css";

const { Title, Text } = Typography;

const PublicRequests = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  return (
    <ConfigProvider
      theme={{ inherit: false, algorithm: theme.defaultAlgorithm }}
    >
      <div
        className="public-container theme-exempt"
        style={{
          backgroundImage: `linear-gradient(
            135deg,
            rgba(0, 75, 128, 0.88),
            rgba(154, 205, 50, 0.85),
            rgba(245, 216, 163, 0.85)
          ), url(${bgImage})`,
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
        }}
      >
        <Card className="public-card theme-exempt">
          <Title
            level={isMobile ? 4 : 3}
            className="public-title"
            style={{ textAlign: "center" }}
          >
            Employee Request Portal
          </Title>
          <Text
            type="secondary"
            style={{
              display: "block",
              textAlign: "center",
              marginBottom: isMobile ? "1.25rem" : "2rem",
              fontSize: isMobile ? 13 : 14,
            }}
          >
            Select the type of request you want to make
          </Text>

          <Row gutter={[16, 16]} justify="center">
            <Col xs={24} sm={12}>
              <Link to="/payslip">
                <Card
                  hoverable
                  className="request-card"
                  style={{ textAlign: "center" }}
                >
                  <FileTextOutlined
                    style={{
                      fontSize: isMobile ? "1.6rem" : "2rem",
                      color: "#004B80",
                    }}
                  />
                  <Title
                    level={isMobile ? 5 : 4}
                    style={{ marginTop: isMobile ? "0.6rem" : "1rem" }}
                  >
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
                  <ClockCircleOutlined
                    style={{
                      fontSize: isMobile ? "1.6rem" : "2rem",
                      color: "#9ACD32",
                    }}
                  />
                  <Title
                    level={isMobile ? 5 : 4}
                    style={{ marginTop: isMobile ? "0.6rem" : "1rem" }}
                  >
                    DTR Request
                  </Title>
                </Card>
              </Link>
            </Col>
          </Row>
        </Card>
      </div>
    </ConfigProvider>
  );
};

export default PublicRequests;

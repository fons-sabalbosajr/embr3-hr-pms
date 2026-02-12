import React, { useEffect, useState } from "react";
import {
  Card,
  Typography,
  Button,
  Form,
  Input,
  DatePicker,
  message,
  Modal,
  AutoComplete,
  ConfigProvider,
  Grid,
  Result,
  theme,
} from "antd";
import { Link } from "react-router-dom";
import {
  CalendarOutlined,
  FieldTimeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import bgImage from "../../assets/bgemb.webp";
import axiosInstance from "../../api/axiosInstance";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import "./requestdtrclient.css";

dayjs.extend(utc);
dayjs.extend(timezone);

const { Title, Text } = Typography;

const RequestDTRClient = () => {
  const [form] = Form.useForm();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [submitting, setSubmitting] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [resultStatus, setResultStatus] = useState("success"); // "success" | "unavailable"
  const [resultMonth, setResultMonth] = useState("");
  const [cutoffs, setCutoffs] = useState([]);
  const [cutoffsLoading, setCutoffsLoading] = useState(true);
  const [empOptions, setEmpOptions] = useState([]);
  const [empSearching, setEmpSearching] = useState(false);
  const empSearchRef = React.useRef();

  const buildEmpIdVariants = (q) => {
    const suggestions = new Set();
    const raw = (q || "").trim();
    if (!raw) return [];
    if (raw.includes("-")) {
      const [a, b = ""] = raw.split("-");
      if (b && /^\d+$/.test(b) && b.length < 4) {
        suggestions.add(`${a}-${b.padStart(4, "0")}`);
      }
      suggestions.add(raw.replace(/-/g, ""));
    } else if (/^\d+$/.test(raw) && raw.length > 2) {
      const a = raw.slice(0, 2);
      const b = raw.slice(2);
      suggestions.add(`${a}-${b.padStart(4, "0")}`);
    }
    return Array.from(suggestions).slice(0, 3);
  };

  const handleEmpSearch = (value) => {
    if (empSearchRef.current) clearTimeout(empSearchRef.current);
    if (!value || value.length < 2) {
      setEmpOptions([]);
      return;
    }
    empSearchRef.current = setTimeout(async () => {
      try {
        setEmpSearching(true);
        const { data } = await axiosInstance.get(`/employees/public/search`, {
          params: { q: value },
        });
        const rows = data?.data || [];
        if (rows.length > 0) {
          setEmpOptions(
            rows.map((r) => ({
              value: r.empId,
              label: `${r.empId} — ${r.name}`,
            }))
          );
        } else {
          const variants = buildEmpIdVariants(value);
          setEmpOptions(
            variants.length
              ? variants.map((v) => ({ value: v, label: `Try: ${v}` }))
              : []
          );
        }
      } catch (_) {
        const variants = buildEmpIdVariants(value);
        setEmpOptions(
          variants.length
            ? variants.map((v) => ({ value: v, label: `Try: ${v}` }))
            : []
        );
      } finally {
        setEmpSearching(false);
      }
    }, 250);
  };

  // Load published DTR cut-offs (biometrics encoded coverage)
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setCutoffsLoading(true);
        const { data } = await axiosInstance.get("/dtrdatas/public");
        const list = data?.data || [];
        if (!mounted) return;
        // Sort by start descending for display
        const sorted = [...list].sort((a, b) => {
          const as = dayjs(a?.DTR_Cut_Off?.start);
          const bs = dayjs(b?.DTR_Cut_Off?.start);
          return bs.valueOf() - as.valueOf();
        });
        setCutoffs(sorted);
      } catch (_) {
        if (mounted) setCutoffs([]);
      } finally {
        if (mounted) setCutoffsLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const onFinish = async (values) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const startDate = values.month.startOf("month");
      const endDate = values.month.endOf("month");
      const monthLabel = values.month.format("MMMM YYYY");

      // Extract empId from display string ("03-0946 — Name" → "03-0946")
      const rawEmpId = (values.employeeId || "").split("\u2014")[0].trim();
      const employeeId = rawEmpId || values.employeeId;

      // 1. Check DTR data availability for the selected month
      let isAvailable = false;
      try {
        const checkResponse = await axiosInstance.get("/dtrdatas/public/check", {
          params: {
            startDate: startDate.format("YYYY-MM-DD"),
            endDate: endDate.format("YYYY-MM-DD"),
            empId: employeeId,
          },
        });
        const d = checkResponse?.data?.data || {};
        isAvailable = !!d.available;
      } catch (_) {
        isAvailable = false;
      }

      if (!isAvailable) {
        setResultMonth(monthLabel);
        setResultStatus("unavailable");
        setResultOpen(true);
        return;
      }

      // 2. Submit DTR request to the server so HR/admin receives the notification
      await axiosInstance.post("/dtr-requests", {
        employeeId: employeeId,
        startDate: startDate.format("YYYY-MM-DD"),
        endDate: endDate.format("YYYY-MM-DD"),
        email: values.email,
      });

      // 3. Show success modal with instructions
      setResultMonth(monthLabel);
      setResultStatus("success");
      setResultOpen(true);
      form.resetFields();
    } catch (error) {
      if (
        error.response?.status === 429 ||
        error.response?.data?.code === "REQUEST_LIMIT_REACHED"
      ) {
        message.warning(
          error.response?.data?.message ||
            "You already have pending requests. Please wait for HR to process them."
        );
      } else {
        message.error("An error occurred while submitting your request.");
      }
      console.error("DTR request error:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ConfigProvider
      theme={{ inherit: false, algorithm: theme.defaultAlgorithm }}
    >
      <div
        className="request-dtr-container theme-exempt"
        style={{
          minHeight: "100vh",
          backgroundImage: `linear-gradient(
            135deg,
            rgba(0, 75, 128, 0.85),
            rgba(154, 205, 50, 0.85),
            rgba(245, 216, 163, 0.85)
          ), url(${bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <Card className="auth-card request-dtr-card">
          {/* Encoded Biometrics Announcement */}
          <div className="cutoff-banner">
            <div className="cutoff-banner__icon">
              <FieldTimeOutlined />
            </div>
            <div className="cutoff-banner__content">
              <div className="cutoff-banner__title">
                Encoded biometrics cut-offs
              </div>
              <div className="cutoff-banner__desc">
                {cutoffsLoading ? (
                  <span>Loading latest coverage…</span>
                ) : cutoffs.length > 0 ? (
                  (() => {
                    const r = cutoffs[0];
                    const s = r?.DTR_Cut_Off?.start
                      ? dayjs(r.DTR_Cut_Off.start)
                      : null;
                    const e = r?.DTR_Cut_Off?.end
                      ? dayjs(r.DTR_Cut_Off.end)
                      : null;
                    const label =
                      s && e
                        ? s.isSame(e, "month")
                          ? `${s.format("MMM D")}–${e.format("D, YYYY")}`
                          : `${s.format("MMM D, YYYY")} – ${e.format(
                              "MMM D, YYYY"
                            )}`
                        : r?.DTR_Record_Name || "Cut-off";
                    return (
                      <span className="cutoff-recent">
                        <CalendarOutlined />
                        <span className="cutoff-recent__label">
                          Recent Biometrics:
                        </span>
                        <strong>{label}</strong>
                      </span>
                    );
                  })()
                ) : (
                  <span>
                    No DTR cut-offs published yet. Your request will be queued
                    once available.
                  </span>
                )}
              </div>
            </div>
          </div>

          <Title level={3} className="auth-title">
            DTR Request
          </Title>
          <Text>
            Please fill out the form below to request a copy of your DTR.
          </Text>

          <Form form={form} layout="vertical" onFinish={onFinish}>
            <Form.Item
              label="Employee ID or Name"
              name="employeeId"
              rules={[{ required: true, message: "Employee ID is required" }]}
            >
              <AutoComplete
                options={empOptions}
                onSearch={handleEmpSearch}
                onSelect={(val, option) => {
                  form.setFieldValue("employeeId", option.label || val);
                }}
                placeholder="Search by ID or name (e.g. 03-0946 or Juan)"
                allowClear
                notFoundContent={empSearching ? "Searching…" : "No matches"}
                filterOption={false}
                getPopupContainer={(trigger) => trigger.parentNode}
              />
            </Form.Item>

            <Form.Item
              label="DTR Month"
              name="month"
              rules={[
                { required: true, message: "Please select a month" },
              ]}
              className="responsive-month-picker-item"
            >
              <DatePicker
                picker="month"
                style={{ width: "100%" }}
                allowClear
                placeholder="Select DTR month"
                placement="bottomLeft"
                inputReadOnly
              />
            </Form.Item>

            <Form.Item
              label="Email Address"
              name="email"
              rules={[
                { required: true, message: "Email is required" },
                {
                  type: "email",
                  message: "Please enter a valid email address",
                },
              ]}
            >
              <Input placeholder="Enter your email where DTR will be sent" />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={submitting}
                disabled={submitting}
                className="fixed-primary-btn"
              >
                {submitting ? "Submitting…" : "Submit Request"}
              </Button>
            </Form.Item>
          </Form>

          <Modal
            open={resultOpen}
            onCancel={() => setResultOpen(false)}
            footer={[
              <Button
                key="ok"
                type="primary"
                onClick={() => setResultOpen(false)}
              >
                Got it
              </Button>,
            ]}
            width={isMobile ? "95vw" : 480}
          >
            {resultStatus === "success" ? (
              <Result
                icon={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
                title="Request Submitted!"
                subTitle={`Your DTR request for ${resultMonth} has been sent to HR.`}
                extra={
                  <div style={{ textAlign: "left", maxWidth: 380, margin: "0 auto" }}>
                    <Typography.Title level={5} style={{ marginBottom: 8 }}>
                      What happens next?
                    </Typography.Title>
                    <ol style={{ paddingLeft: 20, margin: 0, lineHeight: 2 }}>
                      <li>HR will review and verify your request.</li>
                      <li>
                        A PDF copy of your DTR will be sent to the email address
                        you provided.
                      </li>
                      <li>
                        Please allow <strong>1–3 working days</strong> for
                        processing.
                      </li>
                    </ol>
                    <Typography.Text
                      type="secondary"
                      style={{ display: "block", marginTop: 12, fontSize: 12 }}
                    >
                      If you don't receive your DTR within the expected time,
                      please contact the HR office directly.
                    </Typography.Text>
                  </div>
                }
              />
            ) : (
              <Result
                icon={<CloseCircleOutlined style={{ color: "#ff4d4f" }} />}
                title="DTR Not Yet Available"
                subTitle={`The DTR data for ${resultMonth} has not been encoded yet.`}
                extra={
                  <Typography.Text type="secondary">
                    Please try again once the biometrics for this period have
                    been uploaded. You can check the "Encoded biometrics
                    cut-offs" banner above for the latest coverage.
                  </Typography.Text>
                }
              />
            )}
          </Modal>

          <div style={{ textAlign: "center", marginTop: "1rem" }}>
            <Link to="/requests">
              <Button type="link">⬅ Back to Requests</Button>
            </Link>
          </div>
        </Card>
      </div>
    </ConfigProvider>
  );
};

export default RequestDTRClient;

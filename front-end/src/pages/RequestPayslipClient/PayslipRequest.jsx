import React, { useContext, useEffect, useState } from "react";
import {
  Card,
  Typography,
  Button,
  Form,
  Input,
  DatePicker,
  message,
  AutoComplete,
  ConfigProvider,
  theme,
} from "antd";
import { Link } from "react-router-dom";
import bgImage from "../../assets/bgemb.webp";
import axiosInstance from "../../api/axiosInstance";
import "./paysliprequest.css";
import dayjs from "dayjs";
import { CalendarOutlined } from "@ant-design/icons";

// ✅ Make sure you have NotificationsContext or pass setNotifications from props
import { NotificationsContext } from "../../context/NotificationsContext";

const { Title, Text } = Typography;

const PayslipRequest = () => {
  const [form] = Form.useForm();
  const { setNotifications } = useContext(NotificationsContext); // ✅ add context
  const [submitting, setSubmitting] = useState(false);
  const [latestCutoff, setLatestCutoff] = useState(null);
  const [cutoffLoading, setCutoffLoading] = useState(true);
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
        const { data } = await axiosInstance.get(`/employees/search-emp-id`, {
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
            variants.map((v) => ({ value: v, label: `Try: ${v}` }))
          );
        }
      } catch (_) {
        const variants = buildEmpIdVariants(value);
        setEmpOptions(variants.map((v) => ({ value: v, label: `Try: ${v}` })));
      } finally {
        setEmpSearching(false);
      }
    }, 250);
  };

  // Load latest encoded biometrics (DTR cut-off) for quick visibility
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setCutoffLoading(true);
        const { data } = await axiosInstance.get("/dtrdatas");
        const list = data?.data || [];
        if (!mounted) return;
        if (list.length) {
          const sorted = [...list].sort((a, b) => {
            const as = dayjs(a?.DTR_Cut_Off?.start);
            const bs = dayjs(b?.DTR_Cut_Off?.start);
            return bs.valueOf() - as.valueOf();
          });
          setLatestCutoff(sorted[0]);
        } else {
          setLatestCutoff(null);
        }
      } catch (_) {
        if (mounted) setLatestCutoff(null);
      } finally {
        if (mounted) setCutoffLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const onFinish = async (values) => {
    if (submitting) return; // prevent double submit
    setSubmitting(true);
    try {
      const response = await axiosInstance.post("/payslip-requests", {
        employeeId: values.employeeId,
        period: values.month.format("YYYY-MM"),
        email: values.email,
      });

      if (response.data?.success) {
        const request = response.data?.data;
        message.success("Payslip request submitted successfully!");

        // ✅ Push into notifications so it appears in bell popover
        if (request) {
          setNotifications((prev) => [
            {
              id: request._id || Date.now(),
              employeeId: request.employeeId,
              createdAt: request.createdAt || new Date(),
              read: false,
              type: "PayslipRequest",
            },
            ...prev,
          ]);
        }

        form.resetFields();
      } else {
        // Handle limit reached or general failure
        const msg =
          response.data?.message || "Failed to submit payslip request.";
        if (
          response.status === 429 ||
          response.data?.code === "REQUEST_LIMIT_REACHED"
        ) {
          message.warning(msg);
        } else {
          message.error(msg);
        }
      }
    } catch (error) {
      if (
        error.response?.status === 429 ||
        error.response?.data?.code === "REQUEST_LIMIT_REACHED"
      ) {
        message.warning(
          error.response?.data?.message ||
            "You already have 3 pending requests. Please wait for HR verification."
        );
      } else {
        message.error("An error occurred while submitting the request.");
      }
      console.error("Payslip request error:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ConfigProvider
      theme={{ inherit: false, algorithm: theme.defaultAlgorithm }}
    >
      <div
        className="payslip-request-container theme-exempt"
        style={{
          backgroundImage: `linear-gradient(
          135deg,
          rgba(0, 75, 128, 0.85),
          rgba(154, 205, 50, 0.85),
          rgba(245, 216, 163, 0.85)
        ), url(${bgImage})`,
        }}
      >
        <Card className="payslip-request-card">
          {/* Latest encoded biometrics summary */}
          <div className="cutoff-banner">
            <div className="cutoff-banner__icon">
              <CalendarOutlined />
            </div>
            <div className="cutoff-banner__content">
              <div className="cutoff-banner__title">
                Latest Encoded Biometrics
              </div>
              <div className="cutoff-banner__desc">
                {cutoffLoading ? (
                  <span>Loading latest coverage…</span>
                ) : latestCutoff ? (
                  (() => {
                    const s = latestCutoff?.DTR_Cut_Off?.start
                      ? dayjs(latestCutoff.DTR_Cut_Off.start)
                      : null;
                    const e = latestCutoff?.DTR_Cut_Off?.end
                      ? dayjs(latestCutoff.DTR_Cut_Off.end)
                      : null;
                    const label =
                      s && e
                        ? s.isSame(e, "month")
                          ? `${s.format("MMM D")}–${e.format("D, YYYY")}`
                          : `${s.format("MMM D, YYYY")} – ${e.format(
                              "MMM D, YYYY"
                            )}`
                        : latestCutoff?.DTR_Record_Name || "Cut-off";
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
                    No DTR cut-offs published yet. Your payslip request will be
                    queued once available.
                  </span>
                )}
              </div>
            </div>
          </div>

          <Title level={3} className="auth-title">
            Payslip Request
          </Title>
          <Text>
            Please fill out the form below to securely request your payslip.
          </Text>

          <Form
            form={form}
            layout="vertical"
            style={{ marginTop: "1rem" }}
            onFinish={onFinish}
          >
            <Form.Item
              label="Employee ID"
              name="employeeId"
              rules={[{ required: true, message: "Employee ID is required" }]}
            >
              <AutoComplete
                options={empOptions}
                onSearch={handleEmpSearch}
                placeholder="Type your Employee ID (e.g. 03-0946)"
                allowClear
                notFoundContent={empSearching ? "Searching…" : "No matches"}
                filterOption={false}
                getPopupContainer={(trigger) => trigger.parentNode}
              />
            </Form.Item>

            <Form.Item
              label="Payslip Month"
              name="month"
              rules={[{ required: true, message: "Please select a month" }]}
              className="responsive-month-picker-item"
            >
              <DatePicker
                picker="month"
                style={{ width: "100%" }}
                allowClear
                placeholder="Select payslip month"
                // getPopupContainer={(trigger) => trigger.parentNode}
                // popupClassName="mobile-friendly-month-picker"
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
              <Input placeholder="Enter the email to receive your payslip" />
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

export default PayslipRequest;

import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Typography,
  Button,
  Form,
  Input,
  DatePicker,
  message,
  Modal,
  Table,
  Space,
  Skeleton,
  AutoComplete,
  ConfigProvider,
  theme,
} from "antd";
import { Link } from "react-router-dom";
import { CalendarOutlined, FieldTimeOutlined } from "@ant-design/icons";
import bgImage from "../../assets/bgemb.webp";
import axiosInstance from "../../api/axiosInstance";
import { generateDTRPdf } from "../../../utils/generateDTRpdf";
import { fetchPhilippineHolidays } from "../../api/holidayPH";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import "./requestdtrclient.css";

dayjs.extend(utc);
dayjs.extend(timezone);

const { Title, Text } = Typography;

const RequestDTRClient = () => {
  const [form] = Form.useForm();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [previewMeta, setPreviewMeta] = useState({
    employee: null,
    startDate: null,
    endDate: null,
    selectedRecord: null,
  });
  const [previewLoading, setPreviewLoading] = useState(false);
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

  // Load published DTR cut-offs (biometrics encoded coverage)
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setCutoffsLoading(true);
        const { data } = await axiosInstance.get("/dtrdatas");
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

  const columns = useMemo(
    () => [
      {
        title: "Date",
        dataIndex: "date",
        key: "date",
        width: 90,
        onCell: () => ({ className: "date-cell" }),
      },
      {
        title: "Time In",
        dataIndex: "timeIn",
        key: "timeIn",
        width: 70,
        render: (value, record) =>
          record.isMergeRow ? record.status || "" : value,
        onCell: (record) =>
          record.isMergeRow
            ? {
                colSpan: 5, // span across Break Out, Break In, Time Out, Work Status
                style: {
                  background: "#f5f5f5",
                  textAlign: "center",
                  fontWeight: 500,
                },
              }
            : { className: "time-cell" },
      },
      {
        title: "Break Out",
        dataIndex: "breakOut",
        key: "breakOut",
        width: 70,
        onCell: (record) =>
          record.isMergeRow ? { colSpan: 0 } : { className: "time-cell" },
      },
      {
        title: "Break In",
        dataIndex: "breakIn",
        key: "breakIn",
        width: 70,
        onCell: (record) =>
          record.isMergeRow ? { colSpan: 0 } : { className: "time-cell" },
      },
      {
        title: "Time Out",
        dataIndex: "timeOut",
        key: "timeOut",
        width: 70,
        onCell: (record) =>
          record.isMergeRow ? { colSpan: 0 } : { className: "time-cell" },
      },
      {
        title: "Work Status",
        dataIndex: "status",
        key: "status",
        width: 160,
        onCell: (record) => (record.isMergeRow ? { colSpan: 0 } : {}),
      },
    ],
    []
  );

  const onFinish = async (values) => {
    try {
      // Open modal immediately with a loading indicator
      setPreviewRows([]);
      setPreviewMeta({
        employee: null,
        startDate: null,
        endDate: null,
        selectedRecord: null,
      });
      setPreviewLoading(true);
      setPreviewOpen(true);

      const [startDate, endDate] = values.dateRange;

      // 1. Check for DTR data/logs availability (graceful fallback on error)
      let isAvailable = true;
      try {
        const checkResponse = await axiosInstance.get("/dtrdatas/check", {
          params: {
            startDate: startDate.format("YYYY-MM-DD"),
            endDate: endDate.format("YYYY-MM-DD"),
            empId: values.employeeId,
          },
        });
        const d = checkResponse?.data?.data || {};
        isAvailable = !!d.available;
      } catch (e) {
        // Proceed anyway; we'll use the requested range as the selected record
        isAvailable = true;
        // Non-blocking notice for admins; suppressed for public UX
        try {
          message.warning(
            "Couldn't verify DTR cutoff, proceeding with selected range."
          );
        } catch (_) {}
      }

      if (!isAvailable) {
        setPreviewOpen(false);
        setPreviewLoading(false);
        message.error("DTR for that cut off is not yet available.");
        return;
      }

      // Use the user's requested range as the selected cut-off to ensure the PDF reflects it,
      // regardless of how DTRData records are segmented (e.g., 1-15 and 16-30).
      const selectedRecord = {
        DTR_Cut_Off: {
          // Store as date-only to avoid timezone drift in PDF
          start: startDate.format("YYYY-MM-DD"),
          end: endDate.format("YYYY-MM-DD"),
        },
      };

      // 2. Fetch employee data
      const employeeResponse = await axiosInstance.get(
        `/employees/by-emp-id/${encodeURIComponent(values.employeeId)}`
      );
      const employee = employeeResponse.data.data;

      // 3. Fetch DTR logs for the selected employee and date range
      const dtrLogsResponse = await axiosInstance.get(`/dtrlogs/merged`, {
        params: {
          startDate: startDate.format("YYYY-MM-DD"),
          endDate: endDate.format("YYYY-MM-DD"),
          empIds: employee.empId,
        },
      });
      const dtrLogs = dtrLogsResponse.data?.data || [];

      // Group logs by date (Asia/Manila)
      const logsByDate = dtrLogs.reduce((acc, log) => {
        const dateKey = dayjs(log.time).tz("Asia/Manila").format("YYYY-MM-DD");
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(log);
        return acc;
      }, {});

      // 3.5 Fetch Holidays (PH + Local), Suspensions, Trainings
      let trainings = [];
      try {
        const res = await axiosInstance.get(
          `/trainings/public/by-employee/${encodeURIComponent(employee.empId)}`
        );
        trainings = res.data?.data || [];
      } catch (_) {
        trainings = [];
      }
      const startStr = startDate.format("YYYY-MM-DD");
      const endStr = endDate.format("YYYY-MM-DD");
      let localHolidays = [];
      let suspensions = [];
      try {
        const [lhRes, sRes] = await Promise.all([
          axiosInstance.get(`/local-holidays/public`, {
            params: { start: startStr, end: endStr },
          }),
          axiosInstance.get(`/suspensions/public`, {
            params: { start: startStr, end: endStr },
          }),
        ]);
        localHolidays = (lhRes.data?.data || []).map((h) => ({
          date: dayjs(h.date).format("YYYY-MM-DD"),
          endDate: h.endDate ? dayjs(h.endDate).format("YYYY-MM-DD") : null,
          name: h.name,
          type: "Local Holiday",
        }));
        suspensions = (sRes.data?.data || []).map((s) => ({
          date: dayjs(s.date).format("YYYY-MM-DD"),
          endDate: s.endDate ? dayjs(s.endDate).format("YYYY-MM-DD") : null,
          name: s.title,
          type: "Suspension",
        }));
      } catch (_) {}

      const yearStart = startDate.year();
      const yearEnd = endDate.year();
      let holidaysPH = [];
      try {
        const h1 = await fetchPhilippineHolidays(yearStart);
        holidaysPH = h1 || [];
        if (yearEnd !== yearStart) {
          const h2 = await fetchPhilippineHolidays(yearEnd);
          holidaysPH = [...holidaysPH, ...(h2 || [])];
        }
      } catch (_) {
        holidaysPH = [];
      }
      const allHolidays = [
        ...holidaysPH.map((h) => ({
          date: h.date,
          name: h.localName,
          type: h.type,
        })),
        ...localHolidays,
        ...suspensions,
      ];

      const hasHolidayOn = (dateKey) =>
        allHolidays.some((h) => {
          const start = h.date || null;
          const end = h.endDate || null;
          if (start && end) {
            return (
              dayjs(dateKey).isSameOrAfter(start, "day") &&
              dayjs(dateKey).isSameOrBefore(end, "day")
            );
          }
          return start === dateKey;
        });

      const getHolidayName = (dateKey) => {
        const found = allHolidays.find((h) => {
          const start = h.date || null;
          const end = h.endDate || null;
          if (start && end) {
            return (
              dayjs(dateKey).isSameOrAfter(start, "day") &&
              dayjs(dateKey).isSameOrBefore(end, "day")
            );
          }
          return start === dateKey;
        });
        if (!found) return "";
        return found.type === "Suspension"
          ? `Suspension: ${found.name}`
          : found.name || "Holiday";
      };

      const getTrainingOnDay = (dateKey) => {
        return trainings.find((t) => {
          if (!t.trainingDate || t.trainingDate.length < 2) return false;
          const start = dayjs(t.trainingDate[0]).format("YYYY-MM-DD");
          const end = dayjs(t.trainingDate[1]).format("YYYY-MM-DD");
          return (
            dayjs(dateKey).isSameOrAfter(start, "day") &&
            dayjs(dateKey).isSameOrBefore(end, "day")
          );
        });
      };

      // Build full date rows for the selected range
      const totalDays =
        endDate.startOf("day").diff(startDate.startOf("day"), "day") + 1;
      const rows = Array.from({ length: totalDays }).map((_, idx) => {
        const date = startDate.startOf("day").add(idx, "day");
        const key = date.tz("Asia/Manila").format("YYYY-MM-DD");
        const dayLogs = (logsByDate[key] || []).map((l) => ({
          time: dayjs(l.time).tz("Asia/Manila"),
          state: l.state,
        }));
        const dayOfWeek = date.tz("Asia/Manila").day();
        const training = getTrainingOnDay(key);
        const holidayName = getHolidayName(key);

        // Selection rules
        const timeInCandidates = dayLogs
          .filter((l) => l.state === "C/In" && l.time.hour() < 12)
          .sort((a, b) => a.time.valueOf() - b.time.valueOf());

        const timeOutCandidates = dayLogs
          .filter((l) => l.state === "C/Out" && l.time.hour() >= 12)
          .sort((a, b) => a.time.valueOf() - b.time.valueOf());

        const breakOutCandidates = dayLogs
          .filter(
            (l) =>
              l.state === "Out" && l.time.hour() >= 12 && l.time.hour() < 13
          )
          .sort((a, b) => a.time.valueOf() - b.time.valueOf());

        const breakInCandidates = dayLogs
          .filter(
            (l) =>
              l.state === "Out Back" &&
              l.time.hour() >= 12 &&
              l.time.hour() < 14
          )
          .sort((a, b) => a.time.valueOf() - b.time.valueOf());

        let timeIn = timeInCandidates.length
          ? timeInCandidates[0].time.format("h:mm")
          : "";
        let timeOut = timeOutCandidates.length
          ? timeOutCandidates[timeOutCandidates.length - 1].time.format("h:mm")
          : "";
        let breakOut = breakOutCandidates.length
          ? breakOutCandidates[0].time.format("h:mm")
          : "";
        let breakIn = breakInCandidates.length
          ? breakInCandidates[0].time.format("h:mm")
          : "";

        // Default lunch if Time In and Time Out exist but no break times
        if (timeIn && timeOut && !breakOut && !breakIn) {
          breakOut = "12:00";
          breakIn = "1:00";
        }

        let status = "";
        if (training)
          status = `${training.name}${
            training.iisTransaction ? ` (${training.iisTransaction})` : ""
          }`;
        else if (holidayName) status = holidayName;
        else if (dayOfWeek === 0) status = "Sunday";
        else if (dayOfWeek === 6) status = "Saturday";

        const hasLogs = Boolean(timeIn || timeOut || breakOut || breakIn);
        const isMergeRow = !hasLogs && Boolean(status);

        return {
          key,
          date: date.format("MM/DD/YYYY"),
          timeIn: timeIn || "---",
          breakOut: breakOut || "---",
          breakIn: breakIn || "---",
          timeOut: timeOut || "---",
          status,
          hasLogs,
          isMergeRow,
        };
      });

      const hasAnyBiometrics = Object.keys(logsByDate).length > 0;

      if (!hasAnyBiometrics) {
        setPreviewOpen(false);
        setPreviewLoading(false);
        Modal.info({
          title: "No Biometrics Found",
          content:
            "There is no biometrics encoded yet for the selected period.",
        });
        return;
      }

      // Open preview modal in DTR style
      setPreviewRows(rows);
      setPreviewMeta({ employee, startDate, endDate, selectedRecord });
      setPreviewLoading(false);
    } catch (error) {
      setPreviewOpen(false);
      setPreviewLoading(false);
      message.error("An error occurred while processing your request.");
      console.error("DTR request error:", error);
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
              label="Employee ID"
              name="employeeId"
              rules={[{ required: true, message: "Employee ID is required" }]}
            >
              <AutoComplete
                options={empOptions}
                onSearch={handleEmpSearch}
                placeholder="Enter your Employee ID (e.g. 03-0946)"
                allowClear
                notFoundContent={empSearching ? "Searching…" : "No matches"}
                filterOption={false}
                getPopupContainer={(trigger) => trigger.parentNode}
              />
            </Form.Item>

            <Form.Item
              label="Date Range"
              name="dateRange"
              rules={[
                { required: true, message: "Please select a date range" },
              ]}
              className="responsive-range-picker-item"
            >
              <DatePicker.RangePicker
                style={{ width: "100%" }}
                placeholder={["Start date", "End date"]}
                getPopupContainer={(trigger) => trigger.parentNode}
                popupClassName="mobile-friendly-range-picker"
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
                className="fixed-primary-btn"
              >
                Submit Request
              </Button>
            </Form.Item>
          </Form>

          <Modal
            title={
              previewMeta?.employee
                ? `DTR Preview - ${previewMeta.employee.name} (${previewMeta.employee.empId})`
                : "DTR Preview"
            }
            open={previewOpen}
            onCancel={() => setPreviewOpen(false)}
            className="dtr-preview-modal"
            footer={[
              <Button key="close" onClick={() => setPreviewOpen(false)}>
                Close
              </Button>,
              <Button
                key="download"
                type="primary"
                disabled={previewLoading}
                onClick={async () => {
                  try {
                    const { employee, startDate, endDate, selectedRecord } =
                      previewMeta || {};
                    // Reconstruct dtrLogs map for PDF util from previewRows
                    const map = {};
                    previewRows.forEach((r) => {
                      const k = dayjs(r.date, "MM/DD/YYYY").format(
                        "YYYY-MM-DD"
                      );
                      map[k] = {
                        "Time In": r.timeIn !== "---" ? r.timeIn : undefined,
                        "Break Out":
                          r.breakOut !== "---" ? r.breakOut : undefined,
                        "Break In": r.breakIn !== "---" ? r.breakIn : undefined,
                        "Time Out": r.timeOut !== "---" ? r.timeOut : undefined,
                      };
                    });
                    const dtrLogsForPdf = { [employee.empId]: map };
                    await generateDTRPdf({
                      employee,
                      dtrLogs: dtrLogsForPdf,
                      selectedRecord,
                    });
                    // Log generation and notify (best-effort)
                    try {
                      await axiosInstance.post("/dtr/log-generation", {
                        employeeId: employee.empId,
                        period: `${startDate.format(
                          "YYYY-MM-DD"
                        )} to ${endDate.format("YYYY-MM-DD")}`,
                        generatedBy: form.getFieldValue("email"),
                      });
                    } catch (_) {}
                    message.success("DTR generated successfully!");
                  } catch (e) {
                    message.error("Failed to generate DTR PDF");
                  }
                }}
              >
                Download PDF
              </Button>,
            ]}
            width={640}
          >
            {previewLoading ? (
              <div style={{ padding: 16 }}>
                <Skeleton active paragraph={{ rows: 6 }} />
              </div>
            ) : (
              <Space direction="vertical" style={{ width: "100%" }}>
                <div>
                  <strong>Period: </strong>
                  {previewMeta.startDate && previewMeta.endDate
                    ? `${previewMeta.startDate.format(
                        "MM/DD/YYYY"
                      )} - ${previewMeta.endDate.format("MM/DD/YYYY")}`
                    : ""}
                </div>
                <Table
                  size="small"
                  className="dtr-table-compact"
                  columns={columns}
                  dataSource={previewRows}
                  pagination={false}
                  bordered
                  style={{ fontSize: 10 }}
                />
              </Space>
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

import React, { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Spin, Alert, Modal, Popover, Table } from "antd";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
  FaSignInAlt,
  FaSignOutAlt,
  FaUtensils,
  FaCoffee,
} from "react-icons/fa";
import axiosInstance from "../../../../../api/axiosInstance";
import { fetchPhilippineHolidays } from "../../../../../api/holidayPH";
import useDemoMode from "../../../../../hooks/useDemoMode";
import DailyLogsTable from "./DailyLogsTable";
import "./WorkCalendar.css";

dayjs.extend(utc);
dayjs.extend(timezone);

const WorkCalendar = ({ employee }) => {
  const [logs, setLogs] = useState([]);
  const [trainings, setTrainings] = useState([]);
  // Local (custom) holidays from backend
  const [holidays, setHolidays] = useState([]);
  // National public holidays from external API (Nager)
  const [nationalHolidays, setNationalHolidays] = useState([]);
  const [suspensions, setSuspensions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [selectedTraining, setSelectedTraining] = useState(null);
  const { isDemoActive } = useDemoMode();
  const demoDisabled = isDemoActive; // disable interactive actions in demo

  // Fetch logs
  useEffect(() => {
    if (!employee?.empId) return;

    const fetchLogs = async () => {
      try {
        setLoading(true);
        // Fetch all logs for the employee (no date filter) so navigating months shows historical records
        const res = await axiosInstance.get("/dtrlogs/work-calendar", {
          params: { employeeId: employee.empId },
        });
        setLogs(res.data.data || []);
      } catch (err) {
        setError(err.message || "Failed to fetch logs");
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [employee?.empId]);

  // Fetch trainings
  useEffect(() => {
    if (!employee?.empId) return;

    const fetchTrainings = async () => {
      try {
        const res = await axiosInstance.get(
          `/trainings/by-employee/${employee.empId}`
        );
        setTrainings(res.data.data || []);
      } catch (err) {
        console.error("Failed to fetch trainings:", err);
      }
    };

    fetchTrainings();
  }, [employee?.empId]);

  // Fetch local holidays (public endpoint)
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const res = await axiosInstance.get("/local-holidays/public");
        setHolidays(res.data.data || res.data || []);
      } catch (e) {
        // silent fail
      }
    };
    fetchHolidays();
  }, []);

  // Fetch national holidays (previous, current, next year for navigation safety)
  useEffect(() => {
    const loadNational = async () => {
      try {
        const currentYear = dayjs().year();
        const years = [currentYear - 1, currentYear, currentYear + 1];
        const all = await Promise.all(
          years.map((y) => fetchPhilippineHolidays(y))
        );
        // Flatten and dedupe by date
        const merged = all.flat();
        const byDate = new Map();
        merged.forEach((h) => {
          if (!byDate.has(h.date)) byDate.set(h.date, h);
        });
        setNationalHolidays(Array.from(byDate.values()));
      } catch (e) {
        // silent fail
        console.warn("Failed to load national holidays", e);
      }
    };
    loadNational();
  }, []);

  // Fetch suspensions (public endpoint)
  useEffect(() => {
    const fetchSuspensions = async () => {
      try {
        const res = await axiosInstance.get("/suspensions/public");
        // only active ones
        const data = (res.data.data || res.data || []).filter(
          (s) => s.active !== false
        );
        setSuspensions(data);
      } catch (e) {
        // silent fail
      }
    };
    fetchSuspensions();
  }, []);

  // Helper to group logs by day and compute summary (with default break times when Time In exists)
  const getDailySummary = (date) => {
    const target = dayjs(date).tz("Asia/Manila").format("YYYY-MM-DD");
    const dailyLogs = logs.filter(
      (l) => dayjs(l.time).tz("Asia/Manila").format("YYYY-MM-DD") === target
    );

    const fmt = (t) => dayjs(t).tz("Asia/Manila").format("h:mm A");
    const firstByState = (state) => {
      const found = dailyLogs.find((l) => l.state === state);
      return found ? fmt(found.time) : null;
    };

    const timeIn = firstByState("C/In");
    let breakOut = firstByState("Out");
    let breakIn = firstByState("Out Back");
    const timeOut = firstByState("C/Out");

    if (timeIn) {
      if (!breakOut) breakOut = "12:00 PM";
      if (!breakIn) breakIn = "1:00 PM";
    }

    return { timeIn, breakOut, breakIn, timeOut, rawLogs: dailyLogs };
  };

  // Build events for calendar
  const events = [];

  // Trainings
  trainings.forEach((t) => {
    if (t.trainingDate?.length >= 2) {
      events.push({
        id: t._id,
        title: t.name,
        start: dayjs(t.trainingDate[0]).format("YYYY-MM-DD"),
        end: dayjs(t.trainingDate[1]).add(1, "day").format("YYYY-MM-DD"),
        color: "#531dab", // deep purple
        extendedProps: { ...t, entryType: "training" },
      });
    }
  });

  // Local Holidays (support range via endDate) -> entryType 'holiday'
  holidays.forEach((h, idx) => {
    if (!h.date) return;
    const start = dayjs(h.date).format("YYYY-MM-DD");
    const isRange = !!h.endDate;
    const end = isRange
      ? dayjs(h.endDate).add(1, "day").format("YYYY-MM-DD")
      : dayjs(h.date).add(1, "day").format("YYYY-MM-DD");
    events.push({
      id: `holiday-${idx}`,
      title: h.name || h.location || "Local Holiday",
      start,
      end,
      allDay: true,
      color: "#ad6800",
      extendedProps: {
        entryType: "holiday",
        notes: h.notes,
        location: h.location,
      },
    });
  });

  // National Holidays (single day events from API) -> entryType 'nationalHoliday'
  nationalHolidays.forEach((h, idx) => {
    if (!h.date) return;
    const start = dayjs(h.date).format("YYYY-MM-DD");
    const end = dayjs(h.date).add(1, "day").format("YYYY-MM-DD");
    events.push({
      id: `nat-${idx}`,
      title: h.localName || h.name || "National Holiday",
      start,
      end,
      allDay: true,
      color: "#003a8c",
      extendedProps: { entryType: "nationalHoliday" },
    });
  });

  // Suspensions (support range via endDate)
  suspensions.forEach((s, idx) => {
    const start = dayjs(s.date).format("YYYY-MM-DD");
    const end = s.endDate
      ? dayjs(s.endDate).add(1, "day").format("YYYY-MM-DD")
      : dayjs(s.date).add(1, "day").format("YYYY-MM-DD");
    events.push({
      id: `susp-${idx}`,
      title: s.title || "Suspension",
      start,
      end,
      allDay: true,
      color: "#a8071a",
      extendedProps: { entryType: "suspension", scope: s.scope },
    });
  });

  // Logs — one event per day
  const uniqueDates = Array.from(
    new Set(
      logs.map((l) => dayjs(l.time).tz("Asia/Manila").format("YYYY-MM-DD"))
    )
  );
  uniqueDates.forEach((date, idx) => {
    events.push({
      id: `log-${idx}`,
      title: "",
      start: date,
      allDay: true,
      extendedProps: {
        dailySummary: getDailySummary(date),
        entryType: "workday",
      },
    });
  });

  
  // Render each cell with icons
  const RenderEventContent = ({ arg, onClick }) => {
    const summary = arg.event.extendedProps?.dailySummary;
    const isDarkMode =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const missingColor = isDarkMode ? "#ffd666" : "#fa8c16";

    if (summary) {
      const rows = [
        { label: "Time In", icon: <FaSignInAlt />, value: summary.timeIn },
        { label: "Break Out", icon: <FaUtensils />, value: summary.breakOut },
        { label: "Break In", icon: <FaSignInAlt />, value: summary.breakIn },
        { label: "Time Out", icon: <FaSignOutAlt />, value: summary.timeOut },
      ];

      return (
        <Popover
          content={
            <div style={{ fontSize: "11px", lineHeight: "1.2" }}>
              {rows.map((r) => (
                <div
                  key={r.label}
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  {r.icon} {r.label}:{" "}
                  <span style={{ color: r.value ? "inherit" : missingColor }}>
                    {r.value || "Missing"}
                  </span>
                </div>
              ))}
            </div>
          }
          trigger="hover"
        >
          <div
            style={{ fontSize: "11px", lineHeight: "1.2", cursor: "pointer" }}
            onClick={() => onClick(summary)}
          >
            {rows.map((r) => (
              <div
                key={r.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  color: r.value ? "inherit" : missingColor,
                }}
              >
                {r.icon} {r.label}: {r.value || "?"}
              </div>
            ))}
          </div>
        </Popover>
      );
    }

    // Training events
    if (arg.event.extendedProps?.entryType === "training") {
      return (
        <div
          style={{
            fontSize: "10px",
            lineHeight: "1.1",
            whiteSpace: "normal",
            wordBreak: "break-word",
            overflowWrap: "break-word",
            background: "#391085",
            color: "#fff",
            padding: 2,
          }}
        >
          {arg.event.title} ({arg.event.extendedProps?.venue || "TBA"})
        </div>
      );
    }

    if (arg.event.extendedProps?.entryType === "nationalHoliday") {
      return (
        <div
          style={{
            fontSize: 9, // reduced to align with other pill styles
            fontWeight: 400,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            width: "100%",
            textAlign: "center",
            lineHeight: 1.2,
            whiteSpace: "normal",
            wordBreak: "break-word",
            overflowWrap: "break-word",
            hyphens: "auto",
            padding: "2px",
            letterSpacing: "0.5px",
            pointerEvents: "none",
            background: "#003a8c",
          }}
        >
          {arg.event.title}
        </div>
      );
    }

    if (arg.event.extendedProps?.entryType === "holiday") {
      return (
        <div
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            width: "100%",
            textAlign: "center",
            lineHeight: 1.2,
            whiteSpace: "normal",
            wordBreak: "break-word",
            overflowWrap: "break-word",
            hyphens: "auto",
            padding: "2px",
            pointerEvents: "none",
            background: "#ad6800",
            
          }}
        >
          {arg.event.title}
        </div>
      );
    }

    if (arg.event.extendedProps?.entryType === "suspension") {
      return (
        <div
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            width: "100%",
            textAlign: "center",
            lineHeight: 1.2,
            whiteSpace: "normal",
            wordBreak: "break-word",
            overflowWrap: "break-word",
            hyphens: "auto",
            padding: "2px",
            pointerEvents: "none",
            background: "#a8071a",
           
          }}
        >
          {arg.event.title}
        </div>
      );
    }

    return null;
  };

  // Handle click
  const handleEventClick = (info) => {
    if (info.event.extendedProps?.dailySummary) {
      setSelectedLog(info.event.extendedProps.dailySummary);
    } else if (info.event.extendedProps?.host) {
      setSelectedTraining(info.event.extendedProps);
    }
  };

  return (
    <div className="work-calendar">
      {loading ? (
        <Spin size="large" />
      ) : error ? (
        <Alert type="error" message={error} />
      ) : (
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,dayGridWeek,timeGridDay",
          }}
          events={events}
          eventClick={handleEventClick}
          height="auto"
          dayCellDidMount={(info) => {
            const dow = dayjs(info.date).day();
            if (dow === 0 || dow === 6) {
              const isDark =
                typeof window !== "undefined" &&
                window.matchMedia &&
                window.matchMedia("(prefers-color-scheme: dark)").matches;
              // Use subtle tinted backgrounds depending on theme
              info.el.style.backgroundColor = isDark ? "#1f1f1f" : "#fafafa";
              info.el.style.color = isDark ? "#e8e8e8" : "#000";
            }
          }}
          eventContent={(arg) => (
            <RenderEventContent
              arg={arg}
              onClick={(summary) => setSelectedLog(summary)} // now opens DailyLogsTable modal
            />
          )}
        />
      )}

      {/* Log Modal */}
      <Modal
        title="Employee Daily Record"
        open={!!selectedLog}
        onCancel={() => setSelectedLog(null)}
        footer={null}
        width={700}
      >
        {selectedLog && (
          <DailyLogsTable
            dailySummary={selectedLog}
            onRequestJustification={(record) => {
              if (demoDisabled) {
                return; // suppress in demo
              }
              console.log("Request justification for:", record);
            }}
          />
        )}
      </Modal>

      {/* Training Modal */}
      <Modal
        title={selectedTraining?.name}
        open={!!selectedTraining}
        onCancel={() => setSelectedTraining(null)}
        footer={null}
        width={800}
      >
        {selectedTraining && (
          <div>
            <p>
              <strong>Host:</strong> {selectedTraining.host}
            </p>
            <p>
              <strong>Venue:</strong> {selectedTraining.venue}
            </p>
            <p>
              <strong>Date:</strong>{" "}
              {dayjs(selectedTraining.trainingDate[0]).format("MMM D, YYYY")} -{" "}
              {dayjs(selectedTraining.trainingDate[1]).format("MMM D, YYYY")}
            </p>
            <p>
              <strong>Transaction:</strong> {selectedTraining.iisTransaction}
            </p>

            <p>
              <strong>Participants:</strong>
            </p>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "11px",
                lineHeight: "1.2",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      border: "1px solid #ddd",
                      padding: "4px",
                      width: "30%",
                    }}
                  >
                    Name
                  </th>
                  <th style={{ border: "1px solid #ddd", padding: "4px" }}>
                    Division
                  </th>
                  <th style={{ border: "1px solid #ddd", padding: "4px" }}>
                    Section/Unit
                  </th>
                </tr>
              </thead>
              <tbody>
                {selectedTraining.participants
                  ?.sort((a, b) => a.name.localeCompare(b.name))
                  .map((p) => (
                    <tr key={p.empId}>
                      <td style={{ border: "1px solid #ddd", padding: "4px" }}>
                        {p.name}
                      </td>
                      <td style={{ border: "1px solid #ddd", padding: "4px" }}>
                        {p.division}
                      </td>
                      <td style={{ border: "1px solid #ddd", padding: "4px" }}>
                        {p.sectionOrUnit || "-"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default WorkCalendar;

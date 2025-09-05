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
import DailyLogsTable from "./DailyLogsTable";

dayjs.extend(utc);
dayjs.extend(timezone);

const WorkCalendar = ({ employee }) => {
  const [logs, setLogs] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [selectedTraining, setSelectedTraining] = useState(null);

  // Fetch logs
  useEffect(() => {
    if (!employee?.empId) return;

    const fetchLogs = async () => {
      try {
        setLoading(true);
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

  // Helper to group logs by day and compute summary
  const getDailySummary = (date) => {
    const dailyLogs = logs.filter(
      (l) =>
        dayjs(l.time).tz("Asia/Manila").format("YYYY-MM-DD") ===
        dayjs(date).tz("Asia/Manila").format("YYYY-MM-DD")
    );

    const timeIn = dailyLogs.find((l) => l.state.includes("In"))?.time
      ? dayjs(dailyLogs.find((l) => l.state.includes("In")).time)
          .tz("Asia/Manila")
          .format("hh:mm A")
      : null;

    const timeOut = dailyLogs.find((l) => l.state.includes("Out"))?.time
      ? dayjs(dailyLogs.find((l) => l.state.includes("Out")).time)
          .tz("Asia/Manila")
          .format("hh:mm A")
      : null;

    const breakOut = dailyLogs.find((l) => l.state.includes("Break Out"))?.time
      ? dayjs(dailyLogs.find((l) => l.state.includes("Break Out")).time)
          .tz("Asia/Manila")
          .format("hh:mm A")
      : "12:00 PM"; // default

    const breakIn = dailyLogs.find((l) => l.state.includes("Break In"))?.time
      ? dayjs(dailyLogs.find((l) => l.state.includes("Break In")).time)
          .tz("Asia/Manila")
          .format("hh:mm A")
      : "01:00 PM"; // default

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
        color: "#722ed1",
        extendedProps: { ...t },
      });
    }
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
      extendedProps: { dailySummary: getDailySummary(date) },
    });
  });

  // Render each cell with icons
  const RenderEventContent = ({ arg, onClick }) => {
    const summary = arg.event.extendedProps?.dailySummary;

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
                  <span style={{ color: r.value ? "inherit" : "yellow" }}>
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
                  color: r.value ? "inherit" : "yellow",
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
    if (arg.event.extendedProps?.host) {
      return (
        <div
          style={{
            fontSize: "10px", // smaller font
            lineHeight: "1.1", // tighter
            whiteSpace: "normal", // allow wrapping
            wordBreak: "break-word",
            overflowWrap: "break-word",
          }}
        >
          {arg.event.title} ({arg.event.extendedProps?.venue || "TBA"})
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
    <div>
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
              console.log("Request justification for:", record);
              // You can open another modal here or call your API
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

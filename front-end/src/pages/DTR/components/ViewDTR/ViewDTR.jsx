import React from "react";
import useDemoMode from "../../../../hooks/useDemoMode";
import { Modal, Table, Typography, Divider, Button, message, Spin, Tooltip } from "antd";
import dayjs from "dayjs";
import "./viewdtr.css";
import axios from "axios";
import axiosInstance from "../../../../api/axiosInstance";
import { generateDTRPdf } from "../../../../../utils/generateDTRpdf";

const { Text } = Typography;

// Fetch trainings for a specific employee and date
const getTrainingOnDay = async (empId, dateKey) => {
  try {
    const res = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL}/trainings/by-employee/${empId}`
    );
    const trainings = res.data.data || [];

    const trainingsOnDay = trainings.filter((t) => {
      if (!t.trainingDate || t.trainingDate.length < 2) return false;
      const start = dayjs(t.trainingDate[0]);
      const end = dayjs(t.trainingDate[1]);
      const day = dayjs(dateKey);
      return day.isSameOrAfter(start, "day") && day.isSameOrBefore(end, "day");
    });

    if (trainingsOnDay.length === 0) return null;

    const mergedName = trainingsOnDay
      .map(
        (t) =>
          `${t.name}${t.iisTransaction ? " (" + t.iisTransaction + ")" : ""}`
      )
      .join(", ");

    return { mergedName };
  } catch {
    return null;
  }
};

const ViewDTR = ({
  visible,
  onClose,
  employee,
  dtrDays,
  dtrLogs,
  selectedRecord,
  holidaysPH = [],
  onPreviewForm48,
  onSaveToTray,
}) => {
  const { readOnly, isDemoActive, isDemoUser } = useDemoMode();
  if (!employee || !selectedRecord) return null;

  const startDate = dayjs(selectedRecord.DTR_Cut_Off.start);
  const endDate = dayjs(selectedRecord.DTR_Cut_Off.end);
  const dateRangeStr = `${startDate.format("MMMM D, YYYY")} - ${endDate.format(
    "MMMM D, YYYY"
  )}`;

  const [tableData, setTableData] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    //console.log("ViewDTR: holidaysPH prop received:", holidaysPH);
    let current = startDate.clone();
    const ids = [employee.empId, ...(employee.alternateEmpIds || [])].filter(
      Boolean
    );

    const fetchRows = async () => {
      setLoading(true);
      const rows = [];
      const trainingsCache = {};

      // Build a holiday/suspension lookup map; expand ranges
      const holidayMap = {};
      holidaysPH.forEach((h) => {
        const start = dayjs(h.date);
        const end = h.endDate ? dayjs(h.endDate) : start;
        let d = start.clone();
        const label = h.type === 'Suspension' ? `Suspension: ${h.name}` : (h.name || 'Holiday');
        while (d.isSameOrBefore(end, 'day')) {
          holidayMap[d.format('YYYY-MM-DD')] = label;
          d = d.add(1, 'day');
        }
      });
      //console.log("ViewDTR: holidayMap generated:", holidayMap);

      while (current.isBefore(endDate) || current.isSame(endDate, "day")) {
        const dayOfWeek = current.day();
        const dateKey = current.format("YYYY-MM-DD");

        // Removed STATE_LABELS as it's no longer used for time plotting

        function getDayLog(dObj) {
          const dateKey = dObj.format("YYYY-MM-DD");
          const idsToCheck = [
            employee.empId,
            ...(employee.alternateEmpIds || []),
            employee.empNo,
          ].filter(Boolean);

          let rawLogsForDay = [];

          // Collect logs from dtrLogs object structure
          for (let id of idsToCheck) {
            for (let len of [4, 5, 6]) {
              const empKey = id.replace(/\D/g, "").slice(-len);
              if (dtrLogs[empKey] && dtrLogs[empKey][dateKey]) {
                const dayData = dtrLogs[empKey][dateKey];
                // Assuming dayData can be an object with "Time In", "Break Out", etc. or an array of raw logs
                if (Array.isArray(dayData)) {
                  dayData.forEach(logEntry => {
                    if (logEntry.Time && dayjs(logEntry.Time).isValid()) {
                      rawLogsForDay.push(dayjs(logEntry.Time));
                    }
                  });
                } else if (typeof dayData === 'object') {
                  // If it's already processed into "Time In", "Break Out" etc., extract those times
                  if (dayData["Time In"]) rawLogsForDay.push(dayjs(dayData["Time In"], "hh:mm A"));
                  if (dayData["Break Out"]) rawLogsForDay.push(dayjs(dayData["Break Out"], "hh:mm A"));
                  if (dayData["Break In"]) rawLogsForDay.push(dayjs(dayData["Break In"], "hh:mm A"));
                  if (dayData["Time Out"]) rawLogsForDay.push(dayjs(dayData["Time Out"], "hh:mm A"));
                }
              }
            }
            if (dtrLogs[id] && dtrLogs[id][dateKey]) {
                const dayData = dtrLogs[id][dateKey];
                if (Array.isArray(dayData)) {
                  dayData.forEach(logEntry => {
                    if (logEntry.Time && dayjs(logEntry.Time).isValid()) {
                      rawLogsForDay.push(dayjs(logEntry.Time));
                    }
                  });
                } else if (typeof dayData === 'object') {
                  if (dayData["Time In"]) rawLogsForDay.push(dayjs(dayData["Time In"], "hh:mm A"));
                  if (dayData["Break Out"]) rawLogsForDay.push(dayjs(dayData["Break Out"], "hh:mm A"));
                  if (dayData["Break In"]) rawLogsForDay.push(dayjs(dayData["Break In"], "hh:mm A"));
                  if (dayData["Time Out"]) rawLogsForDay.push(dayjs(dayData["Time Out"], "hh:mm A"));
                }
            }
          }

          // Fallback for employee name search (less efficient, but for completeness)
          if (employee.name) {
            const nameKeywords = employee.name
              .replace(/[.,]/g, "")
              .toLowerCase()
              .split(" ")
              .filter((kw) => kw.length > 2);

            for (const key in dtrLogs) {
              if (dtrLogs[key][dateKey]) {
                const logName =
                  dtrLogs[key].employeeName ||
                  dtrLogs[key].name ||
                  dtrLogs[key].Name ||
                  key;
                if (
                  logName &&
                  nameKeywords.every((kw) => logName.toLowerCase().includes(kw))
                ) {
                  const dayData = dtrLogs[key][dateKey];
                  if (Array.isArray(dayData)) {
                    dayData.forEach(logEntry => {
                      if (logEntry.Time && dayjs(logEntry.Time).isValid()) {
                        rawLogsForDay.push(dayjs(logEntry.Time));
                      }
                    });
                  } else if (typeof dayData === 'object') {
                    if (dayData["Time In"]) rawLogsForDay.push(dayjs(dayData["Time In"], "hh:mm A"));
                    if (dayData["Break Out"]) rawLogsForDay.push(dayjs(dayData["Break Out"], "hh:mm A"));
                    if (dayData["Break In"]) rawLogsForDay.push(dayjs(dayData["Break In"], "hh:mm A"));
                    if (dayData["Time Out"]) rawLogsForDay.push(dayjs(dayData["Time Out"], "hh:mm A"));
                  }
                }
              }
            }
          }

          // If dtrLogs is an array (raw logs from backend)
          if (Array.isArray(dtrLogs)) {
            const logsForDayArray = dtrLogs.filter((log) => {
              const logDate = dayjs(log.time).format("YYYY-MM-DD");
              if (logDate !== dateKey) return false;
              const acNo = String(log["AC-No"] || "").replace(/\D/g, "");
              if (
                idsToCheck.some((id) => acNo === id.replace(/\D/g, "")) ||
                (employee.name &&
                  log.Name &&
                  employee.name
                    .replace(/[.,]/g, "")
                    .toLowerCase()
                    .split(" ")
                    .filter((kw) => kw.length > 2)
                    .every((kw) => log.Name.toLowerCase().includes(kw)))
              ) {
                return true;
              }
              return false;
            });

            logsForDayArray.forEach((log) => {
              if (log.Time && dayjs(log.Time).isValid()) {
                rawLogsForDay.push(dayjs(log.Time));
              }
            });
          }

          // Filter out invalid dayjs objects and sort all collected times
          rawLogsForDay = rawLogsForDay.filter(d => d.isValid()).sort((a, b) => a.diff(b));

          const dayLog = {};
          if (rawLogsForDay.length > 0) {
            // Time In: First punch of the day
            dayLog["Time In"] = rawLogsForDay[0].format("h:mm");

            // Time Out: Last punch of the day
            if (rawLogsForDay.length > 1) {
              dayLog["Time Out"] = rawLogsForDay[rawLogsForDay.length - 1].format("h:mm");
            }

            // Break Out and Break In: Look for punches around lunch time
            // Assuming lunch break is typically between 11 AM and 2 PM
            const lunchPunches = rawLogsForDay.filter(
              (time) => time.hour() >= 11 && time.hour() < 14
            );

            if (lunchPunches.length >= 2) {
              // First punch in lunch window is Break Out
              dayLog["Break Out"] = lunchPunches[0].format("h:mm");
              // Last punch in lunch window is Break In
              dayLog["Break In"] = lunchPunches[lunchPunches.length - 1].format("h:mm");
            } else if (lunchPunches.length === 1) {
                // If only one punch in lunch window, it could be either break out or break in
                // This is a heuristic, might need refinement based on actual data patterns
                if (lunchPunches[0].hour() < 12) { // Before noon, likely Break Out
                    dayLog["Break Out"] = lunchPunches[0].format("h:mm");
                } else { // After noon, likely Break In
                    dayLog["Break In"] = lunchPunches[0].format("h:mm");
                }
            }
          }
          
          return Object.keys(dayLog).length > 0 ? dayLog : null;
        }

        const dayLog = getDayLog(current);
        const training = await getTrainingOnDay(employee.empId, dateKey);
        trainingsCache[dateKey] = training ? training.mergedName : null;

        // Check if holiday
  const holidayLabel = holidayMap[dateKey] || "";
        const isHoliday = !!holidayLabel;
        //console.log(`ViewDTR: Date ${dateKey}, isHoliday: ${isHoliday}, holidayLabel: ${holidayLabel}`);


        // Auto-fill (these are heuristics and might need adjustment based on business rules)
        let timeIn = dayLog?.["Time In"] || "";
        let breakOut = dayLog?.["Break Out"] || "";
        let breakIn = dayLog?.["Break In"] || "";
        let timeOut = dayLog?.["Time Out"] || "";

  // If there's a time in but no break out, assume 12:00 for break out
  if (timeIn && !breakOut) breakOut = "12:00";
  // If there's a time out but no break in, assume 1:00 for break in
  if (timeOut && !breakIn) breakIn = "1:00";

        rows.push({
          key: dateKey,
          date: current.format("MM/DD/YYYY"),
          timeIn,
          breakOut,
          breakIn,
          timeOut,
          status: "",
          isWeekend: (dayOfWeek === 6 || dayOfWeek === 0),
          weekendLabel: dayOfWeek === 6 ? "Saturday" : "Sunday",
          isHoliday: isHoliday,
          holidayLabel,
          isTraining: !!training && !dayLog,
          trainingLabel: training ? training.mergedName : "",
        });

        current = current.add(1, "day");
      }

      // Merge consecutive trainings
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].isTraining) {
          let span = 1;
          for (let j = i + 1; j < rows.length; j++) {
            if (rows[j].trainingLabel === rows[i].trainingLabel) {
              span++;
            } else break;
          }
          rows[i].trainingRowSpan = span;
          for (let k = 1; k < span; k++) rows[i + k].trainingRowSpan = 0;
        }
      }

      // Merge consecutive holidays
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].isHoliday) {
          let span = 1;
          for (let j = i + 1; j < rows.length; j++) {
            if (rows[j].holidayLabel === rows[i].holidayLabel) {
              span++;
            } else break;
          }
          rows[i].holidayRowSpan = span;
          for (let k = 1; k < span; k++) rows[i + k].holidayRowSpan = 0;
        }
      }

      setTableData(rows);
      setLoading(false);
    };

    fetchRows();
  }, [employee, dtrLogs, selectedRecord, holidaysPH]);

  const columns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 120,
    },
    {
      title: "AM",
      children: [
        {
          title: "Time In",
          dataIndex: "timeIn",
          key: "timeIn",
          width: 80,
          render: (text, record) => {
            if (record.isWeekend) {
              return {
                children: record.weekendLabel,
                props: {
                  colSpan: 5,
                  style: { textAlign: "center" },
                  className: "weekend-cell",
                },
              };
            }
            if (record.isHoliday) {
              return {
                children: record.holidayLabel,
                props: {
                  colSpan: 5,
                  style: {
                    textAlign: "center",
                  },
                  className: "holiday-cell",
                },
              };
            }
            if (record.isTraining) {
              return {
                children: record.trainingLabel,
                props: {
                  colSpan: 5,
                  style: {
                    textAlign: "center",
                  },
                  className: "training-cell",
                },
              };
            }
            return text;
          },
        },
        {
          title: "Break Out",
          dataIndex: "breakOut",
          key: "breakOut",
          width: 80,
          render: (_, record) =>
            record.isWeekend || record.isHoliday || record.isTraining
              ? { children: null, props: { colSpan: 0 } }
              : record.breakOut,
        },
      ],
    },
    {
      title: "PM",
      children: [
        {
          title: "Break In",
          dataIndex: "breakIn",
          key: "breakIn",
          width: 80,
          render: (_, record) =>
            record.isWeekend || record.isHoliday || record.isTraining
              ? { children: null, props: { colSpan: 0 } }
              : record.breakIn,
        },
        {
          title: "Time Out",
          dataIndex: "timeOut",
          key: "timeOut",
          width: 80,
          render: (_, record) =>
            record.isWeekend || record.isHoliday || record.isTraining
              ? { children: null, props: { colSpan: 0 } }
              : record.timeOut,
        },
      ],
    },
    {
      title: "Work Status",
      dataIndex: "status",
      key: "status",
      align: "center",
      width: 120,
      render: (_, record) =>
        record.isWeekend || record.isHoliday || record.isTraining
          ? { children: null, props: { colSpan: 0 } }
          : record.status,
    },
    {
      title: "Reminder",
      key: "reminder",
      align: "center",
      width: 140,
      render: (_, record) => {
        const hasEmail = Array.isArray(employee.emails) && employee.emails.length > 0;
        const noTimeRecord = !record.isWeekend && !record.isHoliday && !record.isTraining && !record.timeIn && !record.breakOut && !record.breakIn && !record.timeOut;
        const disabled = !hasEmail || !noTimeRecord;
        const reason = !hasEmail ? "Employee has no email on record" : (!noTimeRecord ? "Reminder available only for days with no time record" : "");
        const btn = (
          <Button
            size="small"
            type="default"
            disabled={disabled || (readOnly && isDemoActive && isDemoUser)}
            onClick={() => handleSendReminder(record)}
          >
            Send Reminder
          </Button>
        );
        return disabled ? <Tooltip title={reason}><span>{btn}</span></Tooltip> : btn;
      }
    }
  ];

  const handlePreviewForm48 = () => {
    generateDTRPdf({ employee, dtrDays, dtrLogs, selectedRecord });
  };

  const handleSaveToTray = () => {
    if (onSaveToTray) {
      onSaveToTray(employee, selectedRecord);
      message.success("DTR has been added to the Printer Tray!");
    }
  };

  const getMissingDates = () => {
    // Derive dates with no time record (non-weekend/holiday/training)
    return (tableData || [])
      .filter(r => !r.isWeekend && !r.isHoliday && !r.isTraining && !r.timeIn && !r.breakOut && !r.breakIn && !r.timeOut)
      .map(r => {
        // r.key is YYYY-MM-DD; prefer it, fallback to convert r.date
        if (r.key) return r.key;
        try {
          const [mm, dd, yyyy] = String(r.date).split('/')
          return `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
        } catch { return r.date; }
      });
  };

  const handleSendAllMissing = () => {
    const hasEmail = Array.isArray(employee.emails) && employee.emails.length > 0;
    if (!hasEmail) {
      message.warning("Employee has no email inputted yet.");
      return;
    }
    const missingDates = getMissingDates();
    if (!missingDates.length) {
      message.info("No missing time records for this cut-off.");
      return;
    }

    const start = dayjs(selectedRecord.DTR_Cut_Off.start).format("MMM D, YYYY");
    const end = dayjs(selectedRecord.DTR_Cut_Off.end).format("MMM D, YYYY");
    const periodLabel = `${start} - ${end}`;

    Modal.confirm({
      title: "Send Reminder for All Missing Days",
      width: 600,
      content: (
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          <p>
            This will send an email to <strong>{employee.emails[0]}</strong> listing all days with no time records for <strong>{periodLabel}</strong>.
          </p>
          <div style={{ marginTop: 8, padding: 12, background: "#fafafa", border: "1px solid #eee", borderRadius: 6 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Preview (first 15 days shown)</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {missingDates.slice(0,15).map(d => (
                <li key={d}>{dayjs(d).isValid() ? dayjs(d).format('MMMM D, YYYY') : d}</li>
              ))}
            </ul>
            {missingDates.length > 15 && (
              <div style={{ marginTop: 6, color: '#888' }}>+ {missingDates.length - 15} more…</div>
            )}
          </div>
        </div>
      ),
      okText: "Send Reminder",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await axiosInstance.post('/notifications/no-time-record/bulk', {
            employeeId: employee.empId,
            email: employee.emails[0],
            name: employee.name,
            dates: missingDates,
            periodLabel,
          });
          message.success("Bulk reminder sent");
        } catch (e) {
          message.error("Failed to send bulk reminder");
        }
      }
    });
  };

  const handleSendReminder = (row) => {
    const hasEmail = Array.isArray(employee.emails) && employee.emails.length > 0;
    if (!hasEmail) {
      message.warning("Employee has no email inputted yet.");
      return;
    }
    const dateStr = row?.key || row?.date; // key is YYYY-MM-DD; date is MM/DD/YYYY (display)
    const displayDate = row?.date || dateStr;
    const name = employee.name || "Employee";
    const empId = employee.empId;

    Modal.confirm({
      title: "Send No Time Record Reminder",
      content: (
        <div style={{ lineHeight: 1.6 }}>
          <p>
            This will send an email to <strong>{employee.emails[0]}</strong> notifying that there is no recorded time entry on <strong>{displayDate}</strong>.
          </p>
          <div style={{ marginTop: 8, padding: 12, background: "#fafafa", border: "1px solid #eee", borderRadius: 6 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Preview</div>
            <div style={{ fontSize: 13 }}>
              <p>Good day <strong>{name}</strong>{empId ? ` (ID: ${empId})` : ''},</p>
              <p>We noticed that there is <strong>no recorded time entry</strong> for <strong>{displayDate}</strong> in the Daily Time Record system.</p>
              <p>If you reported for duty on that date, please coordinate with HR or your immediate supervisor to update your record accordingly.</p>
              <p style={{ marginTop: 12 }}>Thank you,<br/>HR Unit, EMB Region III</p>
            </div>
          </div>
        </div>
      ),
      okText: "Send Reminder",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await axiosInstance.post("/notifications/no-time-record", {
            employeeId: empId,
            email: employee.emails[0],
            name,
            date: dateStr,
          });
          message.success("Reminder sent");
        } catch (e) {
          message.error("Failed to send reminder");
        }
      }
    });
  };

  return (
    <Modal
      title={null}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={750}
      className="view-dtr-modal"
    >
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Text strong>Employee Name: {employee.name}</Text>
          <Text style={{ textAlign: "left", marginRight: 30 }}>
            Employee ID: <Text strong>{employee.empId}</Text>
          </Text>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Text>Employee No.: {employee.empNo}</Text>
          <Text style={{ textAlign: "left", marginRight: 30 }}>
            Employee Type: {employee.empType}
          </Text>
        </div>

        <div>
          <Text>
            Division / Section: {employee.division}{" "}
            {employee.sectionOrUnit && `| ${employee.sectionOrUnit}`}
          </Text>
        </div>

        <div>
          <Text underline>DTR Cut-Off Date: {dateRangeStr}</Text>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div>
          {Array.isArray(employee.emails) && employee.emails.length > 0 ? (
            <Tooltip title="Send one email listing all days in this cut-off with no time records">
              <Button onClick={handleSendAllMissing} disabled={readOnly && isDemoActive && isDemoUser}>
                Send All Missing
              </Button>
            </Tooltip>
          ) : (
            <Tooltip title="Employee has no email on record">
              <span>
                <Button disabled>Send All Missing</Button>
              </span>
            </Tooltip>
          )}
        </div>
        <div>
          <Button type="primary" onClick={handlePreviewForm48} disabled={readOnly && isDemoActive && isDemoUser}>
            Preview DTR Form 48
          </Button>
        </div>
      </div>

      <Divider />

      {!Array.isArray(employee.emails) || employee.emails.length === 0 ? (
        <div style={{ marginBottom: 12 }}>
          <Typography.Text type="danger">Employee has no email on record. Send Reminder is disabled.</Typography.Text>
        </div>
      ) : null}

      <Spin spinning={loading} size="small" tip="Loading DTR data...">
        <Table
          dataSource={tableData}
          columns={columns}
          pagination={false}
          bordered
          size="small"
          scroll={{ x: 650 }}
          rowClassName={(record) =>
            record.isWeekend
              ? "weekend-row"
              : record.isHoliday
              ? "holiday-row"
              : record.isTraining
              ? "training-row"
              : ""
          }
        />
      </Spin>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <Button type="default" onClick={handleSaveToTray} disabled={readOnly && isDemoActive && isDemoUser}>
          Save to Print Tray
        </Button>
      </div>
    </Modal>
  );
};

export default ViewDTR;

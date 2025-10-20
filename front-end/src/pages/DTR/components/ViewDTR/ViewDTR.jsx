import React from "react";
import { Modal, Table, Typography, Divider, Button, message, Spin } from "antd";
import dayjs from "dayjs";
import "./viewdtr.css";
import axios from "axios";
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

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <Button type="primary" onClick={handlePreviewForm48}>
          Preview DTR Form 48
        </Button>
      </div>

      <Divider />

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
        <Button type="default" onClick={handleSaveToTray}>
          Save to Print Tray
        </Button>
      </div>
    </Modal>
  );
};

export default ViewDTR;

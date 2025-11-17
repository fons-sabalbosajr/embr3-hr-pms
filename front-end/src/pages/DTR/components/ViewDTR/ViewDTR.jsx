import React from "react";
import useDemoMode from "../../../../hooks/useDemoMode";
import { Modal, Table, Typography, Divider, Button, message, Spin, Tooltip } from "antd";
import dayjs from "dayjs";
import "./viewdtr.css";
import axios from "axios";
import axiosInstance from "../../../../api/axiosInstance";
import { generateDTRPdf } from "../../../../../utils/generateDTRpdf";

const { Text } = Typography;

// Note: Trainings for ViewDTR are omitted to keep the modal snappy.
// If needed later, pass a pre-fetched training map via props to avoid per-open fetch.

const ViewDTR = ({
  visible,
  onClose,
  employee,
  dtrDays,
  dtrLogs,
  selectedRecord,
  holidaysPH = [],
  trainings = [],
  trainingLoading = false,
  onPreviewForm48,
  onSaveToTray,
}) => {
  const { readOnly, isDemoActive, isDemoUser, shouldHideInDemo } = useDemoMode();
  if (!employee || !selectedRecord) return null;

  const startDate = dayjs(selectedRecord.DTR_Cut_Off.start);
  const endDate = dayjs(selectedRecord.DTR_Cut_Off.end);
  const dateRangeStr = `${startDate.format("MMMM D, YYYY")} - ${endDate.format(
    "MMMM D, YYYY"
  )}`;

  const [tableData, setTableData] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    // Build holiday/suspension lookup map; expand ranges
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

    const rows = [];
    let current = startDate.clone();
    const getTrainingLabelForDay = (dateKey) => {
      const found = (trainings || []).filter((t) => {
        const s = dayjs(t?.trainingDate?.[0]);
        const e = dayjs(t?.trainingDate?.[1]);
        if (!s.isValid() || !e.isValid()) return false;
        const d = dayjs(dateKey);
        return d.isSameOrAfter(s, 'day') && d.isSameOrBefore(e, 'day');
      });
      if (!found.length) return null;
      return found
        .map((t) => `${t.name}${t.iisTransaction ? ` (${t.iisTransaction})` : ''}`)
        .join(', ');
    };
    while (current.isBefore(endDate) || current.isSame(endDate, "day")) {
      const dateKey = current.format("YYYY-MM-DD");
      const dayOfWeek = current.day();
      const isWeekend = dayOfWeek === 6 || dayOfWeek === 0;
      const holidayLabel = holidayMap[dateKey] || "";
      const isHoliday = !!holidayLabel;

      const dayData = dtrLogs?.[employee.empId]?.[dateKey] || null;
      const pickEarliest = (v) => Array.isArray(v) ? v.slice().sort((a,b)=>{
        const da = dayjs(a, ["h:mm A","HH:mm"], true);
        const db = dayjs(b, ["h:mm A","HH:mm"], true);
        if (da.isValid() && db.isValid()) return da.isBefore(db)?-1:1;
        return String(a).localeCompare(String(b));
      })[0] : (v || "");
      const pickLatest = (v) => Array.isArray(v) ? v.slice().sort((a,b)=>{
        const da = dayjs(a, ["h:mm A","HH:mm"], true);
        const db = dayjs(b, ["h:mm A","HH:mm"], true);
        if (da.isValid() && db.isValid()) return da.isAfter(db)?-1:1;
        return String(b).localeCompare(String(a));
      })[0] : (v || "");

      let timeIn = dayData ? pickEarliest(dayData["Time In"]) : "";
      let breakOut = dayData ? pickEarliest(dayData["Break Out"]) : "";
      let breakIn = dayData ? pickEarliest(dayData["Break In"]) : "";
      let timeOut = dayData ? pickLatest(dayData["Time Out"]) : "";

      // Determine training presence using provided trainings
      const trainingLabel = getTrainingLabelForDay(dateKey) || "";
      const isTraining = Boolean(trainingLabel) && !timeIn && !breakOut && !breakIn && !timeOut;

      if (timeIn && !breakOut) breakOut = "12:00";
      if (timeOut && !breakIn) breakIn = "1:00";

      rows.push({
        key: dateKey,
        date: current.format("MM/DD/YYYY"),
        timeIn,
        breakOut,
        breakIn,
        timeOut,
        status: "",
        isWeekend,
        weekendLabel: dayOfWeek === 6 ? "Saturday" : "Sunday",
        isHoliday,
        holidayLabel,
        isTraining,
        trainingLabel,
      });

      current = current.add(1, "day");
    }

    // Merge consecutive training rows to reduce redundancy
    let i = 0;
    while (i < rows.length) {
      if (rows[i].isTraining) {
        let j = i + 1;
        while (
          j < rows.length &&
          rows[j].isTraining &&
          rows[j].trainingLabel === rows[i].trainingLabel
        ) {
          j++;
        }
        const span = j - i;
        if (span > 1) {
          rows[i].trainingRowSpan = span;
          rows[i].mergedDateLabel = `${rows[i].date} - ${rows[j - 1].date}`;
          for (let k = i + 1; k < j; k++) {
            rows[k].trainingRowSpan = 0;
          }
        } else {
          rows[i].trainingRowSpan = 1;
          rows[i].mergedDateLabel = rows[i].date;
        }
        i = j;
      } else {
        i++;
      }
    }

    setTableData(rows);
  }, [employee, dtrLogs, selectedRecord, holidaysPH]);

  const columns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 120,
      // Keep Date unmerged: always render per-day to match requirement
      render: (text) => text,
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
              if (record.trainingRowSpan === 0) {
                return { children: null, props: { rowSpan: 0 } };
              }
              return {
                children: record.trainingLabel,
                props: {
                  colSpan: 5,
                  rowSpan: record.trainingRowSpan || 1,
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
            record.isWeekend || record.isHoliday
              ? { children: null, props: { colSpan: 0 } }
              : record.isTraining
              ? (record.trainingRowSpan === 0
                  ? { children: null, props: { rowSpan: 0 } }
                  : { children: null, props: { colSpan: 0 } })
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
            record.isWeekend || record.isHoliday
              ? { children: null, props: { colSpan: 0 } }
              : record.isTraining
              ? (record.trainingRowSpan === 0
                  ? { children: null, props: { rowSpan: 0 } }
                  : { children: null, props: { colSpan: 0 } })
              : record.breakIn,
        },
        {
          title: "Time Out",
          dataIndex: "timeOut",
          key: "timeOut",
          width: 80,
          render: (_, record) =>
            record.isWeekend || record.isHoliday
              ? { children: null, props: { colSpan: 0 } }
              : record.isTraining
              ? (record.trainingRowSpan === 0
                  ? { children: null, props: { rowSpan: 0 } }
                  : { children: null, props: { colSpan: 0 } })
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
    // Reminder column removed: single consolidated button is provided above the table.
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
          {!shouldHideInDemo('ui.notifications.quickSend') && (
            Array.isArray(employee.emails) && employee.emails.length > 0 ? (
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
            )
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

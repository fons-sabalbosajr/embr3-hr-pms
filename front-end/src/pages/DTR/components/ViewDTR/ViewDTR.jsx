import React from "react";
import useDemoMode from "../../../../hooks/useDemoMode";
import {
  Modal,
  Table,
  Typography,
  Divider,
  Button,
  Spin,
  Tooltip,
  Descriptions,
  Space,
  Tag,
} from "antd";
import { swalSuccess, swalError, swalWarning, swalInfo, swalConfirm } from "../../../../utils/swalHelper";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
  ApartmentOutlined,
  CalendarOutlined,
  FilePdfOutlined,
  IdcardOutlined,
  InboxOutlined,
  MailOutlined,
  SendOutlined,
  UserOutlined,
} from "@ant-design/icons";
import "./viewdtr.css";
import axios from "axios";
import axiosInstance from "../../../../api/axiosInstance";
import { generateDTRPdf } from "../../../../../utils/generateDTRpdf";

const { Text } = Typography;

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);
const LOCAL_TZ = "Asia/Manila";

const parseInLocalTz = (value) => {
  if (!value) return dayjs.invalid();
  if (dayjs.isDayjs && dayjs.isDayjs(value)) return value.tz(LOCAL_TZ);
  if (value instanceof Date || typeof value === "number") return dayjs(value).tz(LOCAL_TZ);
  const s = String(value);
  const hasZone = /([zZ]|[+-]\d{2}:\d{2})$/.test(s);
  return hasZone ? dayjs(s).tz(LOCAL_TZ) : dayjs.tz(s, LOCAL_TZ);
};

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

  const startDate = parseInLocalTz(selectedRecord.DTR_Cut_Off.start);
  const endDate = parseInLocalTz(selectedRecord.DTR_Cut_Off.end);
  const dateRangeStr = `${startDate.format("MMMM D, YYYY")} - ${endDate.format(
    "MMMM D, YYYY"
  )}`;

  const [tableData, setTableData] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [previewForm48Loading, setPreviewForm48Loading] = React.useState(false);
  const [saveToTrayLoading, setSaveToTrayLoading] = React.useState(false);

  React.useEffect(() => {
    // Build holiday/suspension lookup map; expand ranges
    const holidayMap = {};
    holidaysPH.forEach((h) => {
      const start = parseInLocalTz(h.date);
      const end = h.endDate ? parseInLocalTz(h.endDate) : start;
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
      const dateKey = current.tz(LOCAL_TZ).format("YYYY-MM-DD");
      const dayOfWeek = current.day();
      const isWeekend = dayOfWeek === 6 || dayOfWeek === 0;
      const holidayLabel = holidayMap[dateKey] || "";
      const isHoliday = !!holidayLabel;

      const ids = [employee.empId, ...(employee.alternateEmpIds || [])].filter(Boolean);
      let dayData = null;
      for (const id of ids) {
        if (dtrLogs?.[id]?.[dateKey]) {
          dayData = dtrLogs[id][dateKey];
          break;
        }
      }

      const pickEarliest = (v) =>
        Array.isArray(v)
          ? v
              .slice()
              .sort((a, b) => {
                const da = dayjs(a, ["h:mm A", "HH:mm", "H:mm", "h:mm"], true);
                const db = dayjs(b, ["h:mm A", "HH:mm", "H:mm", "h:mm"], true);
                if (da.isValid() && db.isValid()) return da.isBefore(db) ? -1 : 1;
                return String(a).localeCompare(String(b));
              })[0]
          : v || "";
      const pickLatest = (v) =>
        Array.isArray(v)
          ? v
              .slice()
              .sort((a, b) => {
                const da = dayjs(a, ["h:mm A", "HH:mm", "H:mm", "h:mm"], true);
                const db = dayjs(b, ["h:mm A", "HH:mm", "H:mm", "h:mm"], true);
                if (da.isValid() && db.isValid()) return da.isAfter(db) ? -1 : 1;
                return String(b).localeCompare(String(a));
              })[0]
          : v || "";

      // Helper: robustly parse and format a time string with AM/PM
      const normalizeTimeWithAmPm = (raw, preferred = "AUTO") => {
        if (!raw && raw !== 0) return "";
        const s = String(raw).trim();
        if (!s) return "";

        const hasAmPm = /[ap]\.?m\.?/i.test(s);

        const tryParse = (str) => {
          const fmts = ["h:mm A", "hh:mm A", "h:mma", "h:mmA", "H:mm", "HH:mm", "Hmm", "hmm", "h mm", "h.mm A", "h.mm"];
          for (const f of fmts) {
            const d = dayjs(str, f, true);
            if (d.isValid()) return d;
          }
          const d2 = dayjs(str);
          return d2.isValid() ? d2 : null;
        };

        if (hasAmPm) {
          const parsed = tryParse(s);
          return parsed ? parsed.format("h:mm A") : s;
        }

        let parsed = tryParse(s);
        if (!parsed) {
          const digits = s.replace(/[^0-9]/g, "");
          if (digits.length === 3) {
            parsed = tryParse(digits.replace(/(\d)(\d{2})/, "$1:$2"));
          } else if (digits.length === 4) {
            parsed = tryParse(digits.replace(/(\d{2})(\d{2})/, "$1:$2"));
          }
        }
        if (!parsed) return s;

        const hour = parsed.hour();
        if (preferred === "AM") {
          if (hour >= 12) parsed = parsed.hour(hour % 12);
        } else if (preferred === "PM") {
          if (hour < 12) parsed = parsed.hour(hour + 12);
        }

        return parsed.format("h:mm A");
      };

      // Collect raw candidate punches from all labels and attempt to resolve AM/PM
      const rawCandidates = {
        "Time In": dayData ? (Array.isArray(dayData["Time In"]) ? dayData["Time In"] : [dayData["Time In"]]).filter(Boolean) : [],
        "Break Out": dayData ? (Array.isArray(dayData["Break Out"]) ? dayData["Break Out"] : [dayData["Break Out"]]).filter(Boolean) : [],
        "Break In": dayData ? (Array.isArray(dayData["Break In"]) ? dayData["Break In"] : [dayData["Break In"]]).filter(Boolean) : [],
        "Time Out": dayData ? (Array.isArray(dayData["Time Out"]) ? dayData["Time Out"] : [dayData["Time Out"]]).filter(Boolean) : [],
      };

      // Helper: produce parse variants for a raw time string (try AM/PM and 24h variants)
      const parseVariants = (s) => {
        if (!s && s !== 0) return [];
        const str = String(s).trim();
        if (!str) return [];
        const variants = [];
        const hasAmPm = /[ap]\.?m\.?/i.test(str);

        const tryFmt = (v) => {
          const fmts = ["h:mm A", "hh:mm A", "h:mma", "h:mmA", "H:mm", "HH:mm", "Hmm", "hmm", "h mm", "h.mm A", "h.mm"];
          for (const f of fmts) {
            const d = dayjs(v, f, true);
            if (d.isValid()) return d;
          }
          const d2 = dayjs(v);
          return d2.isValid() ? d2 : null;
        };

        if (hasAmPm) {
          const p = tryFmt(str);
          if (p) variants.push(p);
          return variants;
        }

        // Try as-is (may parse as 24h)
        const p0 = tryFmt(str);
        if (p0) variants.push(p0);

        // Try forcing AM/PM by appending markers
        const am = tryFmt(str + " AM");
        const pm = tryFmt(str + " PM");
        if (am) variants.push(am);
        if (pm) variants.push(pm);

        // normalize unique by hour/min
        const seen = new Set();
        const out = [];
        variants.forEach((d) => {
          const key = `${d.hour()}:${d.minute()}`;
          if (!seen.has(key)) {
            seen.add(key);
            out.push(d);
          }
        });
        return out;
      };

      // Attempt to find an assignment of variants that yields increasing times: In <= BreakOut <= BreakIn <= Out
      const resolveSequence = (candidates) => {
        const labels = ["Time In", "Break Out", "Break In", "Time Out"];
        const choices = labels.map((lbl) => {
          const arr = candidates[lbl] || [];
          // Pick earliest/unique raw per label as fallback if none parsed
          if (!arr.length) return [null];
          // expand variants for each candidate
          const expanded = arr.map((s) => parseVariants(s)).flat().filter(Boolean);
          // if no parsed variants, keep original string parsed loosely
          if (!expanded.length) return arr.map((s) => {
            const p = dayjs(s);
            return p.isValid() ? p : null;
          }).filter(Boolean);
          return expanded;
        });

        // Cartesian product recursion
        const results = [];
        const backtrack = (idx, acc) => {
          if (idx === choices.length) {
            results.push(acc.slice());
            return;
          }
          const opts = choices[idx] || [null];
          for (const o of opts) {
            acc.push(o);
            backtrack(idx + 1, acc);
            acc.pop();
          }
        };
        backtrack(0, []);

        // Evaluate candidates: prefer those where times are increasing and non-null
        for (const cand of results) {
          // cand is array of dayjs or null
          const [inT, out1, in2, outT] = cand;
          if (!inT && !out1 && !in2 && !outT) continue;
          let ok = true;
          const times = [inT, out1, in2, outT].map((d) => (d && d.isValid() ? d : null));
          // if any non-null appear, ensure order
          for (let i = 0; i < times.length - 1; i++) {
            if (times[i] && times[i + 1]) {
              if (!times[i].isSameOrBefore(times[i + 1])) {
                ok = false;
                break;
              }
            }
          }
          if (ok) {
            // return formatted strings
            return labels.reduce((acc, lbl, i) => {
              acc[lbl] = times[i] ? times[i].format("h:mm A") : "";
              return acc;
            }, {});
          }
        }

        // fallback: use previous pickEarliest/pickLatest with normalization
        return {
          "Time In": (candidates["Time In"] && candidates["Time In"][0]) ? normalizeTimeWithAmPm(pickEarliest(candidates["Time In"]), "AM") : "",
          "Break Out": (candidates["Break Out"] && candidates["Break Out"][0]) ? normalizeTimeWithAmPm(pickEarliest(candidates["Break Out"]), "PM") : "",
          "Break In": (candidates["Break In"] && candidates["Break In"][0]) ? normalizeTimeWithAmPm(pickEarliest(candidates["Break In"]), "PM") : "",
          "Time Out": (candidates["Time Out"] && candidates["Time Out"][0]) ? normalizeTimeWithAmPm(pickLatest(candidates["Time Out"]), "PM") : "",
        };
      };

      const resolved = resolveSequence(rawCandidates);
      let timeIn = resolved["Time In"];
      let breakOut = resolved["Break Out"];
      let breakIn = resolved["Break In"];
      let timeOut = resolved["Time Out"];
      // pick overtime values if any (raw)
      const otInRaw = dayData ? pickEarliest(dayData["OT In"]) : "";
      const otOutRaw = dayData ? pickLatest(dayData["OT Out"]) : "";
      const otIn = otInRaw ? normalizeTimeWithAmPm(otInRaw, "PM") : otInRaw;
      const otOut = otOutRaw ? normalizeTimeWithAmPm(otOutRaw, "PM") : otOutRaw;

      // Determine training presence using provided trainings
      const trainingLabel = getTrainingLabelForDay(dateKey) || "";
      const isTraining = Boolean(trainingLabel) && !timeIn && !breakOut && !breakIn && !timeOut;

      // If no normal punches but there are OT punches on weekend, show OT as the day's punches
      let rowStatus = "";
      if (isWeekend && (otIn || otOut)) {
        // treat as worked day (show OT times)
        timeIn = timeIn || otIn;
        timeOut = timeOut || otOut;
        // mark status as OT to indicate weekend overtime
        rowStatus = "OT";
      }

      if (timeIn && !breakOut) breakOut = normalizeTimeWithAmPm("12:00", "PM");
      if (timeOut && !breakIn) breakIn = normalizeTimeWithAmPm("1:00", "PM");

      rows.push({
        key: dateKey,
        date: current.format("MM/DD/YYYY"),
        timeIn,
        breakOut,
        breakIn,
        timeOut,
        status: rowStatus || "",
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
      width: 110,
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
          width: 70,
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
          width: 70,
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
          width: 70,
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
          width: 70,
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
      width: 110,
      render: (_, record) =>
        record.isWeekend || record.isHoliday || record.isTraining
          ? { children: null, props: { colSpan: 0 } }
          : record.status,
    },
    // Reminder column removed: single consolidated button is provided above the table.
  ];

  const handlePreviewForm48 = async () => {
    setPreviewForm48Loading(true);
    try {
      await Promise.resolve(
        generateDTRPdf({ employee, dtrDays, dtrLogs, selectedRecord })
      );
    } finally {
      setPreviewForm48Loading(false);
    }
  };

  const handleSaveToTray = async () => {
    if (!onSaveToTray) return;
    setSaveToTrayLoading(true);
    try {
      await Promise.resolve(onSaveToTray(employee, selectedRecord));
      swalSuccess("DTR has been added to the Printer Tray!");
    } finally {
      setSaveToTrayLoading(false);
    }
  };

  const getMissingDates = () => {
    // Derive dates with missing time parts (non-weekend/holiday/training)
    return (tableData || [])
      .filter(
        (r) => !r.isWeekend && !r.isHoliday && !r.isTraining && (
          !r.timeIn || !r.breakOut || !r.breakIn || !r.timeOut
        )
      )
      .map((r) => {
        const toIso = (rec) => {
          if (rec.key) return rec.key;
          try {
            const [mm, dd, yyyy] = String(rec.date).split('/');
            return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
          } catch {
            return rec.date;
          }
        };

        const missing = [];
        if (!r.timeIn) missing.push('Time In');
        if (!r.breakOut) missing.push('Break Out');
        if (!r.breakIn) missing.push('Break In');
        if (!r.timeOut) missing.push('Time Out');

        return { date: toIso(r), display: r.date, missing };
      });
  };

  const handleSendAllMissing = async () => {
    const hasEmail = Array.isArray(employee.emails) && employee.emails.length > 0;
    if (!hasEmail) {
      swalWarning("Employee has no email inputted yet.");
      return;
    }
    const missingDates = getMissingDates();
    if (!missingDates.length) {
      swalInfo("No missing time records for this cut-off.");
      return;
    }

    const start = dayjs(selectedRecord.DTR_Cut_Off.start).format("MMM D, YYYY");
    const end = dayjs(selectedRecord.DTR_Cut_Off.end).format("MMM D, YYYY");
    const periodLabel = `${start} - ${end}`;

    const previewItems = missingDates.slice(0,15).map(d => {
      const label = dayjs(d.date).isValid() ? dayjs(d.date).format('MMMM D, YYYY') : d.date;
      const detail = d.missing && d.missing.length ? ` (Missing: ${d.missing.join(', ')})` : '';
      return `<li>${label}${detail}</li>`;
    }).join('');
    const moreText = missingDates.length > 15 ? `<div style="margin-top:6px;color:#888">+ ${missingDates.length - 15} more…</div>` : '';
    const htmlContent = `
      <p>This will send an email to <strong>${employee.emails[0]}</strong> listing all days with no time records for <strong>${periodLabel}</strong>.</p>
      <div style="margin-top:8px;padding:12px;background:#fafafa;border:1px solid #eee;border-radius:6px;text-align:left">
        <div style="font-weight:600;margin-bottom:6px">Preview (first 15 days shown)</div>
        <ul style="margin:0;padding-left:18px">${previewItems}</ul>
        ${moreText}
      </div>`;

    const result = await swalConfirm({
      title: "Send Reminder for All Missing Days",
      icon: "question",
      confirmText: "Send Reminder",
    });
    if (!result.isConfirmed) return;

    try {
      await axiosInstance.post('/notifications/no-time-record/bulk', {
        employeeId: employee.empId,
        email: employee.emails[0],
        name: employee.name,
        dates: missingDates,
        periodLabel,
      });
      swalSuccess("Bulk reminder sent");
    } catch (e) {
      swalError("Failed to send bulk reminder");
    }
  };

  const handleSendReminder = async (row) => {
    const hasEmail = Array.isArray(employee.emails) && employee.emails.length > 0;
    if (!hasEmail) {
      swalWarning("Employee has no email inputted yet.");
      return;
    }
    const dateStr = row?.key || row?.date; // key is YYYY-MM-DD; date is MM/DD/YYYY (display)
    const displayDate = row?.date || dateStr;
    const name = employee.name || "Employee";
    const empId = employee.empId;
    const missing = [];
    if (!row.timeIn) missing.push('Time In');
    if (!row.breakOut) missing.push('Break Out');
    if (!row.breakIn) missing.push('Break In');
    if (!row.timeOut) missing.push('Time Out');

    const result = await swalConfirm({
      title: "Send No Time Record Reminder",
      text: `Send reminder to ${employee.emails[0]} for ${displayDate}?\n\nMissing: ${missing.length ? missing.join(', ') : 'No time entries recorded'}`,
      icon: "question",
      confirmText: "Send Reminder",
    });
    if (!result.isConfirmed) return;

    try {
      await axiosInstance.post("/notifications/no-time-record", {
        employeeId: empId,
        email: employee.emails[0],
        name,
        date: dateStr,
        missing,
      });
      swalSuccess("Reminder sent");
    } catch (e) {
      swalError("Failed to send reminder");
    }
  };

  return (
    <Modal
      title={
        <Space size={8} align="center">
          <UserOutlined />
          <span style={{ fontWeight: 600 }}>View Daily Time Record</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={720}
      className="view-dtr-modal"
    >
      <Descriptions
        size="small"
        column={2}
        colon={false}
        style={{ marginBottom: 12 }}
        labelStyle={{ width: 150, color: "var(--app-muted-text-color, #595959)" }}
        contentStyle={{ fontWeight: 600 }}
        items={[
          {
            key: "name",
            label: (
              <Space size={6}>
                <UserOutlined /> Employee
              </Space>
            ),
            children: employee.name || "—",
          },
          {
            key: "empId",
            label: (
              <Space size={6}>
                <IdcardOutlined /> Employee ID
              </Space>
            ),
            children: employee.empId || "—",
          },
          {
            key: "empNo",
            label: (
              <Space size={6}>
                <IdcardOutlined /> Employee No.
              </Space>
            ),
            children: employee.empNo || "—",
          },
          {
            key: "empType",
            label: (
              <Space size={6}>
                <IdcardOutlined /> Type
              </Space>
            ),
            children: employee.empType ? (
              <Tag color="geekblue" className="emp-type-tag">
                {employee.empType}
              </Tag>
            ) : (
              "—"
            ),
          },
          {
            key: "division",
            label: (
              <Space size={6}>
                <ApartmentOutlined /> Division / Section
              </Space>
            ),
            span: 2,
            children: (
              <span style={{ fontWeight: 500 }}>
                {employee.division || "—"}
                {employee.sectionOrUnit ? ` | ${employee.sectionOrUnit}` : ""}
              </span>
            ),
          },
          {
            key: "cutoff",
            label: (
              <Space size={6}>
                <CalendarOutlined /> Cut-off
              </Space>
            ),
            span: 2,
            children: <span style={{ fontWeight: 600 }}>{dateRangeStr}</span>,
          },
        ]}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div>
          {!shouldHideInDemo('ui.notifications.quickSend') && (
            Array.isArray(employee.emails) && employee.emails.length > 0 ? (
              <Tooltip title="Send one email listing all days in this cut-off with no time records">
                <Button
                  icon={<SendOutlined />}
                  onClick={handleSendAllMissing}
                  disabled={readOnly && isDemoActive && isDemoUser}
                >
                  Send All Missing
                </Button>
              </Tooltip>
            ) : (
              <Tooltip title="Employee has no email on record">
                <span>
                  <Button icon={<MailOutlined />} disabled>
                    Send All Missing
                  </Button>
                </span>
              </Tooltip>
            )
          )}
        </div>
        <div>
          <Button
            type="primary"
            onClick={handlePreviewForm48}
            loading={previewForm48Loading}
            disabled={(readOnly && isDemoActive && isDemoUser) || saveToTrayLoading}
            icon={<FilePdfOutlined />}
          >
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
          tableLayout="fixed"
          scroll={{ x: 560, y: 340 }}
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
        <Button
          type="default"
          onClick={handleSaveToTray}
          loading={saveToTrayLoading}
          disabled={(readOnly && isDemoActive && isDemoUser) || previewForm48Loading}
          icon={<InboxOutlined />}
        >
          Save to Print Tray
        </Button>
      </div>
    </Modal>
  );
};

export default ViewDTR;

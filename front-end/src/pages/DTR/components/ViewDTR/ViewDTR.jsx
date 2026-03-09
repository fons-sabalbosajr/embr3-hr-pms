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
  TimePicker,
  Select,
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
  SearchOutlined,
  ToolOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  PlusOutlined,
  ThunderboltOutlined,
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

  const startDate = selectedRecord ? parseInLocalTz(selectedRecord.DTR_Cut_Off.start) : dayjs.invalid();
  const endDate = selectedRecord ? parseInLocalTz(selectedRecord.DTR_Cut_Off.end) : dayjs.invalid();
  const dateRangeStr = startDate.isValid() && endDate.isValid()
    ? `${startDate.format("MMMM D, YYYY")} - ${endDate.format("MMMM D, YYYY")}`
    : "";

  const [tableData, setTableData] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [previewForm48Loading, setPreviewForm48Loading] = React.useState(false);
  const [saveToTrayLoading, setSaveToTrayLoading] = React.useState(false);

  // Find Time Record state
  const [findTimeModalOpen, setFindTimeModalOpen] = React.useState(false);
  const [manualEntries, setManualEntries] = React.useState({}); // { "YYYY-MM-DD": { timeIn, breakOut, breakIn, timeOut, source } }
  const [findSelectedDate, setFindSelectedDate] = React.useState(null);
  const [findTimeIn, setFindTimeIn] = React.useState(null);
  const [findBreakOut, setFindBreakOut] = React.useState(null);
  const [findBreakIn, setFindBreakIn] = React.useState(null);
  const [findTimeOut, setFindTimeOut] = React.useState(null);

  // Biometric search state
  const [biometricResults, setBiometricResults] = React.useState({}); // grouped by date from API
  const [biometricSearchLoading, setBiometricSearchLoading] = React.useState(false);
  const [resolutionsLoaded, setResolutionsLoaded] = React.useState(false);
  const [fillAllLoading, setFillAllLoading] = React.useState(false);

  // Load saved resolutions from backend on open
  React.useEffect(() => {
    if (!visible || !employee?.empId || !selectedRecord?._id) return;
    const loadResolutions = async () => {
      try {
        const res = await axiosInstance.get("/dtr-resolutions", {
          params: { empId: employee.empId, recordId: selectedRecord._id },
        });
        if (res.data?.success && res.data.data) {
          const entries = {};
          for (const [dateKey, r] of Object.entries(res.data.data)) {
            entries[dateKey] = {
              timeIn: r.timeIn || "",
              breakOut: r.breakOut || "",
              breakIn: r.breakIn || "",
              timeOut: r.timeOut || "",
              source: r.source || "manual",
              _id: r._id,
            };
          }
          setManualEntries(entries);
        }
      } catch {
        // silent fail – entries stay empty
      } finally {
        setResolutionsLoaded(true);
      }
    };
    setResolutionsLoaded(false);
    loadResolutions();
  }, [visible, employee?.empId, selectedRecord?._id]);

  React.useEffect(() => {
    // Fetch WFH records for date range and build lookup
    const fetchWfhDays = async () => {
      try {
        const s = startDate.format("YYYY-MM-DD");
        const e = endDate.format("YYYY-MM-DD");
        const empIds = [employee.empId, ...(employee.alternateEmpIds || [])].filter(Boolean);

        // Fetch individual WFH records AND WFH Group records in parallel
        const [indivRes, groupRes] = await Promise.all([
          axiosInstance.get("/work-from-home/public", { params: { start: s, end: e } }),
          axiosInstance.get("/wfh-groups/public", { params: { start: s, end: e } }).catch(() => ({ data: { data: [] } })),
        ]);

        const wfhSet = new Set();

        // Individual WFH records
        (indivRes.data?.data || []).forEach((w) => {
          // Only include records that match this employee (or org-wide with no empId)
          if (w.empId && !empIds.includes(w.empId)) return;
          const ws = dayjs(w.date).startOf("day");
          const we = w.endDate ? dayjs(w.endDate).startOf("day") : ws;
          let d = ws;
          while (d.isSameOrBefore(we, "day")) {
            wfhSet.add(d.format("YYYY-MM-DD"));
            d = d.add(1, "day");
          }
        });

        // WFH Group records — check if employee is a member
        (groupRes.data?.data || []).forEach((g) => {
          const memberIds = (g.members || []).map((m) => m.empId);
          const isMember = empIds.some((id) => memberIds.includes(id));
          if (!isMember) return;
          const gs = dayjs(g.startDate).startOf("day");
          const ge = dayjs(g.endDate).startOf("day");
          let d = gs;
          while (d.isSameOrBefore(ge, "day")) {
            wfhSet.add(d.format("YYYY-MM-DD"));
            d = d.add(1, "day");
          }
        });

        return wfhSet;
      } catch (_) {
        return new Set();
      }
    };

    const buildRows = async () => {
    const wfhDays = await fetchWfhDays();
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

      // Check if this day is a WFH day
      const isWfh = wfhDays.has(dateKey);

      // If no normal punches but there are OT punches on weekend, show OT as the day's punches
      let rowStatus = "";
      if (isWfh && !isWeekend && !isHoliday) {
        rowStatus = "WFH (see attch.)";
      } else if (isWeekend && (otIn || otOut)) {
        // treat as worked day (show OT times)
        timeIn = timeIn || otIn;
        timeOut = timeOut || otOut;
        // mark status as OT to indicate weekend overtime
        rowStatus = "OT";
      }

      if (timeIn && !breakOut) breakOut = normalizeTimeWithAmPm("12:00", "PM");
      if (timeOut && !breakIn) breakIn = normalizeTimeWithAmPm("1:00", "PM");

      // Apply manual entries from "Find Time Record" tool
      const manual = manualEntries[dateKey];
      let isManualEntry = false;
      if (manual) {
        if (manual.timeIn) { timeIn = manual.timeIn; isManualEntry = true; }
        if (manual.breakOut) { breakOut = manual.breakOut; isManualEntry = true; }
        if (manual.breakIn) { breakIn = manual.breakIn; isManualEntry = true; }
        if (manual.timeOut) { timeOut = manual.timeOut; isManualEntry = true; }
      }

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
        isManualEntry,
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
    };
    buildRows();
  }, [employee, dtrLogs, selectedRecord, holidaysPH, manualEntries]);

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
            if (record.isManualEntry && manualEntries[record.key]?.timeIn) {
              return <span className="manual-entry-value">{text}</span>;
            }
            return text;
          },
        },
        {
          title: "Break Out",
          dataIndex: "breakOut",
          key: "breakOut",
          width: 70,
          render: (_, record) => {
            if (record.isWeekend || record.isHoliday) return { children: null, props: { colSpan: 0 } };
            if (record.isTraining) return record.trainingRowSpan === 0 ? { children: null, props: { rowSpan: 0 } } : { children: null, props: { colSpan: 0 } };
            if (record.isManualEntry && manualEntries[record.key]?.breakOut) {
              return <span className="manual-entry-value">{record.breakOut}</span>;
            }
            return record.breakOut;
          },
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
          render: (_, record) => {
            if (record.isWeekend || record.isHoliday) return { children: null, props: { colSpan: 0 } };
            if (record.isTraining) return record.trainingRowSpan === 0 ? { children: null, props: { rowSpan: 0 } } : { children: null, props: { colSpan: 0 } };
            if (record.isManualEntry && manualEntries[record.key]?.breakIn) {
              return <span className="manual-entry-value">{record.breakIn}</span>;
            }
            return record.breakIn;
          },
        },
        {
          title: "Time Out",
          dataIndex: "timeOut",
          key: "timeOut",
          width: 70,
          render: (_, record) => {
            if (record.isWeekend || record.isHoliday) return { children: null, props: { colSpan: 0 } };
            if (record.isTraining) return record.trainingRowSpan === 0 ? { children: null, props: { rowSpan: 0 } } : { children: null, props: { colSpan: 0 } };
            if (record.isManualEntry && manualEntries[record.key]?.timeOut) {
              return <span className="manual-entry-value">{record.timeOut}</span>;
            }
            return record.timeOut;
          },
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
          : record.status === "WFH (see attch.)"
          ? <Tag color="blue" style={{ fontSize: 10 }}>WFH (see attch.)</Tag>
          : record.status,
    },
    // Reminder column removed: single consolidated button is provided above the table.
  ];

  const handlePreviewForm48 = async () => {
    setPreviewForm48Loading(true);
    try {
      // Merge manual entries into dtrLogs for PDF generation
      let mergedLogs = dtrLogs;
      if (Object.keys(manualEntries).length > 0) {
        mergedLogs = JSON.parse(JSON.stringify(dtrLogs || {}));
        const empId = employee.empId;
        if (!mergedLogs[empId]) mergedLogs[empId] = {};
        for (const [dateKey, entry] of Object.entries(manualEntries)) {
          if (!mergedLogs[empId][dateKey]) mergedLogs[empId][dateKey] = {};
          if (entry.timeIn) mergedLogs[empId][dateKey]["Time In"] = entry.timeIn;
          if (entry.breakOut) mergedLogs[empId][dateKey]["Break Out"] = entry.breakOut;
          if (entry.breakIn) mergedLogs[empId][dateKey]["Break In"] = entry.breakIn;
          if (entry.timeOut) mergedLogs[empId][dateKey]["Time Out"] = entry.timeOut;
        }
      }
      await Promise.resolve(
        generateDTRPdf({ employee, dtrDays, dtrLogs: mergedLogs, selectedRecord })
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

  // ── Find Time Record handlers ──
  const availableDatesForManual = React.useMemo(() => {
    return (tableData || [])
      .filter((r) => !r.isWeekend && !r.isHoliday && !r.isTraining)
      .map((r) => {
        const isMissing = !r.timeIn || !r.breakOut || !r.breakIn || !r.timeOut;
        const hasBio = (biometricResults[r.key] || []).length > 0;
        let suffix = "";
        if (isMissing && hasBio) suffix = " ✦ found in DTR Data";
        else if (isMissing) suffix = " (missing)";
        return {
          label: `${r.date}${suffix}`,
          value: r.key,
        };
      });
  }, [tableData, biometricResults]);

  const openFindTimeModal = async () => {
    setFindSelectedDate(null);
    setFindTimeIn(null);
    setFindBreakOut(null);
    setFindBreakIn(null);
    setFindTimeOut(null);
    setFindTimeModalOpen(true);

    // Search biometric data for this employee across all DTR Data
    try {
      setBiometricSearchLoading(true);
      const s = startDate.format("YYYY-MM-DD");
      const e = endDate.format("YYYY-MM-DD");
      const res = await axiosInstance.get("/dtr-resolutions/search-biometric", {
        params: { empId: employee.empId, startDate: s, endDate: e },
      });
      if (res.data?.success) {
        setBiometricResults(res.data.data || {});
      }
    } catch {
      // silent fail
    } finally {
      setBiometricSearchLoading(false);
    }
  };

  const handleSelectDateForFind = (dateKey) => {
    setFindSelectedDate(dateKey);
    const existing = manualEntries[dateKey];
    if (existing) {
      setFindTimeIn(existing.timeIn ? dayjs(existing.timeIn, "h:mm A") : null);
      setFindBreakOut(existing.breakOut ? dayjs(existing.breakOut, "h:mm A") : null);
      setFindBreakIn(existing.breakIn ? dayjs(existing.breakIn, "h:mm A") : null);
      setFindTimeOut(existing.timeOut ? dayjs(existing.timeOut, "h:mm A") : null);
      return;
    }

    // Try to auto-populate from biometric search results
    const bioPunches = biometricResults[dateKey] || [];
    if (bioPunches.length > 0) {
      // Group by state-like classification based on time
      const sorted = [...bioPunches].sort((a, b) => {
        const ta = dayjs(a.time, "h:mm A");
        const tb = dayjs(b.time, "h:mm A");
        return ta.isValid() && tb.isValid() ? (ta.isBefore(tb) ? -1 : 1) : 0;
      });

      // Find punches by state label
      const checkIn = sorted.filter((p) => /check.?in|c\/i|time.?in/i.test(p.state) || p.state === "0");
      const checkOut = sorted.filter((p) => /check.?out|c\/o|time.?out/i.test(p.state) || p.state === "1");

      if (checkIn.length > 0) {
        setFindTimeIn(dayjs(checkIn[0].time, "h:mm A"));
      } else if (sorted.length >= 1) {
        setFindTimeIn(dayjs(sorted[0].time, "h:mm A"));
      } else {
        setFindTimeIn(null);
      }

      if (checkOut.length > 0) {
        const last = checkOut[checkOut.length - 1];
        setFindTimeOut(dayjs(last.time, "h:mm A"));
        // If more than one check-out, first could be break out
        if (checkOut.length > 1) {
          setFindBreakOut(dayjs(checkOut[0].time, "h:mm A"));
        } else {
          setFindBreakOut(null);
        }
      } else if (sorted.length >= 4) {
        setFindTimeOut(dayjs(sorted[sorted.length - 1].time, "h:mm A"));
        setFindBreakOut(null);
      } else {
        setFindTimeOut(null);
        setFindBreakOut(null);
      }

      if (checkIn.length > 1) {
        setFindBreakIn(dayjs(checkIn[checkIn.length - 1].time, "h:mm A"));
      } else {
        setFindBreakIn(null);
      }
    } else {
      // Pre-populate from existing table data
      const row = (tableData || []).find((r) => r.key === dateKey);
      setFindTimeIn(row?.timeIn ? dayjs(row.timeIn, "h:mm A") : null);
      setFindBreakOut(row?.breakOut ? dayjs(row.breakOut, "h:mm A") : null);
      setFindBreakIn(row?.breakIn ? dayjs(row.breakIn, "h:mm A") : null);
      setFindTimeOut(row?.timeOut ? dayjs(row.timeOut, "h:mm A") : null);
    }
  };

  const handleSaveFindTime = async () => {
    if (!findSelectedDate) return;
    const entry = {};
    if (findTimeIn?.isValid()) entry.timeIn = findTimeIn.format("h:mm A");
    if (findBreakOut?.isValid()) entry.breakOut = findBreakOut.format("h:mm A");
    if (findBreakIn?.isValid()) entry.breakIn = findBreakIn.format("h:mm A");
    if (findTimeOut?.isValid()) entry.timeOut = findTimeOut.format("h:mm A");
    if (Object.keys(entry).length === 0) {
      swalWarning("Please enter at least one time value.");
      return;
    }

    // Determine source: biometric if punches were found from DTR Data search
    const hasBiometric = (biometricResults[findSelectedDate] || []).length > 0;
    const source = hasBiometric ? "biometric" : "manual";

    // Save to backend
    try {
      await axiosInstance.post("/dtr-resolutions", {
        empId: employee.empId,
        recordId: selectedRecord._id,
        dateKey: findSelectedDate,
        ...entry,
        source,
      });
      setManualEntries((prev) => ({ ...prev, [findSelectedDate]: { ...entry, source } }));
      swalSuccess(`Time record saved for ${dayjs(findSelectedDate).format("MM/DD/YYYY")}`);
      setFindTimeModalOpen(false);
    } catch {
      swalError("Failed to save time record");
    }
  };

  const handleRemoveManualEntry = async (dateKey) => {
    const entry = manualEntries[dateKey];
    if (entry?._id) {
      try {
        await axiosInstance.delete(`/dtr-resolutions/${entry._id}`);
      } catch {
        // continue removing locally
      }
    }
    setManualEntries((prev) => {
      const next = { ...prev };
      delete next[dateKey];
      return next;
    });
  };

  // ── Fill All Time Records handler ──
  const resolvePunchesForDate = (bioPunches) => {
    const sorted = [...bioPunches].sort((a, b) => {
      const ta = dayjs(a.time, "h:mm A");
      const tb = dayjs(b.time, "h:mm A");
      return ta.isValid() && tb.isValid() ? (ta.isBefore(tb) ? -1 : 1) : 0;
    });

    const checkIn = sorted.filter((p) => /check.?in|c\/i|time.?in/i.test(p.state) || p.state === "0");
    const checkOut = sorted.filter((p) => /check.?out|c\/o|time.?out/i.test(p.state) || p.state === "1");

    const entry = {};

    if (checkIn.length > 0) {
      entry.timeIn = dayjs(checkIn[0].time, "h:mm A").format("h:mm A");
    } else if (sorted.length >= 1) {
      entry.timeIn = dayjs(sorted[0].time, "h:mm A").format("h:mm A");
    }

    if (checkOut.length > 0) {
      const last = checkOut[checkOut.length - 1];
      entry.timeOut = dayjs(last.time, "h:mm A").format("h:mm A");
      if (checkOut.length > 1) {
        entry.breakOut = dayjs(checkOut[0].time, "h:mm A").format("h:mm A");
      }
    } else if (sorted.length >= 4) {
      entry.timeOut = dayjs(sorted[sorted.length - 1].time, "h:mm A").format("h:mm A");
    }

    if (checkIn.length > 1) {
      entry.breakIn = dayjs(checkIn[checkIn.length - 1].time, "h:mm A").format("h:mm A");
    }

    return Object.keys(entry).length > 0 ? entry : null;
  };

  const handleFillAllTimeRecords = async () => {
    if (!employee?.empId || !selectedRecord?._id) return;

    setFillAllLoading(true);
    try {
      // 1. Search biometric data
      const s = startDate.format("YYYY-MM-DD");
      const e = endDate.format("YYYY-MM-DD");
      const bioRes = await axiosInstance.get("/dtr-resolutions/search-biometric", {
        params: { empId: employee.empId, startDate: s, endDate: e },
      });
      const bioData = bioRes.data?.success ? (bioRes.data.data || {}) : {};
      setBiometricResults(bioData);

      // 2. Find missing dates (not weekend/holiday/training, and has at least one missing time field, and not already resolved)
      const missingRows = (tableData || []).filter(
        (r) =>
          !r.isWeekend &&
          !r.isHoliday &&
          !r.isTraining &&
          (!r.timeIn || !r.breakOut || !r.breakIn || !r.timeOut) &&
          !manualEntries[r.key]
      );

      // 3. For each missing date that has biometric data, resolve time punches
      const entriesToSave = [];
      for (const row of missingRows) {
        const bioPunches = bioData[row.key];
        if (!bioPunches || bioPunches.length === 0) continue;

        const resolved = resolvePunchesForDate(bioPunches);
        if (resolved) {
          entriesToSave.push({ dateKey: row.key, ...resolved, source: "biometric" });
        }
      }

      if (entriesToSave.length === 0) {
        swalInfo("No biometric data found in DTR Data for any of the missing dates.");
        return;
      }

      // 4. Bulk save via API
      const saveRes = await axiosInstance.post("/dtr-resolutions/bulk", {
        empId: employee.empId,
        recordId: selectedRecord._id,
        entries: entriesToSave,
      });

      if (saveRes.data?.success) {
        setManualEntries(saveRes.data.data || {});
        const totalMissing = missingRows.length;
        const filled = entriesToSave.length;
        const notFound = totalMissing - filled;
        swalSuccess(
          `Filled ${filled} time record${filled !== 1 ? "s" : ""} from DTR Data.` +
            (notFound > 0 ? ` ${notFound} date${notFound !== 1 ? "s" : ""} had no biometric data.` : "")
        );
      }
    } catch {
      swalError("Failed to fill time records.");
    } finally {
      setFillAllLoading(false);
    }
  };

  const manualEntryCount = Object.keys(manualEntries).length;

  if (!employee || !selectedRecord) return null;

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

      <div className="viewdtr-toolbar">
        {/* ── Tools Group ── */}
        <div className="viewdtr-toolbar-group">
          <span className="viewdtr-toolbar-label"><ToolOutlined /> Tools</span>
          <Space size={6} wrap>
            <Tooltip title="Search uploaded DTR Data for missing time records">
              <Button
                size="small"
                icon={<SearchOutlined />}
                onClick={openFindTimeModal}
              >
                Find Time Record
                {manualEntryCount > 0 && (
                  <Tag color="green" style={{ marginLeft: 4, fontSize: 10 }}>{manualEntryCount}</Tag>
                )}
              </Button>
            </Tooltip>
            <Tooltip title="Auto-fill all missing time records from uploaded DTR Data">
              <Button
                size="small"
                icon={<ThunderboltOutlined />}
                onClick={handleFillAllTimeRecords}
                loading={fillAllLoading}
                disabled={readOnly && isDemoActive && isDemoUser}
              >
                Fill Time Records
              </Button>
            </Tooltip>
            {!shouldHideInDemo('ui.notifications.quickSend') && (
              Array.isArray(employee.emails) && employee.emails.length > 0 ? (
                <Tooltip title="Send one email listing all days with no time records">
                  <Button
                    size="small"
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
                    <Button size="small" icon={<MailOutlined />} disabled>
                      Send All Missing
                    </Button>
                  </span>
                </Tooltip>
              )
            )}
          </Space>
        </div>

        {/* ── Output Group ── */}
        <div className="viewdtr-toolbar-group">
          <span className="viewdtr-toolbar-label"><FilePdfOutlined /> Output</span>
          <Space size={6} wrap>
            <Button
              size="small"
              type="primary"
              onClick={handlePreviewForm48}
              loading={previewForm48Loading}
              disabled={(readOnly && isDemoActive && isDemoUser) || saveToTrayLoading}
              icon={<FilePdfOutlined />}
            >
              Preview DTR Form 48
            </Button>
            <Button
              size="small"
              onClick={handleSaveToTray}
              loading={saveToTrayLoading}
              disabled={(readOnly && isDemoActive && isDemoUser) || previewForm48Loading}
              icon={<InboxOutlined />}
            >
              Save to Print Tray
            </Button>
          </Space>
        </div>
      </div>

      <Divider style={{ margin: "8px 0" }} />

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
              : record.isManualEntry
              ? "manual-entry-row"
              : ""
          }
        />
      </Spin>

      {/* ── Find Time Record Modal ── */}
      <Modal
        title={
          <Space size={8}>
            <SearchOutlined />
            <span>Find Time Record</span>
          </Space>
        }
        open={findTimeModalOpen}
        onCancel={() => setFindTimeModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setFindTimeModalOpen(false)}>Cancel</Button>,
          <Button
            key="save"
            type="primary"
            icon={<PlusOutlined />}
            disabled={!findSelectedDate}
            onClick={handleSaveFindTime}
          >
            Save Time Record
          </Button>,
        ]}
        width={560}
      >
        <Spin spinning={biometricSearchLoading} tip="Searching uploaded DTR Data...">
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>Select Date:</label>
            <Select
              style={{ width: "100%" }}
              placeholder="Choose a date..."
              value={findSelectedDate}
              onChange={handleSelectDateForFind}
              options={availableDatesForManual}
              showSearch
              filterOption={(input, opt) => (opt?.label || "").toLowerCase().includes(input.toLowerCase())}
            />
          </div>

          {/* Biometric records found for selected date */}
          {findSelectedDate && (biometricResults[findSelectedDate] || []).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Tag color="blue" style={{ marginBottom: 6 }}>
                <SearchOutlined /> Found {biometricResults[findSelectedDate].length} biometric punch(es) from uploaded DTR Data
              </Tag>
              <Table
                dataSource={biometricResults[findSelectedDate].map((p, i) => ({ ...p, key: i }))}
                size="small"
                pagination={false}
                scroll={{ y: 120 }}
                columns={[
                  { title: "Time", dataIndex: "time", key: "time", width: 90 },
                  { title: "State", dataIndex: "state", key: "state", width: 70 },
                  { title: "AC-No", dataIndex: "acNo", key: "acNo", width: 80 },
                  { title: "Source", dataIndex: "source", key: "source" },
                ]}
              />
            </div>
          )}

          {findSelectedDate && (biometricResults[findSelectedDate] || []).length === 0 && !biometricSearchLoading && (
            <div style={{ marginBottom: 12 }}>
              <Tag color="default">No biometric records found for this date — enter times manually below</Tag>
            </div>
          )}

          {findSelectedDate && (
            <div className="find-time-fields">
              <div className="find-time-field">
                <label>Time In (AM)</label>
                <TimePicker
                  value={findTimeIn}
                  onChange={setFindTimeIn}
                  format="h:mm A"
                  use12Hours
                  style={{ width: "100%" }}
                  placeholder="e.g. 8:00 AM"
                />
              </div>
              <div className="find-time-field">
                <label>Break Out</label>
                <TimePicker
                  value={findBreakOut}
                  onChange={setFindBreakOut}
                  format="h:mm A"
                  use12Hours
                  style={{ width: "100%" }}
                  placeholder="e.g. 12:00 PM"
                />
              </div>
              <div className="find-time-field">
                <label>Break In</label>
                <TimePicker
                  value={findBreakIn}
                  onChange={setFindBreakIn}
                  format="h:mm A"
                  use12Hours
                  style={{ width: "100%" }}
                  placeholder="e.g. 1:00 PM"
                />
              </div>
              <div className="find-time-field">
                <label>Time Out (PM)</label>
                <TimePicker
                  value={findTimeOut}
                  onChange={setFindTimeOut}
                  format="h:mm A"
                  use12Hours
                  style={{ width: "100%" }}
                  placeholder="e.g. 5:00 PM"
                />
              </div>
            </div>
          )}
        </Spin>

        {/* List of saved entries */}
        {manualEntryCount > 0 && (
          <div style={{ marginTop: 16 }}>
            <Divider style={{ margin: "8px 0" }} />
            <label style={{ fontWeight: 500, display: "block", marginBottom: 6 }}>
              Saved Entries ({manualEntryCount})
            </label>
            <Table
              dataSource={Object.entries(manualEntries).map(([dateKey, entry]) => ({
                key: dateKey,
                date: dayjs(dateKey).format("MM/DD/YYYY"),
                ...entry,
              }))}
              size="small"
              pagination={false}
              scroll={{ y: 150 }}
              columns={[
                { title: "Date", dataIndex: "date", key: "date", width: 90 },
                { title: "Time In", dataIndex: "timeIn", key: "timeIn", width: 75 },
                { title: "Break Out", dataIndex: "breakOut", key: "breakOut", width: 75 },
                { title: "Break In", dataIndex: "breakIn", key: "breakIn", width: 75 },
                { title: "Time Out", dataIndex: "timeOut", key: "timeOut", width: 75 },
                {
                  title: "Src",
                  dataIndex: "source",
                  key: "source",
                  width: 50,
                  render: (v) => (
                    <Tag color={v === "biometric" ? "blue" : "green"} style={{ fontSize: 10 }}>
                      {v === "biometric" ? "Bio" : "Man"}
                    </Tag>
                  ),
                },
                {
                  title: "",
                  key: "actions",
                  width: 35,
                  render: (_, row) => (
                    <Tooltip title="Remove this entry">
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveManualEntry(row.key)}
                      />
                    </Tooltip>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Modal>
    </Modal>
  );
};

export default ViewDTR;

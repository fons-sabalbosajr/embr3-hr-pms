import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { fetchPhilippineHolidays } from "../src/api/holidayPH";
import axios from "axios";
import axiosInstance from "../src/api/axiosInstance";
import { secureRetrieve, secureSessionGet } from "./secureStorage";
import { getSignatoryEmployees } from "../src/api/employeeAPI.js";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
const LOCAL_TZ = "Asia/Manila";

function stripAmPm(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return timeStr;
  // remove trailing AM/PM (case-insensitive) and any surrounding whitespace
  return timeStr.replace(/\s*(AM|PM)\s*$/i, "").trim();
}

function formatTimeForPdf(val, dateKey) {
  try {
    // If multiple punches provided, prefer the earliest
    if (Array.isArray(val)) {
      if (val.length === 0) return "";
      // Assume values are time strings; sort ascending by time when possible
      const sorted = val
        .slice()
        .sort((a, b) => {
          try {
            const da = dayjs(a, ["h:mm A", "HH:mm"], true);
            const db = dayjs(b, ["h:mm A", "HH:mm"], true);
            if (da.isValid() && db.isValid()) return da.isBefore(db) ? -1 : 1;
          } catch {}
          return String(a).localeCompare(String(b));
        });
      return formatTimeForPdf(sorted[0], dateKey);
    }

    if (val === null || val === undefined || val === "") return "";

    // If already a Date
    if (val instanceof Date) {
      const dtDate = dayjs(val).tz(LOCAL_TZ);
      return dtDate.isValid() ? dtDate.format("HH:mm") : "";
    }

    const str = String(val).trim();
    if (!str) return "";

    // Guarded helper to try parsing with dayjs.tz safely
    const tryTz = (input, format) => {
      try {
        const parsed = format
          ? dayjs.tz(input, format, LOCAL_TZ)
          : dayjs.tz(input, LOCAL_TZ);
        return parsed && parsed.isValid() ? parsed : null;
      } catch (e) {
        return null;
      }
    };

    // 1) Try as full ISO/datetime with timezone (guarded)
    let dt = tryTz(str);
    if (dt) return dt.format("h:mm");

    // 2) Try parsing time-only with AM/PM (e.g., '1:00 PM' or '01:00PM')
    if (/[AP]M$/i.test(str)) {
      dt = tryTz(str, "h:mm A");
      if (dt) return dt.format("h:mm");
    }

    // 3) Try parsing 24-hour time-only combined with dateKey (e.g., '13:00')
    if (/^\d{1,2}:\d{2}$/.test(str) && dateKey) {
      const combined = `${dateKey} ${str}`;
      dt = tryTz(combined, "YYYY-MM-DD HH:mm");
      if (dt) return dt.format("h:mm");
    }

    // 4) Try loose parse (without tz)
    try {
      const fallback = dayjs(str);
      if (fallback && fallback.isValid()) return fallback.format("h:mm");
    } catch (e) {
      // ignore
    }

    // If nothing works, return empty string to avoid invalid Date errors upstream
    return "";
  } catch (err) {
    // in case any unexpected error occurs, do not throw — return empty string
    return "";
  }
}

async function fetchEmployeeTrainings(empId) {
  try {
    const res = await axiosInstance.get(`/trainings/public/by-employee/${empId}`);
    return res.data?.data || [];
  } catch {
    return [];
  }
}

function getTrainingOnDay(trainings, dateKey) {
  return trainings.find((t) => {
    if (!t.trainingDate || t.trainingDate.length < 2) return false;
    const start = dayjs(t.trainingDate[0]);
    const end = dayjs(t.trainingDate[1]);
    const day = dayjs(dateKey);
    return day.isSameOrAfter(start, "day") && day.isSameOrBefore(end, "day");
  });
}

function reformatName(name) {
  if (!name || !name.includes(",")) {
    return name;
  }
  const parts = name.split(",");
  const lastName = parts[0].trim();
  const firstNameAndMiddle = parts.slice(1).join(",").trim();
  return `${firstNameAndMiddle} ${lastName}`;
}

// Robust getter for time fields that accepts multiple possible key formats
function getDayLogValue(dayLogs, label) {
  if (!dayLogs || !label) return undefined;
  const variants = [
    label,
    label.replace(/\s+/g, ""),
    label.replace(/\s+/g, "_").toLowerCase(),
    label.toLowerCase(),
  ];
  for (const k of variants) {
    if (Object.prototype.hasOwnProperty.call(dayLogs, k)) return dayLogs[k];
  }
  // try case-insensitive search
  const keys = Object.keys(dayLogs || {});
  for (const k of keys) {
    if (String(k).toLowerCase() === String(label).toLowerCase()) return dayLogs[k];
  }
  return undefined;
}

export async function generateDTRPdf({
  employee,
  _dtrDays, // dtrDays is no longer used directly here
  dtrLogs, // This is now the full dtrLogs object from state
  selectedRecord,
  download = false,
}) {
  // Helper: parse cut-off dates safely as local dates without shifting days
  const parseCutoff = (val) => {
    try {
      if (!val) return dayjs().tz(LOCAL_TZ);
      if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
        return dayjs.tz(val + ' 00:00', 'YYYY-MM-DD HH:mm', LOCAL_TZ);
      }
      // If ISO string already includes a timezone (Z or ±HH:mm), parse the instant then convert.
      if (typeof val === 'string') {
        const s = String(val);
        const hasZone = /([zZ]|[+-]\d{2}:\d{2})$/.test(s);
        if (hasZone) {
          const parsed = dayjs(s).tz(LOCAL_TZ);
          if (parsed && parsed.isValid()) return parsed;
        }
        const tzParsed = dayjs.tz(s, LOCAL_TZ);
        if (tzParsed && tzParsed.isValid()) return tzParsed;
      }
      if (val instanceof Date || typeof val === 'number') {
        const parsed = dayjs(val).tz(LOCAL_TZ);
        if (parsed && parsed.isValid()) return parsed;
      }
      const basic = dayjs(val);
      return basic.isValid() ? basic.tz(LOCAL_TZ) : dayjs().tz(LOCAL_TZ);
    } catch {
      return dayjs().tz(LOCAL_TZ);
    }
  };
  const docWidth = 100;
  const docHeight = 297;
  const leftMargin = 5;
  const rightMargin = 5;
  const centerX = docWidth / 2;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [docWidth, docHeight],
  });

  doc.setFont("Times", "normal");
  doc.setFontSize(11);

  doc.text("CSC Form 48", 5, 6);
  doc.setFontSize(12);
  doc.text("DAILY TIME RECORD", centerX, 10, { align: "center" });
  doc.setFontSize(10);
  doc.text("(Environmental Management Bureau Region 3)", centerX, 15, {
    align: "center",
  });

  doc.setFont("Times", "normal");
  doc.setFontSize(9);
  doc.text("Name:", 5, 25);
  doc.setFont("Times", "bold");
  doc.text(
    `${reformatName(employee.name) || "___________________________"}`,
    20,
    25
  );

  // Guard selectedRecord and its cut-off fields (date-only to avoid drift)
  const sc = selectedRecord && selectedRecord.DTR_Cut_Off ? selectedRecord.DTR_Cut_Off : null;
  const start = parseCutoff(sc && sc.start);
  const end = parseCutoff(sc && sc.end);

  let cutOffText;
  if (start.isSame(end, "month")) {
    cutOffText = `${start.format(
      "MMMM"
    )} ${start.date()}-${end.date()}, ${start.year()}`;
  } else {
    cutOffText = `${start.format("MMMM DD, YYYY")} - ${end.format(
      "MMMM DD, YYYY"
    )}`;
  }

  doc.setFont("Times", "normal");
  doc.setFontSize(9);
  doc.text("For the month of:", 5, 29);
  doc.setFont("Times", "bold");
  doc.text(cutOffText, 35, 29);

  doc.setFont("Times", "normal");
  doc.text(`Office Hours (regular days): _____________________`, 5, 33);
  doc.text(`Arrival and Departure: ___________________________`, 5, 37);
  doc.text(`Saturdays: _______________________________________`, 5, 41);

  // ---------- Table ----------
  const columns = [
    { header: "Day", dataKey: "day" },
    { header: "AM In", dataKey: "amIn" },
    { header: "AM Out", dataKey: "amOut" },
    { header: "PM In", dataKey: "pmIn" },
    { header: "PM Out", dataKey: "pmOut" },
    { header: "Work Status", dataKey: "status", width: 35 },
  ];

  // ---------- Fetch Holidays (PH + Local) & Suspensions & Trainings ----------
  const year = start.year();
  const holidaysPH = await fetchPhilippineHolidays(year);
  const trainings = await fetchEmployeeTrainings(employee.empId);
  const signatoriesRes = await getSignatoryEmployees();
  const signatories = signatoriesRes.data;

  // Local holidays and suspensions within cut-off (only fetch if authenticated)
  let localHolidays = [];
  let suspensions = [];
  try {
    const hasToken = !!(secureSessionGet("token") || secureRetrieve("token"));
    if (hasToken && selectedRecord && selectedRecord.DTR_Cut_Off) {
      const start = parseCutoff(selectedRecord.DTR_Cut_Off.start).format("YYYY-MM-DD");
      const end = parseCutoff(selectedRecord.DTR_Cut_Off.end).format("YYYY-MM-DD");
      const [lhRes, sRes] = await Promise.all([
        axiosInstance.get(`/local-holidays`, { params: { start, end } }),
        axiosInstance.get(`/suspensions`, { params: { start, end } }),
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
    }
  } catch {}

  const allHolidays = [
    ...holidaysPH.map((h) => ({
      date: h.date,
      name: h.localName,
      type: h.type,
    })),
    ...localHolidays,
    ...suspensions,
  ];

  // ---------- Fetch WFH records for the cut-off period ----------
  const wfhDays = new Set();
  try {
    const hasToken = !!(secureSessionGet("token") || secureRetrieve("token"));
    if (hasToken && selectedRecord && selectedRecord.DTR_Cut_Off) {
      const wfhStart = parseCutoff(selectedRecord.DTR_Cut_Off.start).format("YYYY-MM-DD");
      const wfhEnd = parseCutoff(selectedRecord.DTR_Cut_Off.end).format("YYYY-MM-DD");
      const empIds = [employee.empId, ...(employee.alternateEmpIds || [])].filter(Boolean);

      // Fetch individual WFH records AND WFH Group records in parallel
      const [wfhRes, groupRes] = await Promise.all([
        axiosInstance.get("/work-from-home/public", {
          params: { start: wfhStart, end: wfhEnd },
        }),
        axiosInstance.get("/wfh-groups/public", {
          params: { start: wfhStart, end: wfhEnd },
        }).catch(() => ({ data: { data: [] } })),
      ]);

      (wfhRes.data?.data || []).forEach((w) => {
        if (w.empId && !empIds.includes(w.empId)) return;
        const ws = dayjs(w.date).startOf("day");
        const we = w.endDate ? dayjs(w.endDate).startOf("day") : ws;
        let d = ws;
        while (d.isSameOrBefore(we, "day")) {
          wfhDays.add(d.format("YYYY-MM-DD"));
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
          wfhDays.add(d.format("YYYY-MM-DD"));
          d = d.add(1, "day");
        }
      });
    }
  } catch (_) { /* WFH lookup optional */ }

  // ---------- Build Rows for the entire calendar month ----------
  const rows = [];
  const referenceDate = start;
  const startOfMonth = referenceDate.startOf("month");
  const endOfMonth = referenceDate.endOf("month");

  const cutOffStart = start.startOf('day');
  const cutOffEnd = end.startOf('day');

  let currentDate = startOfMonth.clone();

  while (currentDate.isSameOrBefore(endOfMonth, "day")) {
    const dateKey = currentDate.tz(LOCAL_TZ).format("YYYY-MM-DD");
    const dayNum = currentDate.date();
    const dayOfWeek = currentDate.tz(LOCAL_TZ).day();

    let dayLogs = {};
    const ids = [employee.empId, ...(employee.alternateEmpIds || [])].filter(
      Boolean
    );
    for (const id of ids) {
      if (dtrLogs[id] && dtrLogs[id][dateKey]) {
        dayLogs = dtrLogs[id][dateKey];
        break;
      }
    }

    let status = "";
    const training = getTrainingOnDay(trainings, dateKey);
    const holiday = allHolidays.find((h) => {
      try {
        const start = h.date
          ? dayjs.tz(h.date, LOCAL_TZ).format("YYYY-MM-DD")
          : null;
        if (h.endDate) {
          const end = h.endDate
            ? dayjs.tz(h.endDate, LOCAL_TZ).format("YYYY-MM-DD")
            : null;
          if (start && end) {
            return (
              dayjs.tz(dateKey, LOCAL_TZ).isSameOrAfter(start, "day") &&
              dayjs.tz(dateKey, LOCAL_TZ).isSameOrBefore(end, "day")
            );
          }
        }
        return start === dateKey;
      } catch (e) {
        return false;
      }
    });

    if (training) {
      status = `${training.name} (${training.iisTransaction})`;
    } else if (holiday) {
      status =
        holiday.type === "Suspension"
          ? `Suspension: ${holiday.name}`
          : holiday.name || "Holiday";
    } else if (dayOfWeek === 0) {
      status = "Sunday";
    } else if (dayOfWeek === 6) {
      status = "Saturday";
    } else if (wfhDays.has(dateKey)) {
      status = "WFH (see attch.)";
    }

    const isInCutOff =
      currentDate.isSameOrAfter(cutOffStart, "day") &&
      currentDate.isSameOrBefore(cutOffEnd, "day");

    const rawAmIn = getDayLogValue(dayLogs, "Time In");
    const rawPmOut = getDayLogValue(dayLogs, "Time Out");
    const rawAmOut = getDayLogValue(dayLogs, "Break Out");
    const rawPmIn = getDayLogValue(dayLogs, "Break In");

    const amIn = formatTimeForPdf(rawAmIn, dateKey) || "";
    const pmOut = formatTimeForPdf(rawPmOut, dateKey) || "";
    const amOut = formatTimeForPdf(rawAmOut, dateKey) || (isInCutOff && amIn ? "12:00" : "");
    const pmIn = formatTimeForPdf(rawPmIn, dateKey) || (isInCutOff && pmOut ? "1:00" : "");

    const hasLogs = !!(amIn || amOut || pmIn || pmOut);

    rows.push({
      day: dayNum,
      amIn: isInCutOff ? amIn : "",
      amOut: isInCutOff ? amOut : "",
      pmIn: isInCutOff ? pmIn : "",
      pmOut: isInCutOff ? pmOut : "",
      status: status,
      isTraining: !!training,
      isHoliday: !!holiday,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      hasLogs: isInCutOff && hasLogs, // Logs only count if within cut-off
      isInCutOff: isInCutOff,
    });

    currentDate = currentDate.add(1, "day");
  }

  // Compute consecutive training day blocks for vertical merging (rowSpan)
  const trainingBlocks = [];
  {
    let i = 0;
    while (i < rows.length) {
      if (rows[i] && rows[i].isTraining) {
        let j = i;
        while (j + 1 < rows.length && rows[j + 1] && rows[j + 1].isTraining) j++;
        trainingBlocks.push({ start: i, end: j, length: j - i + 1, text: rows[i].status });
        i = j + 1;
      } else {
        i++;
      }
    }
  }

  autoTable(doc, {
    startY: 45,
    head: [columns.map((col) => col.header)],
    body: rows.map((row) => columns.map((col) => row[col.dataKey])),
    styles: {
      font: "times",
      fontSize: 9,
      cellPadding: 1,
      textColor: 0,
      lineColor: 0,
      lineWidth: 0.3,
      halign: "center",
      valign: "middle",
    },
    headStyles: {
      fillColor: [220, 220, 220],
      textColor: 0,
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "center",
      valign: "middle",
      overflow: "linebreak",
    },
    margin: { left: leftMargin, right: rightMargin },
    theme: "grid",
    tableWidth: "auto",
    pageBreak: "avoid",
    didParseCell: function (data) {
      if (data.section === "body") {
        const row = rows[data.row.index];
        const SPECIAL_FONT_SIZE = 8; // emphasize weekends/holidays/suspensions
        const statusColIndex = columns.findIndex((c) => c.dataKey === "status");

        // Default: use a smaller font for work status values so the cells don't overflow
        if (data.column.index === statusColIndex) {
          data.cell.styles.fontSize = 7;
        }

        // Vertical merge for training blocks: keep Day unmerged, merge time/status
        const block = trainingBlocks.find(
          (b) => data.row.index >= b.start && data.row.index <= b.end
        );
        if (block) {
          if (data.column.index === 1) {
            if (data.row.index === block.start) {
              data.cell.rowSpan = block.length;
              data.cell.colSpan = columns.length - 1;
              data.cell.styles.halign = "center";
              data.cell.styles.valign = "middle";
              data.cell.styles.fontSize = 7;
              data.cell.styles.cellPadding = 1;
              data.cell.styles.overflow = "linebreak";
              data.cell.styles.minCellHeight = 7;
              data.cell.text = [block.text.replace(/\s+/g, " ")];
              data.cell.styles.fillColor = [230, 230, 230];
            } else {
              data.cell.text = "";
            }
          } else if (data.column.index > 1) {
            data.cell.text = "";
          }
          if (data.column.index === 0) {
            data.cell.styles.fillColor = [230, 230, 230];
          }
          return;
        }
        const mergeRowText = (text, fontSize = 7) => {
          const normalizedText = text.replace(/\s+/g, " "); // remove extra spaces
          if (data.column.index === 1) {
            data.cell.colSpan = columns.length - 1; // span all remaining columns
            data.cell.styles.halign = "center";
            data.cell.styles.valign = "middle";
            data.cell.styles.fontSize = fontSize; // size according to row type
            data.cell.styles.cellPadding = 1; // minimal padding
            data.cell.styles.overflow = "linebreak"; // wrap text
            data.cell.styles.minCellHeight = 7; // adjust row height slightly taller
            data.cell.text = [normalizedText]; // wrap text properly
          } else if (data.column.index > 1) {
            data.cell.text = "";
          }
          data.cell.styles.fillColor = [230, 230, 230];
        };

        // Training rows handled by vertical block merge above

        // Merge holiday/weekend rows
        if ((row.isHoliday || row.isWeekend) && !row.hasLogs) {
          mergeRowText(row.status, SPECIAL_FONT_SIZE); // larger for emphasis
        }

        // Shade special days (weekend/holiday/suspension/training) across the row
        const isSpecialDay =
          row.isWeekend ||
          row.isHoliday ||
          row.isTraining ||
          (row.status || "").startsWith("Suspension");
        if (isSpecialDay) {
          data.cell.styles.fillColor = [230, 230, 230];
        }

        // Non-merged rows: bump font size of status cell for special days
        if (
          row &&
          row.hasLogs &&
          data.column.index === statusColIndex &&
          (row.isHoliday ||
            row.isWeekend ||
            (row.status || "").startsWith("Suspension"))
        ) {
          data.cell.styles.fontSize = SPECIAL_FONT_SIZE;
        }
      }
    },
  });

  // ---------- Dynamic Certification & Signatures ----------
  let certY = doc.lastAutoTable.finalY + 9;

  doc.setFontSize(8);
  doc.text(
    "I hereby certify on my honor that the above is a true and correct report of work\nperformed,record of which was made daily at the time and\ndeparture from office.",
    centerX,
    certY,
    { align: "center" }
  );
  certY += 2;

  doc.text("_______________________________", centerX, certY + 12, {
    align: "center",
  });
  doc.setFont("Times", "bold");
  doc.text(reformatName(employee.name) || "", centerX, certY + 12, {
    align: "center",
  });
  doc.setFont("Times", "normal");
  doc.text("Name of the Employee", centerX, certY + 16, { align: "center" });

  const supervisorY = certY + 23;
  const signatory = signatories.find(
    (sig) =>
      sig.signatoryDesignation &&
      sig.signatoryDesignation.includes(employee.sectionOrUnit)
  );

  const supervisorName = signatory ? signatory.name : "";

  doc.text("_______________________________", centerX, supervisorY, {
    align: "center",
  });

  doc.setFont("Times", "bold");
  doc.text(reformatName(supervisorName) || "", centerX, supervisorY, {
    align: "center",
  });
  doc.setFont("Times", "normal");

  doc.text("Section Incharge/Supervisor", centerX, supervisorY + 4, {
    align: "center",
  });

  doc.setFontSize(7);
  doc.text("EMBR3 DTR Management System", 3, 295);
  doc.text(`${dayjs().format("MM/DD/YYYY")}`, 97, 295, { align: "right" });

  const pdfBlob = doc.output("blob");
  if (download) return pdfBlob;
  window.open(URL.createObjectURL(pdfBlob), "_blank");
}

export async function generateBatchDTRPdf(printerTray) {
  if (!printerTray.length) return;

  const docWidth = 100; // Use consistent width
  const docHeight = 297;
  const leftMargin = 5;
  const rightMargin = 5;
  const centerX = docWidth / 2;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [docWidth, docHeight],
  });

  const signatoriesRes = await getSignatoryEmployees();
  const signatories = signatoriesRes.data;

  // Determine overall cut-off range for filename
  let earliestStart = dayjs(printerTray[0].selectedRecord.DTR_Cut_Off.start);
  let latestEnd = dayjs(printerTray[0].selectedRecord.DTR_Cut_Off.end);
  for (const item of printerTray) {
    const start = dayjs(item.selectedRecord.DTR_Cut_Off.start);
    const end = dayjs(item.selectedRecord.DTR_Cut_Off.end);
    if (start.isBefore(earliestStart)) earliestStart = start;
    if (end.isAfter(latestEnd)) latestEnd = end;
  }

  const filename = `Batch_DTRs_${earliestStart.format(
    "MMMDDYYYY"
  )}-${latestEnd.format("MMMDDYYYY")}.pdf`;

  // Helper for batch: parse date-only or ISO as local Manila date
  const parseCutoffBatch = (val) => {
    try {
      if (!val) return dayjs().tz(LOCAL_TZ);
      if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
        return dayjs.tz(val + ' 00:00', 'YYYY-MM-DD HH:mm', LOCAL_TZ);
      }
      if (typeof val === 'string') {
        const s = String(val);
        const hasZone = /([zZ]|[+-]\d{2}:\d{2})$/.test(s);
        if (hasZone) {
          const parsed = dayjs(s).tz(LOCAL_TZ);
          if (parsed && parsed.isValid()) return parsed;
        }
        const tzParsed = dayjs.tz(s, LOCAL_TZ);
        if (tzParsed && tzParsed.isValid()) return tzParsed;
      }
      if (val instanceof Date || typeof val === 'number') {
        const parsed = dayjs(val).tz(LOCAL_TZ);
        if (parsed && parsed.isValid()) return parsed;
      }
      const basic = dayjs(val);
      return basic && basic.isValid() ? basic.tz(LOCAL_TZ) : dayjs().tz(LOCAL_TZ);
    } catch {
      return dayjs().tz(LOCAL_TZ);
    }
  };

  for (let i = 0; i < printerTray.length; i++) {
    const { employee, dtrLogs, selectedRecord } = printerTray[i];

    if (i > 0) doc.addPage([docWidth, docHeight], "portrait");

    doc.setFont("Times", "normal");
    doc.setFontSize(11);
    doc.text("CSC Form 48", 5, 6);
    doc.setFontSize(12);
    doc.text("DAILY TIME RECORD", centerX, 10, { align: "center" });
    doc.setFontSize(10);
    doc.text("(Environmental Management Bureau Region 3)", centerX, 15, {
      align: "center",
    });

    doc.setFont("Times", "normal");
    doc.setFontSize(9);
    doc.text("Name:", 5, 25);
    doc.setFont("Times", "bold");
    doc.text(
      `${reformatName(employee.name) || "___________________________"}`,
      20,
      25
    );

  const start = parseCutoffBatch(selectedRecord.DTR_Cut_Off.start);
  const end = parseCutoffBatch(selectedRecord.DTR_Cut_Off.end);

    let cutOffText;
    if (start.isSame(end, "month")) {
      cutOffText = `${start.format(
        "MMMM"
      )} ${start.date()}-${end.date()}, ${start.year()}`;
    } else {
      cutOffText = `${start.format("MMMM DD, YYYY")} - ${end.format(
        "MMMM DD, YYYY"
      )}`;
    }

    doc.setFont("Times", "normal");
    doc.setFontSize(9);
    doc.text("For the month of:", 5, 29);
    doc.setFont("Times", "bold");
    doc.text(cutOffText, 35, 29);

    doc.setFont("Times", "normal");
    doc.text(`Office Hours (regular days): _____________________`, 5, 33);
    doc.text(`Arrival and Departure: ___________________________`, 5, 37);
    doc.text(`Saturdays: _______________________________________`, 5, 41);

    const columns = [
      { header: "Day", dataKey: "day" },
      { header: "AM In", dataKey: "amIn" },
      { header: "AM Out", dataKey: "amOut" },
      { header: "PM In", dataKey: "pmIn" },
      { header: "PM Out", dataKey: "pmOut" },
      { header: "Work Status", dataKey: "status", width: 40 },
    ];

    const year = start.year();
    const holidaysPH = await fetchPhilippineHolidays(year);
    const trainings = await fetchEmployeeTrainings(employee.empId);

    const rows = [];
  const referenceDate = parseCutoffBatch(selectedRecord.DTR_Cut_Off.start);
    const startOfMonth = referenceDate.startOf("month");
    const endOfMonth = referenceDate.endOf("month");

  const cutOffStart = start.startOf('day');
  const cutOffEnd = end.endOf('day');

    // Local holidays and suspensions within cut-off
    let localHolidays = [];
    let suspensions = [];
    try {
      const start = cutOffStart.format("YYYY-MM-DD");
      const end = cutOffEnd.format("YYYY-MM-DD");
      const [lhRes, sRes] = await Promise.all([
        axiosInstance.get(`/local-holidays`, { params: { start, end } }),
        axiosInstance.get(`/suspensions`, { params: { start, end } }),
      ]);
      localHolidays = (lhRes.data?.data || []).map((h) => ({
        date: dayjs(h.date).format("YYYY-MM-DD"),
        endDate: h.endDate ? dayjs(h.endDate).format("YYYY-MM-DD") : null,
        name: h.name,
        type: "Local Holiday",
        location: h.location,
      }));
      suspensions = (sRes.data?.data || []).map((s) => ({
        date: dayjs(s.date).format("YYYY-MM-DD"),
        endDate: s.endDate ? dayjs(s.endDate).format("YYYY-MM-DD") : null,
        name: s.title,
        type: "Suspension",
        scope: s.scope,
        location: s.location,
        referenceNo: s.referenceNo,
      }));
    } catch {}

    const allHolidays = [
      ...holidaysPH.map((h) => ({
        date: h.date,
        name: h.localName,
        type: h.type,
      })),
      ...localHolidays,
      ...suspensions,
    ];

    // Fetch WFH records for the cut-off period
    const wfhDaysBatch = new Set();
    try {
      const empIds = [employee.empId, ...(employee.alternateEmpIds || [])].filter(Boolean);
      const wfhStart = cutOffStart.format("YYYY-MM-DD");
      const wfhEnd = cutOffEnd.format("YYYY-MM-DD");

      // Fetch individual WFH records AND WFH Group records in parallel
      const [wfhRes, groupRes] = await Promise.all([
        axiosInstance.get("/work-from-home/public", {
          params: { start: wfhStart, end: wfhEnd },
        }),
        axiosInstance.get("/wfh-groups/public", {
          params: { start: wfhStart, end: wfhEnd },
        }).catch(() => ({ data: { data: [] } })),
      ]);

      (wfhRes.data?.data || []).forEach((w) => {
        if (w.empId && !empIds.includes(w.empId)) return;
        const ws = dayjs(w.date).startOf("day");
        const we = w.endDate ? dayjs(w.endDate).startOf("day") : ws;
        let d = ws;
        while (d.isSameOrBefore(we, "day")) {
          wfhDaysBatch.add(d.format("YYYY-MM-DD"));
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
          wfhDaysBatch.add(d.format("YYYY-MM-DD"));
          d = d.add(1, "day");
        }
      });
    } catch (_) { /* WFH lookup optional */ }

    let currentDate = startOfMonth.clone();

    while (currentDate.isSameOrBefore(endOfMonth, "day")) {
  const dateKey = currentDate.tz(LOCAL_TZ).format("YYYY-MM-DD");
  const dayNum = currentDate.tz(LOCAL_TZ).date();
  const dayOfWeek = currentDate.tz(LOCAL_TZ).day();
      let dayLogs = {};
      let status = "";

      const training = getTrainingOnDay(trainings, dateKey);
      const holiday = allHolidays.find((h) => {
        const start = dayjs(h.date).format("YYYY-MM-DD");
        if (h.endDate) {
          const end = dayjs(h.endDate).format("YYYY-MM-DD");
          return (
            dayjs(dateKey).isSameOrAfter(start, "day") &&
            dayjs(dateKey).isSameOrBefore(end, "day")
          );
        }
        return start === dateKey;
      });

      if (training) {
        status = `${training.name} (${training.iisTransaction})`;
      } else if (holiday) {
        status =
          holiday.type === "Suspension"
            ? `Suspension: ${holiday.name}`
            : holiday.name || "Holiday";
      } else if (dayOfWeek === 0) {
        status = "Sunday";
      } else if (dayOfWeek === 6) {
        status = "Saturday";
      } else if (wfhDaysBatch.has(dateKey)) {
        status = "WFH (see attch.)";
      }

      // Correctly find logs using full empId
      const ids = [employee.empId, ...(employee.alternateEmpIds || [])].filter(
        Boolean
      );
      for (const id of ids) {
        if (dtrLogs[id] && dtrLogs[id][dateKey]) {
          dayLogs = dtrLogs[id][dateKey];
          break;
        }
      }

      const isInCutOff =
        currentDate.isSameOrAfter(cutOffStart, "day") &&
        currentDate.isSameOrBefore(cutOffEnd, "day");

      const rawAmIn = getDayLogValue(dayLogs, "Time In");
      const rawPmOut = getDayLogValue(dayLogs, "Time Out");
      const rawAmOut = getDayLogValue(dayLogs, "Break Out");
      const rawPmIn = getDayLogValue(dayLogs, "Break In");

      const amIn = formatTimeForPdf(rawAmIn, dateKey) || "";
      const pmOut = formatTimeForPdf(rawPmOut, dateKey) || "";
      const amOut = formatTimeForPdf(rawAmOut, dateKey) || (isInCutOff && amIn ? "12:00" : "");
      const pmIn = formatTimeForPdf(rawPmIn, dateKey) || (isInCutOff && pmOut ? "1:00" : "");

      const hasLogs = !!(amIn || amOut || pmIn || pmOut);

      rows.push({
        day: dayNum,
        amIn: isInCutOff ? amIn : "",
        amOut: isInCutOff ? amOut : "",
        pmIn: isInCutOff ? pmIn : "",
        pmOut: isInCutOff ? pmOut : "",
        status: status,
        isTraining: !!training,
        isHoliday: !!holiday,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        hasLogs: isInCutOff && hasLogs,
        isInCutOff: isInCutOff,
      });

      currentDate = currentDate.add(1, "day");
    }

    autoTable(doc, {
      startY: 45,
      head: [columns.map((col) => col.header)],
      body: rows.map((row) => columns.map((col) => row[col.dataKey])),
      styles: {
        font: "times",
        fontSize: 9,
        cellPadding: 1,
        textColor: 0,
        lineColor: 0,
        lineWidth: 0.3,
        halign: "center",
        valign: "middle",
      },
      headStyles: {
        fillColor: [220, 220, 220],
        textColor: 0,
        fontStyle: "bold",
        fontSize: 7.5,
        halign: "center",
        valign: "middle",
        overflow: "linebreak",
      },
      margin: { left: leftMargin, right: rightMargin },
      theme: "grid",
      tableWidth: "auto",
      pageBreak: "avoid",
      didParseCell: function (data) {
        if (data.section === "body") {
          const row = rows[data.row.index];
          if (!row) return;
          const SPECIAL_FONT_SIZE = 9; // emphasize weekends/holidays/suspensions
          const statusColIndex = columns.findIndex(
            (c) => c.dataKey === "status"
          );
          // Default: use a smaller font for work status values so the cells don't overflow
          if (data.column.index === statusColIndex) {
            data.cell.styles.fontSize = 7;
          }
          const mergeRowText = (text, fontSize = 7) => {
            const normalizedText = text.replace(/\s+/g, " ");
            if (data.column.index === 1) {
              data.cell.colSpan = columns.length - 1;
              data.cell.styles.halign = "center";
              data.cell.styles.valign = "middle";
              data.cell.styles.fontSize = fontSize; // size according to row type
              data.cell.styles.cellPadding = 1;
              data.cell.styles.overflow = "linebreak";
              data.cell.styles.minCellHeight = 8;
              data.cell.text = [normalizedText];
            } else if (data.column.index > 1) {
              data.cell.text = "";
            }
            data.cell.styles.fillColor = [230, 230, 230];
          };

          // Merge training rows (always merge time columns on training days)
          if (row.isTraining) {
            mergeRowText(row.status, 7); // keep training at regular merged size
          }
          if ((row.isHoliday || row.isWeekend) && !row.hasLogs) {
            mergeRowText(row.status, SPECIAL_FONT_SIZE); // larger for emphasis
          }

          // Shade special days (weekend/holiday/suspension/training) across the row
          const isSpecialDay =
            row.isWeekend ||
            row.isHoliday ||
            row.isTraining ||
            (row.status || "").startsWith("Suspension");
          if (isSpecialDay) {
            data.cell.styles.fillColor = [230, 230, 230];
          }

          // Non-merged rows: bump font size of status cell for special days
          if (
            row.hasLogs &&
            data.column.index === statusColIndex &&
            (row.isHoliday ||
              row.isWeekend ||
              (row.status || "").startsWith("Suspension"))
          ) {
            data.cell.styles.fontSize = SPECIAL_FONT_SIZE;
          }
        }
      },
    });

    // (Legend removed by request)

    let tableBottom = doc.lastAutoTable.finalY;
    let certY = tableBottom + 5;

    doc.setFontSize(8);
    doc.text(
      "I hereby certify on my honor that the above is a true and correct report of work\nperformed,record of which was made daily at the time and\ndeparture from office.",
      centerX,
      certY,
      { align: "center" }
    );
    certY += 2;

    doc.text("_______________________________", centerX, certY + 12, {
      align: "center",
    });
    doc.setFont("Times", "bold");
    doc.text(reformatName(employee.name) || "", centerX, certY + 12, {
      align: "center",
    });
    doc.setFont("Times", "normal");
    doc.text("Name of the Employee", centerX, certY + 16, { align: "center" });

    const supervisorY = certY + 23;
    const signatory = signatories.find(
      (sig) =>
        sig.signatoryDesignation &&
        sig.signatoryDesignation.includes(employee.sectionOrUnit)
    );

    const supervisorName = signatory ? signatory.name : "";

    doc.text("_______________________________", centerX, supervisorY, {
      align: "center",
    });

    doc.setFont("Times", "bold");
    doc.text(reformatName(supervisorName) || "", centerX, supervisorY, {
      align: "center",
    });
    doc.setFont("Times", "normal");

    doc.text("Section Incharge/Supervisor", centerX, supervisorY + 4, {
      align: "center",
    });

    doc.setFontSize(7);
    doc.text("EMBR3 DTR Management System", 3, 295);
    doc.text(`${dayjs().format("MM/DD/YYYY")}`, 97, 295, { align: "right" });
  }

  doc.save(filename);
}

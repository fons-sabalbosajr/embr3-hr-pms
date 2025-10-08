import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { fetchPhilippineHolidays } from "../src/api/holidayPH";
import axios from "axios";
import axiosInstance from "../src/api/axiosInstance";
import { getSignatoryEmployees } from "../src/api/employeeAPI.js";

dayjs.extend(utc);
dayjs.extend(timezone);
const LOCAL_TZ = "Asia/Manila";

async function fetchEmployeeTrainings(empId) {
  try {
    const res = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL}/trainings/by-employee/${empId}`
    );
    return res.data.data || [];
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

export async function generateDTRPdf({
  employee,
  _dtrDays, // dtrDays is no longer used directly here
  dtrLogs, // This is now the full dtrLogs object from state
  selectedRecord,
  download = false,
}) {
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

  const start = dayjs.tz(selectedRecord.DTR_Cut_Off.start, LOCAL_TZ);
  const end = dayjs.tz(selectedRecord.DTR_Cut_Off.end, LOCAL_TZ);

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
    { header: "Work Status", dataKey: "status" },
  ];

  // ---------- Fetch Holidays (PH + Local) & Suspensions & Trainings ----------
  const year = dayjs.tz(selectedRecord.DTR_Cut_Off.start, LOCAL_TZ).year();
  const holidaysPH = await fetchPhilippineHolidays(year);
  const trainings = await fetchEmployeeTrainings(employee.empId);
  const signatoriesRes = await getSignatoryEmployees();
  const signatories = signatoriesRes.data;

  // Local holidays and suspensions within cut-off
  let localHolidays = [];
  let suspensions = [];
  try {
    const start = dayjs(selectedRecord.DTR_Cut_Off.start).format("YYYY-MM-DD");
    const end = dayjs(selectedRecord.DTR_Cut_Off.end).format("YYYY-MM-DD");
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

  // ---------- Build Rows for the entire calendar month ----------
  const rows = [];
  const referenceDate = dayjs.tz(selectedRecord.DTR_Cut_Off.start, LOCAL_TZ);
  const startOfMonth = referenceDate.startOf("month");
  const endOfMonth = referenceDate.endOf("month");

  const cutOffStart = dayjs.tz(selectedRecord.DTR_Cut_Off.start, LOCAL_TZ);
  const cutOffEnd = dayjs.tz(selectedRecord.DTR_Cut_Off.end, LOCAL_TZ);

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
      const start = dayjs.tz(h.date, LOCAL_TZ).format("YYYY-MM-DD");
      if (h.endDate) {
        const end = dayjs.tz(h.endDate, LOCAL_TZ).format("YYYY-MM-DD");
        return (
          dayjs.tz(dateKey, LOCAL_TZ).isSameOrAfter(start, "day") &&
          dayjs.tz(dateKey, LOCAL_TZ).isSameOrBefore(end, "day")
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
    }

    const isInCutOff =
      currentDate.isSameOrAfter(cutOffStart, "day") &&
      currentDate.isSameOrBefore(cutOffEnd, "day");

    const amIn = dayLogs["Time In"] || "";
    const pmOut = dayLogs["Time Out"] || "";
    const amOut =
      dayLogs["Break Out"] || (isInCutOff && amIn ? "12:00 PM" : "");
    const pmIn = dayLogs["Break In"] || (isInCutOff && pmOut ? "1:00 PM" : "");

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
        const SPECIAL_FONT_SIZE = 9; // emphasize weekends/holidays/suspensions
        const statusColIndex = columns.findIndex((c) => c.dataKey === "status");
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

        // Merge training rows
        if (row.isTraining && !row.hasLogs) {
          mergeRowText(row.status, 7); // keep training at regular merged size
        }

        // Merge holiday/weekend rows
        if ((row.isHoliday || row.isWeekend) && !row.hasLogs) {
          mergeRowText(row.status, SPECIAL_FONT_SIZE); // larger for emphasis
        }

        // Non-merged rows: bump font size of status cell for special days
        if (
          row &&
          row.hasLogs &&
          data.column.index === statusColIndex &&
          (row.isHoliday || row.isWeekend || (row.status || "").startsWith("Suspension"))
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

    const start = dayjs(selectedRecord.DTR_Cut_Off.start);
    const end = dayjs(selectedRecord.DTR_Cut_Off.end);

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
      { header: "Work Status", dataKey: "status" },
    ];

    const year = dayjs(selectedRecord.DTR_Cut_Off.start).year();
    const holidaysPH = await fetchPhilippineHolidays(year);
    const trainings = await fetchEmployeeTrainings(employee.empId);

    const rows = [];
    const referenceDate = dayjs(selectedRecord.DTR_Cut_Off.start);
    const startOfMonth = referenceDate.startOf("month");
    const endOfMonth = referenceDate.endOf("month");

    const cutOffStart = dayjs(selectedRecord.DTR_Cut_Off.start);
    const cutOffEnd = dayjs(selectedRecord.DTR_Cut_Off.end);

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

    let currentDate = startOfMonth.clone();

    while (currentDate.isSameOrBefore(endOfMonth, "day")) {
      const dateKey = currentDate.format("YYYY-MM-DD");
      const dayNum = currentDate.date();
      const dayOfWeek = currentDate.day();
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

      const amIn = dayLogs["Time In"] || "";
      const pmOut = dayLogs["Time Out"] || "";
      const amOut =
        dayLogs["Break Out"] || (isInCutOff && amIn ? "12:00 PM" : "");
      const pmIn =
        dayLogs["Break In"] || (isInCutOff && pmOut ? "1:00 PM" : "");

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
          const SPECIAL_FONT_SIZE = 11; // emphasize weekends/holidays/suspensions
          const statusColIndex = columns.findIndex((c) => c.dataKey === "status");
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

          if (row.isTraining && !row.hasLogs) {
            mergeRowText(row.status, 7); // keep training at regular merged size
          }
          if ((row.isHoliday || row.isWeekend) && !row.hasLogs) {
            mergeRowText(row.status, SPECIAL_FONT_SIZE); // larger for emphasis
          }

          // Non-merged rows: bump font size of status cell for special days
          if (
            row.hasLogs &&
            data.column.index === statusColIndex &&
            (row.isHoliday || row.isWeekend || (row.status || "").startsWith("Suspension"))
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

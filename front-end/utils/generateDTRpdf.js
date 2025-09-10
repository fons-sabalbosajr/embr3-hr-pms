import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";
import { fetchPhilippineHolidays } from "../src/api/holidayPH";
import axios from "axios";

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
  doc.text(`${employee.name || "___________________________"}`, 20, 25);

  const start = dayjs(selectedRecord.DTR_Cut_Off.start);
  const end = dayjs(selectedRecord.DTR_Cut_Off.end);

  let cutOffText;
  if (start.isSame(end, 'month')) {
    cutOffText = `${start.format('MMMM')} ${start.date()}-${end.date()}, ${start.year()}`;
  } else {
    cutOffText = `${start.format('MMMM DD, YYYY')} - ${end.format('MMMM DD, YYYY')}`;
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

  // ---------- Fetch Holidays & Trainings ----------
  const year = dayjs(selectedRecord.DTR_Cut_Off.start).year();
  const holidays = await fetchPhilippineHolidays(year);
  const trainings = await fetchEmployeeTrainings(employee.empId);

  // ---------- Build Rows for the entire calendar month ----------
  const rows = [];
  const referenceDate = dayjs(selectedRecord.DTR_Cut_Off.start);
  const startOfMonth = referenceDate.startOf("month");
  const endOfMonth = referenceDate.endOf("month");

  const cutOffStart = dayjs(selectedRecord.DTR_Cut_Off.start);
  const cutOffEnd = dayjs(selectedRecord.DTR_Cut_Off.end);

  let currentDate = startOfMonth.clone();

  while (currentDate.isSameOrBefore(endOfMonth, "day")) {
    const dateKey = currentDate.format("YYYY-MM-DD");
    const dayNum = currentDate.date();
    const dayOfWeek = currentDate.day();

    let dayLogs = {};
    const ids = [employee.empId, ...(employee.alternateEmpIds || [])].filter(Boolean);
    for (const id of ids) {
      if (dtrLogs[id] && dtrLogs[id][dateKey]) {
        dayLogs = dtrLogs[id][dateKey];
        break;
      }
    }

    let status = "";
    const training = getTrainingOnDay(trainings, dateKey);
    const holiday = holidays.find((h) => h.date === dateKey);

    if (training) {
      status = `${training.name} (${training.iisTransaction})`;
    } else if (holiday) {
      status = holiday.localName || "Holiday";
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
    const amOut = dayLogs["Break Out"] || (isInCutOff && amIn ? "12:00 PM" : "");
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
        const mergeRowText = (text) => {
          const normalizedText = text.replace(/\s+/g, " "); // remove extra spaces
          if (data.column.index === 1) {
            data.cell.colSpan = columns.length - 1; // span all remaining columns
            data.cell.styles.halign = "center";
            data.cell.styles.valign = "middle";
            data.cell.styles.fontSize = 7; // readable size
            data.cell.styles.cellPadding = 1; // minimal padding
            data.cell.styles.overflow = "linebreak"; // wrap text
            data.cell.styles.minCellHeight = 7; // adjust row height
            data.cell.text = [normalizedText]; // wrap text properly
          } else if (data.column.index > 1) {
            data.cell.text = "";
          }
          data.cell.styles.fillColor = [230, 230, 230];
        };

        // Merge training rows
        if (row.isTraining && !row.hasLogs) {
          mergeRowText(row.status);
        }

        // Merge holiday/weekend rows
        if ((row.isHoliday || row.isWeekend) && !row.hasLogs) {
          mergeRowText(row.status);
        }
      }
    },
  });

  // ---------- Dynamic Certification & Signatures ----------
  let tableBottom = doc.lastAutoTable.finalY;
  let certY = tableBottom + 5;

  doc.setFontSize(8);
  doc.text(
    "I hereby certify on my honor that the above is a true and correct report of work\nperformed, record of which was made daily at the time\nand departure from office.",
    centerX,
    certY,
    { align: "center" }
  );
  certY += 2;

  doc.text("_______________________________", centerX, certY + 12, {
    align: "center",
  });
  doc.setFont("Times", "bold");
  doc.text(employee.name || "", centerX, certY + 12, { align: "center" });
  doc.setFont("Times", "normal");
  doc.text("Name of the Employee", centerX, certY + 16, { align: "center" });

  const supervisorY = certY + 23;
  doc.text("_______________________________", centerX, supervisorY, {
    align: "center",
  });
  doc.text("Section Incharge/Supervisor", centerX, supervisorY + 4, {
    align: "center",
  });

  doc.setFontSize(7);
  doc.text("EMBR3 Payroll Management System", 3, 295);
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
    doc.text(`${employee.name || "___________________________"}`, 20, 25);

    const start = dayjs(selectedRecord.DTR_Cut_Off.start);
    const end = dayjs(selectedRecord.DTR_Cut_Off.end);

    let cutOffText;
    if (start.isSame(end, 'month')) {
      cutOffText = `${start.format('MMMM')} ${start.date()}-${end.date()}, ${start.year()}`;
    } else {
      cutOffText = `${start.format('MMMM DD, YYYY')} - ${end.format('MMMM DD, YYYY')}`;
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
    const holidays = await fetchPhilippineHolidays(year);
    const trainings = await fetchEmployeeTrainings(employee.empId);

    const rows = [];
    const referenceDate = dayjs(selectedRecord.DTR_Cut_Off.start);
    const startOfMonth = referenceDate.startOf("month");
    const endOfMonth = referenceDate.endOf("month");

    const cutOffStart = dayjs(selectedRecord.DTR_Cut_Off.start);
    const cutOffEnd = dayjs(selectedRecord.DTR_Cut_Off.end);

    let currentDate = startOfMonth.clone();

    while (currentDate.isSameOrBefore(endOfMonth, "day")) {
      const dateKey = currentDate.format("YYYY-MM-DD");
      const dayNum = currentDate.date();
      const dayOfWeek = currentDate.day();
      let dayLogs = {};
      let status = "";

      const training = getTrainingOnDay(trainings, dateKey);
      const holiday = holidays.find((h) => h.date === dateKey);

      if (training) {
        status = `${training.name} (${training.iisTransaction})`;
      } else if (holiday) {
        status = holiday.localName || "Holiday";
      } else if (dayOfWeek === 0) {
        status = "Sunday";
      } else if (dayOfWeek === 6) {
        status = "Saturday";
      }

      // Correctly find logs using full empId
      const ids = [employee.empId, ...(employee.alternateEmpIds || [])].filter(Boolean);
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
      const amOut = dayLogs["Break Out"] || (isInCutOff && amIn ? "12:00 PM" : "");
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
          const mergeRowText = (text) => {
            const normalizedText = text.replace(/\s+/g, " ");
            if (data.column.index === 1) {
              data.cell.colSpan = columns.length - 1;
              data.cell.styles.halign = "center";
              data.cell.styles.valign = "middle";
              data.cell.styles.fontSize = 7;
              data.cell.styles.cellPadding = 1;
              data.cell.styles.overflow = "linebreak";
              data.cell.styles.minCellHeight = 7;
              data.cell.text = [normalizedText];
            } else if (data.column.index > 1) {
              data.cell.text = "";
            }
            data.cell.styles.fillColor = [230, 230, 230];
          };

          if (row.isTraining && !row.hasLogs) {
            mergeRowText(row.status);
          }
          if ((row.isHoliday || row.isWeekend) && !row.hasLogs) {
            mergeRowText(row.status);
          }
        }
      },
    });

    let tableBottom = doc.lastAutoTable.finalY;
    let certY = tableBottom + 5;

    doc.setFontSize(8);
    doc.text(
      "I hereby certify on my honor that the above is a true and correct report of work\nperformed, record of which was made daily at the time\nand departure from office.",
      centerX,
      certY,
      { align: "center" }
    );
    certY += 2;

    doc.text("_______________________________", centerX, certY + 12, {
      align: "center",
    });
    doc.setFont("Times", "bold");
    doc.text(employee.name || "", centerX, certY + 12, { align: "center" });
    doc.setFont("Times", "normal");
    doc.text("Name of the Employee", centerX, certY + 16, { align: "center" });

    const supervisorY = certY + 23;
    doc.text("_______________________________", centerX, supervisorY, {
      align: "center",
    });
    doc.text("Section Incharge/Supervisor", centerX, supervisorY + 4, {
      align: "center",
    });

    doc.setFontSize(7);
    doc.text("EMBR3 Payroll Management System", 3, 295);
    doc.text(`${dayjs().format("MM/DD/YYYY")}`, 97, 295, { align: "right" });
  }

  doc.save(filename);
}
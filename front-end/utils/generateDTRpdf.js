import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";
import { fetchPhilippineHolidays } from "../src/api/holidayPH";

export async function generateDTRPdf({
  employee,
  dtrDays,
  dtrLogs,
  selectedRecord,
  download = false,
}) {
  const docWidth = 100; // narrower width for 2 forms per A4
  const docHeight = 297;
  const leftMargin = 5;
  const rightMargin = 5;
  const centerX = docWidth / 2;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [docWidth, docHeight],
  });

  // ---------- Outer border ----------
  //doc.setLineWidth(0.1);
  //doc.rect(2, 2, docWidth - 4, docHeight - 4);

  // ---------- Header ----------
  doc.setFont("Times", "normal");
  doc.setFontSize(11);

  doc.text("CSC Form 48", 5, 7);
  doc.setFontSize(12);
  doc.text("DAILY TIME RECORD", centerX, 20, { align: "center" });
  doc.setFontSize(10);
  doc.text("(Environmental Management Bureau Region 3)", centerX, 24, {
    align: "center",
  });

  doc.setFont("Times", "normal");
  doc.setFontSize(9);
  doc.text("Name:", 5, 30);
  doc.setFont("Times", "bold");
  doc.text(`${employee.name || "___________________________"}`, 20, 30);

  const cutOff = `${dayjs(selectedRecord.DTR_Cut_Off.start).format(
    "MMMM DD, YYYY"
  )} - ${dayjs(selectedRecord.DTR_Cut_Off.end).format("MMMM DD, YYYY")}`;

  doc.setFont("Times", "normal");
  doc.setFontSize(9);
  doc.text("For the month of:", 5, 35);
  doc.setFont("Times", "bold");
  doc.text(cutOff, 35, 35);

  doc.setFont("Times", "normal");
  doc.text(`Office Hours (regular days): _____________________`, 5, 39);
  doc.text(`Arrival and Departure: ___________________________`, 5, 43);
  doc.text(`Saturdays: _______________________________________`, 5, 47);

  // ---------- Table ----------
  const columns = [
    { header: "Day", dataKey: "day" },
    { header: "AM In", dataKey: "amIn" },
    { header: "AM Out", dataKey: "amOut" },
    { header: "PM In", dataKey: "pmIn" },
    { header: "PM Out", dataKey: "pmOut" },
    { header: "Work Status", dataKey: "status" },
  ];

  const start = dayjs(selectedRecord.DTR_Cut_Off.start);
  const end = dayjs(selectedRecord.DTR_Cut_Off.end);
  const allDays = [];
  let curr = start.clone();
  while (curr.isSameOrBefore(end, "day")) {
    allDays.push(curr.clone());
    curr = curr.add(1, "day");
  }

  const year = start.year();
  const month = start.month();

  const holidays = await fetchPhilippineHolidays(year);

  const rows = Array.from({ length: 31 }, (_, i) => {
    const dayNum = i + 1;
    const dateObj = dayjs(`${year}-${month + 1}-${dayNum}`, "YYYY-M-D");
    let dayLogs = {};
    let status = "";

    const holiday = holidays.find(
      (h) => h.date === dateObj.format("YYYY-MM-DD")
    );
    if (holiday) status = holiday.name || "Holiday";
    else {
      const isInCutoff = allDays.some((d) => d.date() === dayNum);
      const dayOfWeek = dateObj.day();
      if (isInCutoff) {
        const ids = [
          employee.empId,
          ...(employee.alternateEmpIds || []),
        ].filter(Boolean);
        for (let id of ids) {
          const empKey = id.replace(/\D/g, "").slice(-4);
          if (
            dtrLogs[empKey] &&
            dtrLogs[empKey][dateObj.format("YYYY-MM-DD")]
          ) {
            dayLogs = dtrLogs[empKey][dateObj.format("YYYY-MM-DD")];
            break;
          }
        }

        if (dayOfWeek === 0) status = "Sunday";
        else if (dayOfWeek === 6) status = "Saturday";
      } else {
        if (dayOfWeek === 0) status = "Sunday";
        else if (dayOfWeek === 6) status = "Saturday";
      }
    }

    // --- Auto-fill lunch break ---
    const amIn = dayLogs["Time In"] || "";
    const amOut =
      dayLogs["Break Out"] || (amIn && dayLogs["Time Out"] ? "12:00PM" : "");
    const pmIn =
      dayLogs["Break In"] || (amIn && dayLogs["Time Out"] ? "1:00PM" : "");
    const pmOut = dayLogs["Time Out"] || "";

    return {
      day: dayNum,
      amIn,
      amOut,
      pmIn,
      pmOut,
      status,
    };
  });

  autoTable(doc, {
    startY: 52,
    head: [columns.map((col) => col.header)],
    body: rows.map((row) => columns.map((col) => row[col.dataKey])),
    styles: {
      font: "times",
      fontSize: 9, // slightly smaller to fit
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
    },
    margin: { left: leftMargin, right: rightMargin },
    theme: "grid",
    tableWidth: "auto",
    pageBreak: "avoid",
    didParseCell: function (data) {
      if (data.section === "body") {
        const row = rows[data.row.index];
        const status = row.status;
        const dayLogs = row;

        const shouldMerge = (status, dayLogs) =>
          (status === "Saturday" || status === "Sunday" || status) &&
          !dayLogs["Time In"] &&
          !dayLogs["Break Out"] &&
          !dayLogs["Break In"] &&
          !dayLogs["Time Out"];

        if (shouldMerge(status, dayLogs)) {
          if (data.column.index === 1) {
            data.cell.colSpan = 5;
            data.cell.styles.halign = "center";
            data.cell.text = status;
          } else if (data.column.index > 1) {
            data.cell.text = "";
          }
          data.cell.styles.fillColor = [230, 230, 230];
        }
      }
    },
  });

  // ---------- Dynamic Certification & Signatures ----------

  // ---------- Dynamic Certification & Signatures ----------
  let tableBottom = doc.lastAutoTable.finalY; // last row Y
  let certY = tableBottom + 5; // small spacing after table

  doc.setFontSize(8);
  // Certification text (wrap manually for narrow width)
  doc.text(
    "I hereby certify on my honor that the above is a true and\ncorrect report of work performed, record of which was\nmade daily at the time and departure from office.",
    centerX,
    certY,
    { align: "center" }
  );
  certY += 8;

  // Employee signature
  const sigSpacing = 10; // spacing from certification text
  doc.text("__________________", centerX, certY + sigSpacing, {
    align: "center",
  });
  doc.setFont("Times", "bold");
  doc.text(employee.name || "", centerX, certY + sigSpacing + 4, {
    align: "center",
  });
  doc.setFont("Times", "normal");
  doc.text("Name of the Employee", centerX, certY + sigSpacing + 8, {
    align: "center",
  });

  // Supervisor signature
  const supervisorY = certY + sigSpacing + 20; // space below employee
  doc.text("_______________________________", centerX, supervisorY, {
    align: "center",
  });
  doc.text("Section Incharge/Supervisor", centerX, supervisorY + 4, {
    align: "center",
  });

  // ---------- Footer ----------
  doc.setFontSize(7);
  doc.text("EMBR3 Payroll Management System", 5, 290);
  doc.text(`${dayjs().format("MM/DD/YYYY")}`, 95, 290, { align: "right" });

  const pdfBlob = doc.output("blob");
  if (download) return pdfBlob;
  window.open(URL.createObjectURL(pdfBlob), "_blank");
}

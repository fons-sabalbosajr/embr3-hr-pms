import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";
import letterhead from "../src/assets/letterheademb.PNG"; // adjust path if needed

let payslipCounter = 1; // auto increment (replace with persistent counter if needed)

const generatePaySlipPdf = (payslipData) => {
  const doc = new jsPDF({
    unit: "in",
    format: [4.5, 4.5],
  });

  const margin = 0.05; // reduced padding
  let y = margin;

  // Border
  doc.setLineWidth(0.005); // thinner border
  doc.rect(
    margin / 2,
    margin / 2,
    doc.internal.pageSize.width - margin,
    doc.internal.pageSize.height - margin
  );

  // Set Times New Roman
  doc.setFont("times", "normal");

  // Letterhead
  doc.addImage(letterhead, "PNG", margin / 2, y, doc.internal.pageSize.width - margin, 0.6);
  y += 0.75; // move below letterhead

  // Title
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text("PAYSLIP", doc.internal.pageSize.width / 2, y, { align: "center" });
  y += 0.35; // space below title

  doc.setFont("times", "bold");
  doc.setFontSize(9);

  // Left section (Employee info)
  const leftX = margin;
  const valueStyle = { fontStyle: "bold" };
  const underlineOffset = 0.01; // for underline

  doc.text("Name:", leftX, y);
  doc.text(`${payslipData.name || "__________"}`, leftX + 0.8, y);
  doc.setLineWidth(0.003);
  doc.line(leftX + 0.8, y + underlineOffset, leftX + 3.5, y + underlineOffset);

  y += 0.18;
  doc.text("Emp ID:", leftX, y);
  doc.text(`${payslipData.empNo || "__________"}`, leftX + 0.8, y);
  doc.line(leftX + 0.8, y + underlineOffset, leftX + 3.5, y + underlineOffset);

  y += 0.18;
  doc.text("Position:", leftX, y);
  doc.text(`${payslipData.position || "__________"}`, leftX + 0.9, y);
  doc.line(leftX + 0.9, y + underlineOffset, leftX + 3.5, y + underlineOffset);

  // Right section (Payslip info)
  let rightY = y - 0.36; // align top with Name
  const rightX = doc.internal.pageSize.width / 2 + 0.1; // start slightly right to center

  doc.text("Payslip No.:", rightX, rightY);
  doc.text(`${payslipCounter++}`, rightX + 1.2, rightY);
  doc.line(rightX + 1.2, rightY + underlineOffset, rightX + 3.5, rightY + underlineOffset);

  rightY += 0.18;
  doc.text("Date:", rightX, rightY);
  doc.text(`${dayjs().format("MM/DD/YYYY")}`, rightX + 0.35, rightY);
  doc.line(rightX + 0.35, rightY + underlineOffset, rightX + 3.5, rightY + underlineOffset);

  rightY += 0.18;
  const cutOffPeriod =
    payslipData.cutOffStartDate && payslipData.cutOffEndDate
      ? `${dayjs(payslipData.cutOffStartDate).format("MMM. D")} - ${dayjs(
          payslipData.cutOffEndDate
        ).format("D, YYYY")}`
      : "__________";

  doc.text("Cut Off:", rightX, rightY);
  doc.text(cutOffPeriod, rightX + 0.35, rightY);
  doc.line(rightX + 0.35, rightY + underlineOffset, rightX + 3.5, rightY + underlineOffset);

  y += 0.5; // move cursor below employee info

  // Now you can continue with autoTable for Gross Income, Deductions, Totals
  autoTable(doc, {
    startY: y,
    head: [["Gross Income", "Amount"]],
    body: [
      [
        "Rate",
        `₱${(payslipData.grossIncome?.rate || 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
      ],
      [
        "Earn for the period",
        `₱${(payslipData.grossIncome?.earnPeriod || 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
      ],
    ],
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 0.03, font: "times", fontStyle: "bold" },
    headStyles: { fillColor: [220, 220, 220] },
    margin: { left: margin, right: margin },
    tableWidth: "wrap",
    columnStyles: { 0: { cellWidth: 1.6 }, 1: { cellWidth: 1, halign: "right" } },
  });

  doc.save("payslip.pdf");
};

export default generatePaySlipPdf;

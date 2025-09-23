import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";
import letterhead from "../src/assets/letterheademb.PNG"; // adjust path if needed

const generatePdfDoc = (payslipData, payslipNumber) => {
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

  y += 0.1; // Add top padding

  // Letterhead
  const imagePadding = 0.1;
  doc.addImage(letterhead, "PNG", margin / 2 + imagePadding, y, doc.internal.pageSize.width - margin - (2 * imagePadding), 0.6);
  y += 0.75; // move below letterhead

  // Title
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text("PAYSLIP", doc.internal.pageSize.width / 2, y, { align: "center" });
  y += 0.35; // space below title

  doc.setFont("times", "bold");
  doc.setFontSize(8);

  const detailsStartY = y;
  const underlineOffset = 0.01;
  doc.setLineWidth(0.003);

  // --- Left section (Employee info) ---
  const leftX = margin + 0.1;
  const labels = ["Name:", "Emp ID:", "Designation:"];
  const labelWidths = labels.map(label => doc.getTextWidth(label));
  const maxLabelWidth = Math.max(...labelWidths);
  const valueStartX = leftX + maxLabelWidth + 0.1; // Add 0.1 inch padding

  let leftY = detailsStartY;

  // Name
  doc.text(labels[0], leftX, leftY);
  const nameValue = payslipData.name || "";
  doc.text(nameValue, valueStartX, leftY);
  const nameWidth = doc.getTextWidth(nameValue);
  if (nameValue) {
    doc.line(valueStartX, leftY + underlineOffset, valueStartX + nameWidth, leftY + underlineOffset);
  }
  leftY += 0.18;

  // Emp ID
  doc.text(labels[1], leftX, leftY);
  const empIdValue = payslipData.empNo || "";
  doc.text(empIdValue, valueStartX, leftY);
  const empIdWidth = doc.getTextWidth(empIdValue);
  if (empIdValue) {
    doc.line(valueStartX, leftY + underlineOffset, valueStartX + empIdWidth, leftY + underlineOffset);
  }
  leftY += 0.18;

  // Position
  doc.text(labels[2], leftX, leftY);
  const positionValue = payslipData.position || "";
  doc.text(positionValue, valueStartX, leftY);
  const positionWidth = doc.getTextWidth(positionValue);
  if (positionValue) {
    doc.line(valueStartX, leftY + underlineOffset, valueStartX + positionWidth, leftY + underlineOffset);
  }

  // --- Right section (Payslip info) ---
  let rightY = detailsStartY;
  const rightX = doc.internal.pageSize.width / 2 + 0.5;

  const rightLabels = ["Payslip No.:", "Date:", "Pay Period:"];
  const rightLabelWidths = rightLabels.map(label => doc.getTextWidth(label));
  const maxRightLabelWidth = Math.max(...rightLabelWidths);
  const rightValueStartX = rightX + maxRightLabelWidth + 0.1;

  // Payslip No.
  doc.text(rightLabels[0], rightX, rightY);
  const payslipNoValue = `${payslipNumber}`;
  doc.text(payslipNoValue, rightValueStartX, rightY);
  const payslipNoWidth = doc.getTextWidth(payslipNoValue);
  doc.line(rightValueStartX, rightY + underlineOffset, rightValueStartX + payslipNoWidth, rightY + underlineOffset);
  rightY += 0.18;

  // Date
  doc.text(rightLabels[1], rightX, rightY);
  const dateValue = dayjs().format("MM/DD/YYYY");
  doc.text(dateValue, rightValueStartX, rightY);
  const dateWidth = doc.getTextWidth(dateValue);
  doc.line(rightValueStartX, rightY + underlineOffset, rightValueStartX + dateWidth, rightY + underlineOffset);
  rightY += 0.18;

  // Cut Off
  doc.text(rightLabels[2], rightX, rightY);
  const cutOffPeriod =
    payslipData.cutOffStartDate && payslipData.cutOffEndDate
      ? `${dayjs(payslipData.cutOffStartDate).format("MMM. D")} - ${dayjs(
          payslipData.cutOffEndDate
        ).format("D, YYYY")}`
      : "";
  doc.text(cutOffPeriod, rightValueStartX, rightY);
  const cutOffWidth = doc.getTextWidth(cutOffPeriod);
  if (cutOffPeriod) {
    doc.line(rightValueStartX, rightY + underlineOffset, rightValueStartX + cutOffWidth, rightY + underlineOffset);
  }

  // Set y for the table
  y = Math.max(leftY, rightY) + 0.2;

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

  return doc;
}

export const generatePaySlipPreview = (payslipData, payslipNumber) => {
  const doc = generatePdfDoc(payslipData, payslipNumber);
  const uri = doc.output('datauristring');
  return uri + '#toolbar=0&view=Fit';
};

const generatePaySlipPdf = (payslipData, payslipNumber) => {
  const doc = generatePdfDoc(payslipData, payslipNumber);
  doc.save("payslip.pdf");
};

export default generatePaySlipPdf;
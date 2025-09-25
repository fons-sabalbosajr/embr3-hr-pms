import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";
import letterhead from "../src/assets/letterheademb.PNG"; // adjust path if needed

const generatePdfDoc = (payslipData, payslipNumber, isFullMonthRange) => {
  // Ensure payslipData and its nested properties are defined
  const safePayslipData = {
    ...payslipData,
    grossIncome: payslipData.grossIncome || {},
    deductions: payslipData.deductions || [],
  };

  const doc = new jsPDF({
    unit: "in",
    format: [4.5, 4.5],
  });

  const margin = 0.02; // reduced padding
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

  y += 0.02; // Add top padding - Adjusted to move PAYSLIP title downwards

  // Letterhead (adjusted top padding)
  const imagePadding = 0.05; // reduced padding
  doc.addImage(
    letterhead,
    "PNG",
    margin / 2 + imagePadding,
    y,
    doc.internal.pageSize.width - margin - 2 * imagePadding,
    0.6
  );
  y += 0.8; // adjusted spacing after letterhead

  // Title
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.text("PAYSLIP", doc.internal.pageSize.width / 2, y, { align: "center" });
  y += 0.1; // space below title

  doc.setFont("times", "bold");
  doc.setFontSize(7);

  const detailsStartY = y;
  const underlineOffset = 0.01;
  doc.setLineWidth(0.003);

  const fixedUnderlineLength = 1.5; // Fixed length for uniform underlines

  // --- Left section (Employee info) ---
  const leftX = margin + 0.2;
  const labels = ["Name:", "Emp ID:", "Designation:"];
  const labelWidths = labels.map((label) => doc.getTextWidth(label));
  const maxLabelWidth = Math.max(...labelWidths);
  const valueStartX = leftX + maxLabelWidth + 0.1; // Add 0.1 inch padding

  let leftY = detailsStartY;

  // Name
  doc.text(labels[0], leftX, leftY);
  const nameValue = safePayslipData.name || "";
  doc.text(nameValue, valueStartX, leftY);
  if (nameValue) {
    doc.line(
      valueStartX,
      leftY + underlineOffset,
      valueStartX + fixedUnderlineLength,
      leftY + underlineOffset
    );
  }
  leftY += 0.18;

  // Emp ID
  doc.text(labels[1], leftX, leftY);
  const empIdValue = safePayslipData.empId || "";
  doc.text(empIdValue, valueStartX, leftY);
  doc.line(
    valueStartX,
    leftY + underlineOffset,
    valueStartX + fixedUnderlineLength,
    leftY + underlineOffset
  );
  leftY += 0.18;

  // Position
  doc.text(labels[2], leftX, leftY);
  const positionValue = safePayslipData.position || "";
  doc.text(positionValue, valueStartX, leftY);
  if (positionValue) {
    doc.line(
      valueStartX,
      leftY + underlineOffset,
      valueStartX + fixedUnderlineLength,
      leftY + underlineOffset
    );
  }

  // --- Right section (Payslip info) ---
  let rightY = detailsStartY;
  const rightX = doc.internal.pageSize.width / 2 + 0.3; // Adjusted to move right

  const rightLabels = ["Payslip No.:", "Date:", "Pay Period:"];
  const rightLabelWidths = rightLabels.map((label) => doc.getTextWidth(label));
  const maxRightLabelWidth = Math.max(...rightLabelWidths);
  const rightValueStartX = rightX + maxRightLabelWidth + 0.1;

  // Payslip No.
  doc.text(rightLabels[0], rightX, rightY);
  const payslipNoValue = `${payslipNumber}`;
  doc.text(payslipNoValue, rightValueStartX, rightY);
  doc.line(
    rightValueStartX,
    rightY + underlineOffset,
    doc.internal.pageSize.width - margin - 0.2, // Adjusted for right padding
    rightY + underlineOffset
  );
  rightY += 0.18;

  // Date
  doc.text(rightLabels[1], rightX, rightY);
  const dateValue = dayjs().format("MM/DD/YYYY");
  doc.text(dateValue, rightValueStartX, rightY);
  doc.line(
    rightValueStartX,
    rightY + underlineOffset,
    doc.internal.pageSize.width - margin - 0.2, // Adjusted for right padding
    rightY + underlineOffset
  );
  rightY += 0.18;

  // Cut Off
  doc.text(rightLabels[2], rightX, rightY);
  let cutOffPeriod;
  if (isFullMonthRange) {
    const monthStart = dayjs(safePayslipData.cutOffStartDate);
    const firstCutoffStart = monthStart.date(1);
    const firstCutoffEnd = monthStart.date(15);
    cutOffPeriod = `${firstCutoffStart.format("MMM. D")} - ${firstCutoffEnd.format(
      "D, YYYY"
    )}`;
  } else {
    cutOffPeriod =
      safePayslipData.cutOffStartDate && safePayslipData.cutOffEndDate
        ? `${dayjs(safePayslipData.cutOffStartDate).format("MMM. D")} - ${dayjs(
            safePayslipData.cutOffEndDate
          ).format("D, YYYY")}`
        : "";
  }
  doc.text(cutOffPeriod, rightValueStartX, rightY);
  if (cutOffPeriod) {
    doc.line(
      rightValueStartX,
      rightY + underlineOffset,
      doc.internal.pageSize.width - margin - 0.2, // Adjusted for right padding
      rightY + underlineOffset
    );
  }

  // Set y for the table
  y = Math.max(leftY, rightY) + 0.1; // Reduced from 0.15

  // Force Times New Roman before table
  doc.setFont("times", "normal");

  const formatCurrency = (value) => {
    if (typeof value !== "number") {
      return "";
    }
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Build body rows
  const deductions_cutoff_1 = (safePayslipData.deductions || []).filter(
    (d) => d.cutoff === 1
  );
  let totalDeductions_cutoff_1 = deductions_cutoff_1.reduce(
    (acc, d) => acc + (d.amount || 0),
    0
  );

  const bodyRows = [
    ["", "", "", "", ""], // row 1 blank
    [
      "Rate Per Month",
      formatCurrency(safePayslipData.grossIncome.earnPeriod),
      "",
      "",
      "",
    ],
    [
      "Earn for the period",
      formatCurrency(safePayslipData.grossIncome.rate),
      ,
      "",
      "",
      "",
    ],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
  ];

  // Populate deductions for the first cutoff, starting from the "Rate Per Month" row.
  deductions_cutoff_1.forEach((deduction, index) => {
    if (index < 5) {
      // We can fit 5 deductions
      const rowIndex = 1 + index;
      if (bodyRows[rowIndex]) {
        let deductionName = deduction.name;
        if (deduction.name === "Absent" && deduction.days) {
          deductionName = `Absent`;
        } else if (
          deduction.name === "Late/Undertime" &&
          deduction.value &&
          deduction.unit
        ) {
          deductionName = `Late/Undertime`;
        }
        bodyRows[rowIndex][2] = deductionName;
        let displayAmount = deduction.amount;
        bodyRows[rowIndex][3] = formatCurrency(displayAmount);
      }
    }
  });

  const netPay_cutoff_1 =
    safePayslipData.grossIncome.rate - totalDeductions_cutoff_1;

  bodyRows.push([
    "Total Income",
    formatCurrency(safePayslipData.grossIncome.rate),
    "Total Deductions",
    formatCurrency(totalDeductions_cutoff_1),
    formatCurrency(netPay_cutoff_1),
  ]); // totals row

  autoTable(doc, {
    startY: y,
    head: [
      [
        { content: "Gross Income", colSpan: 2, styles: { halign: "center" } },
        { content: "Deductions", colSpan: 2, styles: { halign: "center" } },
        { content: "Net Amount", styles: { halign: "center" } },
      ],
    ],
    body: bodyRows,
    theme: "grid",
    margin: { left: 0.2, right: 0.2 },
    styles: {
      font: "times",
      fontSize: 7,
      cellPadding: 0.03,
      lineColor: 0,
      lineWidth: 0.005,
      minCellHeight: 0.1,
      halign: "left",
    },
    headStyles: {
      fillColor: [200, 200, 200],
      textColor: 0,
      fontStyle: "bold",
      minCellHeight: 0.2,
      halign: "center",
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 0.8 }, // Gross subcolumn 1
      1: { cellWidth: 0.8 }, // Gross subcolumn 2
      2: { cellWidth: 0.8 }, // Deduction subcolumn 1
      3: { cellWidth: 0.8 }, // Deduction subcolumn 2
      4: { cellWidth: 0.85 }, // Net Amount
    },
    didDrawPage: function (data) {
      y = data.cursor.y;
    },
    didDrawTable: function (data) {
      const table = data.table;
      doc.setLineWidth(0.5); // thicker outer border
      doc.rect(table.x, table.y, table.width, table.height);
      doc.setLineWidth(0.2); // reset back
    },
  });

  // Add second pay period if isFullMonthRange is true
  if (isFullMonthRange) {
    const monthStart = dayjs(payslipData.cutOffStartDate);
    const secondCutOffStartDate = monthStart.date(16);
    const secondCutOffEndDate = monthStart.endOf("month");

    const secondPayPeriodLabel = "Pay Period:";
    const secondPayPeriodValue = `${secondCutOffStartDate.format(
      "MMM D"
    )}-${secondCutOffEndDate.format("D, YYYY")}`;

    // Position the second pay period below the table, aligned with the right section
    const secondPayPeriodY = y + 0.1; // Reduced from 0.2

    doc.setFont("times", "bold");
    doc.text(secondPayPeriodLabel, rightX, secondPayPeriodY);
    doc.setFont("times", "bold"); // Changed to normal for the value
    doc.text(secondPayPeriodValue, rightValueStartX, secondPayPeriodY);
    doc.line(
      rightValueStartX,
      secondPayPeriodY + underlineOffset,
      doc.internal.pageSize.width - margin - 0.2, // Adjusted for right padding
      secondPayPeriodY + underlineOffset
    );

    // Update y position for the new table
    y = secondPayPeriodY + 0.05; // Reduced from 0.1

    // Second Table (7 rows)
    const deductions_cutoff_2 = (payslipData.deductions || []).filter(
      (d) => d.cutoff === 2
    );
    let totalDeductions_cutoff_2 = deductions_cutoff_2.reduce(
      (acc, d) => acc + (d.amount || 0),
      0
    );

    const secondTableBodyRows = [
      [
        "Earn for the period",
        formatCurrency(payslipData.secondPeriodEarnedForPeriod),
        "",
        "",
        "",
      ],
      ["", "", "", "", ""], // Deduction 3
      ["", "", "", "", ""], // Deduction 4
      ["", "", "", "", ""], // Deduction 5
    ];

    // Populate deductions for the second cutoff, starting from row 2 (index 1)
    deductions_cutoff_2.forEach((deduction, index) => {
      if (index < 5) {
        // Limit to 5 deductions
        // Directly add to the array, it's already pre-filled with empty rows
        let deductionName = deduction.name;
        if (deduction.name === "Absent" && deduction.days) {
          deductionName = `Absent`;
        } else if (
          deduction.name === "Late/Undertime" &&
          deduction.value &&
          deduction.unit
        ) {
          deductionName = `Late/Undertime`;
        } else if (deduction.name === "Tax") {
          deductionName = `Tax`; // Explicitly handle Tax
        }
        secondTableBodyRows[index][2] = deductionName;
        let displayAmount = deduction.amount;
        secondTableBodyRows[index][3] = formatCurrency(displayAmount);
      }
    });

    const netPay_cutoff_2 =
      payslipData.secondPeriodEarnedForPeriod - totalDeductions_cutoff_2;

    secondTableBodyRows.push([
      "Total Income",
      formatCurrency(payslipData.secondPeriodEarnedForPeriod),
      "Total Deductions",
      formatCurrency(totalDeductions_cutoff_2),
      formatCurrency(netPay_cutoff_2),
    ]); // totals row

    autoTable(doc, {
      startY: y,
      head: [
        [
          { content: "Gross Income", colSpan: 2, styles: { halign: "center" } },
          { content: "Deductions", colSpan: 2, styles: { halign: "center" } },
          { content: "Net Amount", styles: { halign: "center" } },
        ],
      ],
      body: secondTableBodyRows,
      theme: "grid",
      margin: { left: 0.2, right: 0.2 },
      styles: {
        font: "times",
        fontSize: 7,
        cellPadding: 0.03,
        lineColor: 0,
        lineWidth: 0.005,
        minCellHeight: 0.1,
        halign: "left",
      },
      headStyles: {
        fillColor: [200, 200, 200],
        textColor: 0,
        fontStyle: "bold",
        minCellHeight: 0.2,
        halign: "center",
        valign: "middle",
      },
      columnStyles: {
        0: { cellWidth: 0.8 }, // Gross subcolumn 1
        1: { cellWidth: 0.8 }, // Gross subcolumn 2
        2: { cellWidth: 0.8 }, // Deduction subcolumn 1
        3: { cellWidth: 0.8 }, // Deduction subcolumn 2
        4: { cellWidth: 0.85 }, // Net Amount
      },
      didDrawPage: function (data) {
        y = data.cursor.y;
      },
      didDrawTable: function (data) {
        const table = data.table;
        doc.setLineWidth(0.5); // thicker outer border
        doc.rect(table.x, table.y, table.width, table.height);
        doc.setLineWidth(0.2); // reset back
      },
    });

    // HR Info Box directly below 2nd table
    const hrBoxY = y; // start right below the table
    doc.setFontSize(8);
    doc.setFont("times", "normal");

    // Content
    const hrLabel = "Prepared by:";
    const hrName = "PRISCILLA MICHAIAH C. CORONEL";
    const hrDesignation = "Head, Personnel Unit";

    // Keep left margin same as tables
    const hrBoxX = 0.2;

    // Add extra space only on the right
    const hrRightPadding = 0.22;
    const hrBoxWidth =
      doc.internal.pageSize.width - margin - hrBoxX - hrRightPadding;

    const hrBoxHeight = 0.4; // fixed height for HR box

    // Draw HR Info Box with thicker border
    doc.setLineWidth(0.01);
    doc.rect(hrBoxX, hrBoxY, hrBoxWidth, hrBoxHeight);

    // Inside text (aligned relative to box)
    const centerX = hrBoxX + hrBoxWidth / 2;
    let textY = hrBoxY + 0.18;

    doc.setFont("times", "bold");
    doc.text(hrLabel, hrBoxX + 0.1, textY);

    doc.setFont("times", "normal");
    doc.text(hrName, centerX, textY, { align: "center" });

    // Underline HR Name with thinner line
    doc.setLineWidth(0.005);
    doc.line(
      centerX - doc.getTextWidth(hrName) / 2,
      textY + 0.01,
      centerX + doc.getTextWidth(hrName) / 2,
      textY + 0.01
    );

    textY += 0.15;
    // HR Designation (no underline now)
    doc.text(hrDesignation, centerX, textY, { align: "center" });
  }

  y += 0.1;

  return doc;
};

export const generatePaySlipPreview = (
  payslipData,
  payslipNumber,
  isFullMonthRange
) => {
  const doc = generatePdfDoc(payslipData, payslipNumber, isFullMonthRange);
  const uri = doc.output("datauristring");
  return uri + "#toolbar=0&view=Fit";
};

export const generatePaySlipPdf = (
  payslipData,
  payslipNumber,
  isFullMonthRange
) => {
  const doc = generatePdfDoc(payslipData, payslipNumber, isFullMonthRange);
  doc.save("payslip.pdf");
};

const dataURItoBlob = (dataURI) => {
  var byteString = atob(dataURI.split(",")[1]);
  var mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];
  var ab = new ArrayBuffer(byteString.length);
  var ia = new Uint8Array(ab);
  for (var i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  var blob = new Blob([ab], { type: mimeString });
  return blob;
};

export const openPayslipInNewTab = (
  payslipData,
  payslipNumber,
  isFullMonthRange
) => {
  const doc = generatePdfDoc(payslipData, payslipNumber, isFullMonthRange);
  const uri = doc.output("datauristring");

  const pdfBlob = dataURItoBlob(uri);
  const url = URL.createObjectURL(pdfBlob);

  const newWindow = window.open(url, "_blank");
  if (newWindow) {
    newWindow.onload = () => {
      URL.revokeObjectURL(url);
    };
  } else {
    alert(
      "Popup blocked! Please allow popups for this site to view the payslip."
    );
    URL.revokeObjectURL(url);
  }
};

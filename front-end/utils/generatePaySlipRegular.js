import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";
import letterhead from "../src/assets/letterheademb.PNG"; // adjust path if needed

// Load and parse position acronyms map from Vite env (expects JSON)
let POSITION_MAP = {};
try {
  if (import.meta?.env?.VITE_POSITION_ACRONYMS) {
    // Allow either raw JSON or quoted string
    let raw = import.meta.env.VITE_POSITION_ACRONYMS.trim();
    if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
      raw = raw.slice(1, -1);
    }
    POSITION_MAP = JSON.parse(raw);
  }
} catch (e) {
  console.warn("Failed to parse VITE_POSITION_ACRONYMS", e);
}

// Apply acronym replacement supporting composite positions & longest match first.
const applyPositionAcronyms = (value) => {
  if (!value || typeof value !== 'string') return value || '';
  const original = value;
  // Direct match first (case-insensitive by trying upper variant)
  const direct = POSITION_MAP[original] || POSITION_MAP[original.toUpperCase()];
  if (direct) return direct;
  const keys = Object.keys(POSITION_MAP).sort((a,b) => b.length - a.length);
  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let working = original;
  for (const key of keys) {
    // Use word boundary when key ends with alnum to avoid partial overlaps
    const pattern = /[A-Za-z0-9]$/.test(key) ? `\\b${escapeRegex(key)}\\b` : escapeRegex(key);
    const reg = new RegExp(pattern, 'i');
    if (reg.test(working)) {
      working = working.replace(reg, POSITION_MAP[key]);
    }
  }
  return working;
};

const generatePdfDoc = (payslipData, payslipNumber, isFullMonthRange, maskAmounts = false) => {
  // Ensure payslipData and its nested properties are defined
  const safePayslipData = {
    ...payslipData,
    grossIncome: payslipData.grossIncome || {},
    deductions: payslipData.deductions || [],
    incentives: payslipData.incentives || [],
  };

  const doc = new jsPDF({
    unit: "in",
    format: [5, 6], // Changed paper size to 5x6 inches
  });

  const margin = 0.01; // reduced padding
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

  y += 0.02;

  // Letterhead
  const imagePadding = 0.03; // reduced padding
  doc.addImage(
    letterhead,
    "PNG",
    margin / 2 + imagePadding,
    y,
    doc.internal.pageSize.width - margin - 2 * imagePadding,
    0.7
  );
  y += 1; // adjusted spacing after letterhead

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

  // Position (with acronym replacement)
  doc.text(labels[2], leftX, leftY);
  const positionValueRaw = safePayslipData.position || "";
  const positionDisplay = applyPositionAcronyms(positionValueRaw);
  doc.text(positionDisplay, valueStartX, leftY);
  if (positionDisplay) {
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
    cutOffPeriod = `${firstCutoffStart.format(
      "MMM. D"
    )} - ${firstCutoffEnd.format("D, YYYY")}`;
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
  y = Math.max(leftY, rightY) + 0.1;

  // Force Times New Roman before table
  doc.setFont("times", "normal");

  const formatCurrency = (value) => {
    if (maskAmounts) return "*****";
    if (typeof value !== "number") {
      return "";
    }
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const deductions_cutoff_1 = (safePayslipData.deductions || []).filter(
    (d) => d.cutoff === 1
  );
  const incentives_cutoff_1 = (safePayslipData.incentives || []).filter(
    (i) => i.cutoff === 1
  );
  let totalDeductions_cutoff_1 = deductions_cutoff_1.reduce(
    (acc, d) => acc + (d.amount || 0),
    0
  );
  let totalIncentives_cutoff_1 = incentives_cutoff_1.reduce(
    (acc, i) => acc + (i.amount || 0),
    0
  );

  const all_income_1 = [
    {
      type: "Rate Per Month",
      amount: safePayslipData.grossIncome.monthlySalary,
    },
    {
      type: "Gross Amount Earned",
      amount: safePayslipData.grossIncome.grossAmountEarned / 2,
    },
    ...incentives_cutoff_1,
  ];

  const numRows = Math.max(all_income_1.length, deductions_cutoff_1.length);
  const bodyRows1 = [];
  bodyRows1.push(["", "", "", "", ""]);

  for (let i = 0; i < numRows; i++) {
    const income = all_income_1[i];
    const deduction = deductions_cutoff_1[i];

    const row = [
      income ? income.type : "",
      income ? formatCurrency(income.amount) : "",
      deduction ? deduction.type : "",
      deduction ? formatCurrency(deduction.amount) : "",
      "",
    ];
    bodyRows1.push(row);
  }

  bodyRows1.push(["", "", "", "", ""]); // Blank row before totals

  const netPay_cutoff_1 =
    safePayslipData.grossIncome.grossAmountEarned / 2 +
    totalIncentives_cutoff_1 -
    totalDeductions_cutoff_1;

  bodyRows1.push([
    "Total Income",
    formatCurrency(
      safePayslipData.grossIncome.grossAmountEarned / 2 +
        totalIncentives_cutoff_1
    ),
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
    body: bodyRows1,
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
      0: { cellWidth: 1.0 },
      1: { cellWidth: 0.8, halign: "right" },
      2: { cellWidth: 1.0 },
      3: { cellWidth: 0.8, halign: "right" },
      4: { cellWidth: 1.0, halign: "right" },
    },
    didDrawCell: (data) => {
      if (data.section === "body") {
        const incentive = incentives_cutoff_1.find(
          (i) => i.type === data.cell.raw
        );
        if (incentive) {
          doc.setTextColor(0, 128, 0);
        }
        const deduction = deductions_cutoff_1.find(
          (d) => d.type === data.cell.raw
        );
        if (deduction) {
          doc.setTextColor(255, 0, 0);
        }
      }
    },
    didDrawPage: function (data) {
      y = data.cursor.y;
    },
    didDrawTable: function (data) {
      const table = data.table;
      doc.setLineWidth(0.5);
      doc.rect(table.x, table.y, table.width, table.height);
      doc.setLineWidth(0.2);
    },
  });

  if (isFullMonthRange) {
    const monthStart = dayjs(payslipData.cutOffStartDate);
    const secondCutOffStartDate = monthStart.date(16);
    const secondCutOffEndDate = monthStart.endOf("month");

    const secondPayPeriodLabel = "Pay Period:";
    const secondPayPeriodValue = `${secondCutOffStartDate.format(
      "MMM D"
    )}-${secondCutOffEndDate.format("D, YYYY")}`;

    const secondPayPeriodY = y + 0.2;

    doc.setFont("times", "bold");
    doc.text(secondPayPeriodLabel, rightX, secondPayPeriodY);
    doc.setFont("times", "bold");
    doc.text(secondPayPeriodValue, rightValueStartX, secondPayPeriodY);
    doc.line(
      rightValueStartX,
      secondPayPeriodY + underlineOffset,
      doc.internal.pageSize.width - margin - 0.2,
      secondPayPeriodY + underlineOffset
    );

    y = secondPayPeriodY + 0.05;

    const deductions_cutoff_2 = (payslipData.deductions || []).filter(
      (d) => d.cutoff === 2
    );
    const incentives_cutoff_2 = (payslipData.incentives || []).filter(
      (i) => i.cutoff === 2
    );
    let totalDeductions_cutoff_2 = deductions_cutoff_2.reduce(
      (acc, d) => acc + (d.amount || 0),
      0
    );
    let totalIncentives_cutoff_2 = incentives_cutoff_2.reduce(
      (acc, i) => acc + (i.amount || 0),
      0
    );

    const all_income_2 = [
      {
        type: "Rate Per Month",
        amount: safePayslipData.grossIncome.monthlySalary,
      },
      {
        type: "Gross Amount Earned",
        amount: safePayslipData.grossIncome.grossAmountEarned / 2,
      },
      ...incentives_cutoff_2,
    ];

    const numRows2 = Math.max(
      all_income_2.length,
      deductions_cutoff_2.length
    );
    const bodyRows2 = [];
    bodyRows2.push(["", "", "", "", ""]);

    for (let i = 0; i < numRows2; i++) {
      const income = all_income_2[i];
      const deduction = deductions_cutoff_2[i];

      const row = [
        income ? income.type : "",
        income ? formatCurrency(income.amount) : "",
        deduction ? deduction.type : "",
        deduction ? formatCurrency(deduction.amount) : "",
        "",
      ];
      bodyRows2.push(row);
    }

    bodyRows2.push(["", "", "", "", ""]); // Blank row before totals

    const netPay_cutoff_2 =
      safePayslipData.grossIncome.grossAmountEarned / 2 +
      totalIncentives_cutoff_2 -
      totalDeductions_cutoff_2;

    bodyRows2.push([
      "Total Income",
      formatCurrency(
        safePayslipData.grossIncome.grossAmountEarned / 2 +
          totalIncentives_cutoff_2
      ),
      "Total Deductions",
      formatCurrency(totalDeductions_cutoff_2),
      formatCurrency(netPay_cutoff_2),
    ]);

    autoTable(doc, {
      startY: y,
      head: [
        [
          { content: "Gross Income", colSpan: 2, styles: { halign: "center" } },
          { content: "Deductions", colSpan: 2, styles: { halign: "center" } },
          { content: "Net Amount", styles: { halign: "center" } },
        ],
      ],
      body: bodyRows2,
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
        0: { cellWidth: 1.0 },
        1: { cellWidth: 0.8, halign: "right" },
        2: { cellWidth: 1.0 },
        3: { cellWidth: 0.8, halign: "right" },
        4: { cellWidth: 1.0, halign: "right" },
      },
      didDrawCell: (data) => {
        if (data.section === "body") {
          const incentive = incentives_cutoff_2.find(
            (i) => i.type === data.cell.raw
          );
          if (incentive) {
            doc.setTextColor(0, 128, 0);
          }
          const deduction = deductions_cutoff_2.find(
            (d) => d.type === data.cell.raw
          );
          if (deduction) {
            doc.setTextColor(255, 0, 0);
          }
        }
      },
      didDrawPage: function (data) {
        y = data.cursor.y;
      },
      didDrawTable: function (data) {
        const table = data.table;
        doc.setLineWidth(0.5);
        doc.rect(table.x, table.y, table.width, table.height);
        doc.setLineWidth(0.2);
      },
    });
  }

  y += 0.2;

  // HR Info Box
  const hrBoxY = y;
  doc.setFontSize(8);
  doc.setFont("times", "normal");

  const hrLabel = "Prepared by:";
  const hrName = "PRISCILLA MICHAIAH C. CORONEL";
  const hrDesignation = "Head, Personnel Unit";

  const hrBoxX = 0.2;
  const hrRightPadding = 0.22;
  const hrBoxWidth =
    doc.internal.pageSize.width - margin - hrBoxX - hrRightPadding;
  const hrBoxHeight = 0.4;

  doc.setLineWidth(0.01);
  doc.rect(hrBoxX, hrBoxY, hrBoxWidth, hrBoxHeight);

  const centerX = hrBoxX + hrBoxWidth / 2;
  let textY = hrBoxY + 0.18;

  doc.setFont("times", "bold");
  doc.text(hrLabel, hrBoxX + 0.1, textY);

  doc.setFont("times", "normal");
  doc.text(hrName, centerX, textY, { align: "center" });

  doc.setLineWidth(0.005);
  doc.line(
    centerX - doc.getTextWidth(hrName) / 2,
    textY + 0.01,
    centerX + doc.getTextWidth(hrName) / 2,
    textY + 0.01
  );

  textY += 0.15;
  doc.text(hrDesignation, centerX, textY, { align: "center" });

  return doc;
};

export const generatePaySlipPreviewRegular = (
  payslipData,
  payslipNumber,
  isFullMonthRange,
  maskAmounts = false
) => {
  const doc = generatePdfDoc(payslipData, payslipNumber, isFullMonthRange, maskAmounts);
  const uri = doc.output("datauristring");
  return uri + "#toolbar=0&view=Fit";
};

export const generatePaySlipPdfRegular = (
  payslipData,
  payslipNumber,
  isFullMonthRange,
  maskAmounts = false
) => {
  const doc = generatePdfDoc(payslipData, payslipNumber, isFullMonthRange, maskAmounts);
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

export const openPayslipInNewTabRegular = (
  payslipData,
  payslipNumber,
  isFullMonthRange,
  maskAmounts = false
) => {
  const doc = generatePdfDoc(payslipData, payslipNumber, isFullMonthRange, maskAmounts);
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

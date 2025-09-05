import React from "react";

const OtherDetails = ({ employee }) => {
  return (
    <div>
      <p>
        📂 Employee history, payslips, certificates of employment, etc. for{" "}
        <strong>{employee.name}</strong>.
      </p>
      {/* Example static list */}
      <ul>
        <li>Payslip — July 2025 (PDF)</li>
        <li>Certificate of Employment — Generated 2024</li>
        <li>Annual Appraisal — 2023</li>
      </ul>
    </div>
  );
};

export default OtherDetails;

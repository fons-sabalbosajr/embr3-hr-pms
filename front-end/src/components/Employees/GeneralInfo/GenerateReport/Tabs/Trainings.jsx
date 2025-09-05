import React from "react";

const Trainings = ({ employee }) => {
  return (
    <div>
      <p>
        📚 List of trainings for <strong>{employee.name}</strong> will appear
        here.
      </p>
      {/* Example static list */}
      <ul>
        <li>2024-05-12 — Safety Compliance</li>
        <li>2024-09-20 — React.js Advanced</li>
      </ul>
    </div>
  );
};

export default Trainings;

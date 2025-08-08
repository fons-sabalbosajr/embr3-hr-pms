import React from 'react';
import './addemployee.css';

const AddEmployee = ({ type, onClose }) => {
  return (
    <div className="addemployee-form">
      {type === 'add' ? (
        <div>
          {/* Individual Add Form Fields */}
          <p>Form for adding an individual employee.</p>
        </div>
      ) : (
        <div>
          {/* Upload List Form Fields */}
          <p>Form for uploading a list (CSV or Excel).</p>
        </div>
      )}
    </div>
  );
};

export default AddEmployee;

import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    empId: { type: String },
    alternateEmpIds: { type: [String], default: [] }, // new field

    empNo: { type: String },
    name: { type: String },
    empType: { type: String },
    position: { type: String },
    designation: { type: String },
    division: { type: String },
    sectionOrUnit: { type: String }, // fix: use sectionOrUnit for consistency with your frontend
  },
  { timestamps: true }
);

const Employee = mongoose.model("Employee", employeeSchema);
export default Employee;

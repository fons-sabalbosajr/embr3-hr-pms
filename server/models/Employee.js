import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    empId: { type: String },
    alternateEmpIds: { type: [String], default: [] },
    empNo: { type: String },
    name: { type: String },
    empType: { type: String },
    position: { type: String },
    designation: { type: String },
    division: { type: String },
    sectionOrUnit: { type: String },
    emails: { type: [String], default: [] }, // ✅ add this for multi-emails
  },
  { timestamps: true }
);

const Employee = mongoose.model("Employee", employeeSchema);
export default Employee;

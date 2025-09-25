import mongoose from "mongoose";

const employeeDocSchema = new mongoose.Schema(
  {
    empId: { type: String, required: true },
    docType: { type: String, required: true }, // Payslip, COE, Salary Record, DTR
    reference: { type: String }, // IIS No, link, or filename
    period: { type: String }, // e.g., July 2025 or DTR cutoff
    dateIssued: { type: Date },
    description: { type: String },
    createdBy: { type: String }, // optional, HR username
    docNo: { type: Number },
  },
  { timestamps: true }
);

export default mongoose.model("EmployeeDoc", employeeDocSchema);

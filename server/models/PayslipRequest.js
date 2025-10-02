import mongoose from "mongoose";

const payslipRequestSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true },
    period: { type: String, required: true },
    email: { type: String, required: true },
    status: { type: String, default: "pending" },
    read: { type: Boolean, default: false }, // 👈 Add read field
  },
  { timestamps: true }
);

export default mongoose.model("PayslipRequest", payslipRequestSchema);

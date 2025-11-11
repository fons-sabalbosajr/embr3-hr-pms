import mongoose from "mongoose";

const payslipRequestSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true },
    period: { type: String, required: true }, // YYYY-MM
    email: { type: String, required: true },
    status: { type: String, default: "pending" }, // pending | processed | sent | rejected
    read: { type: Boolean, default: false },
    hidden: { type: Boolean, default: false },
    sentAt: { type: Date }, // when payslip email was sent
    sentBy: { type: String }, // userId or username of HR who sent
    emailMessageId: { type: String }, // provider message id tracking
  },
  { timestamps: true }
);

export default mongoose.model("PayslipRequest", payslipRequestSchema);

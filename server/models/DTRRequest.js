import mongoose from "mongoose";

const dtrRequestSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    email: { type: String, required: true },
    status: { type: String, default: "pending" }, // pending | sent | rejected
    read: { type: Boolean, default: false },
    hidden: { type: Boolean, default: false },
    sentAt: { type: Date },
    sentBy: { type: String },
    emailMessageId: { type: String },
    resendCount: { type: Number, default: 0 },
    lastSentAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("DTRRequest", dtrRequestSchema);

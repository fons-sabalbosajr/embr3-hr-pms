import mongoose from "mongoose";

const dtrRequestSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    email: { type: String, required: true },
    read: { type: Boolean, default: false },
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("DTRRequest", dtrRequestSchema);

// models/DTRGenerationLog.js
import mongoose from "mongoose";

const dtrGenerationLogSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true },
    period: { type: String, required: true },
    generatedBy: { type: String, required: true },
    read: { type: Boolean, default: false }, // ✅ added
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("DTRGenerationLog", dtrGenerationLogSchema);

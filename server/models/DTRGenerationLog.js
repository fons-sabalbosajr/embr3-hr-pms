import mongoose from "mongoose";

const dtrGenerationLogSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true },
    period: { type: String, required: true },
    generatedBy: { type: String, required: true }, // email of the user who requested
  },
  { timestamps: true }
);

export default mongoose.model("DTRGenerationLog", dtrGenerationLogSchema);

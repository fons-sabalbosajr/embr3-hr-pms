import mongoose from "mongoose";

const dtrResolutionSchema = new mongoose.Schema(
  {
    empId: { type: String, required: true, index: true },
    recordId: { type: mongoose.Schema.Types.ObjectId, ref: "DTRData", required: true, index: true },
    dateKey: { type: String, required: true }, // YYYY-MM-DD
    timeIn: { type: String, default: "" },
    breakOut: { type: String, default: "" },
    breakIn: { type: String, default: "" },
    timeOut: { type: String, default: "" },
    workStatus: { type: String, default: "" },
    source: { type: String, enum: ["biometric", "manual"], default: "manual" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

dtrResolutionSchema.index({ empId: 1, recordId: 1, dateKey: 1 }, { unique: true });

const DTRResolution = mongoose.model("DTRResolution", dtrResolutionSchema);
export default DTRResolution;

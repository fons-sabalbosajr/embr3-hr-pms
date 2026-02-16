import mongoose from "mongoose";

const workFromHomeSchema = new mongoose.Schema(
  {
    /** Employee reference (empId string, e.g. "EMP-001") */
    empId: { type: String, required: true, index: true },

    /** Employee name (denormalised for quick display) */
    employeeName: { type: String, default: "" },

    /** Start date of the WFH period */
    date: { type: Date, required: true },

    /** End date – omit or set equal to `date` for a single-day WFH */
    endDate: { type: Date },

    /** Prescribed office-hour times for the WFH day(s) */
    timeIn: { type: String, default: "" },
    breakOut: { type: String, default: "" },
    breakIn: { type: String, default: "" },
    timeOut: { type: String, default: "" },

    /** Google Drive attachment (proof / approval memo) */
    attachmentUrl: { type: String, default: "" },
    attachmentName: { type: String, default: "" },
    attachmentDriveId: { type: String, default: "" },

    /** Optional notes / reason */
    notes: { type: String, default: "" },

    /** Who created the entry */
    createdBy: { type: String, default: "" },

    /** Soft-delete / toggle */
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("WorkFromHome", workFromHomeSchema);

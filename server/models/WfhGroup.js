import mongoose from "mongoose";

const wfhGroupSchema = new mongoose.Schema(
  {
    /** Descriptive label, e.g. "WFH Feb 1-15 Batch A" */
    name: { type: String, default: "" },

    /** Start date of the WFH period */
    startDate: { type: Date, required: true },

    /** End date of the WFH period */
    endDate: { type: Date, required: true },

    /** List of employee empIds assigned to this WFH group */
    members: [
      {
        empId: { type: String, required: true },
        employeeName: { type: String, default: "" },
      },
    ],

    /** Optional notes */
    notes: { type: String, default: "" },

    /** Who created the entry */
    createdBy: { type: String, default: "" },

    /** Soft-delete / toggle */
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

wfhGroupSchema.index({ startDate: 1, endDate: 1 });
wfhGroupSchema.index({ "members.empId": 1 });

export default mongoose.model("WfhGroup", wfhGroupSchema);

// models/DTRLog.js
import mongoose from "mongoose";

const dtrLogSchema = new mongoose.Schema(
  {
    "AC-No": String,
    Name: String,
    Time: Date, // change to Date type for better queries
    State: String,
    "New State": String,
    Exception: String,
    DTR_ID: { type: mongoose.Schema.Types.ObjectId, ref: "DTRData" },
  },
  { timestamps: true }
);

// Add indexes
dtrLogSchema.index({ DTR_ID: 1 });
dtrLogSchema.index({ Name: 1 });
dtrLogSchema.index({ Time: 1 });

// Compound index example (optional)
dtrLogSchema.index({ DTR_ID: 1, Name: 1, Time: 1 });

export default mongoose.model("DTRLog", dtrLogSchema);

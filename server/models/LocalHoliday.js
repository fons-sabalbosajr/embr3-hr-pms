import mongoose from "mongoose";

const localHolidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    date: { type: Date, required: true },
    endDate: { type: Date }, // optional for ranges
    location: { type: String },
    notes: { type: String },
    createdBy: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("LocalHoliday", localHolidaySchema);

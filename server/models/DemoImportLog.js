import mongoose from "mongoose";

const demoImportLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    uploadedBy: String,
    totalRecords: Number,
    cutOffStart: Date,
    cutOffEnd: Date,
    note: String,
    ip: String,
  },
  { timestamps: true }
);

const DemoImportLog = mongoose.model("DemoImportLog", demoImportLogSchema);
export default DemoImportLog;

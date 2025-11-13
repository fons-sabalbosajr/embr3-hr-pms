import mongoose from "mongoose";

const employeeDocSchema = new mongoose.Schema(
  {
    empId: { type: String, required: true },
    docType: { type: String, required: true }, // Payslip, COE, Salary Record, DTR, etc.
    reference: { type: String }, // IIS No, external link, or legacy filename
    period: { type: String }, // e.g., July 2025 or DTR cutoff
    dateIssued: { type: Date },
    description: { type: String },
    createdBy: { type: String }, // optional, HR username
    docNo: { type: Number }, // yearly sequence for Payslip
    // Optional structured payload (e.g., payslip data used for PDF regeneration)
    payload: { type: mongoose.Schema.Types.Mixed },
    isFullMonthRange: { type: Boolean },
    // --- Storage metadata (optional) ---
    storageProvider: { type: String, enum: ["local", "drive"], default: "local" }, // where the binary lives
    fileId: { type: String }, // Drive file id when storageProvider === 'drive'
    originalFilename: { type: String }, // client provided name
    mimeType: { type: String },
    size: { type: Number }, // bytes
  },
  { timestamps: true }
);

export default mongoose.model("EmployeeDoc", employeeDocSchema);

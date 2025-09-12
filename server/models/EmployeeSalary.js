import mongoose from "mongoose";

const employeeSalarySchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee", // Reference to the Employee model
      required: true,
      unique: true, // Each employee should have only one salary record
    },
    salaryType: { type: String, enum: ["Regular", "Contract of Service"], required: true },
    basicSalary: { type: Number, default: 0 }, // For Regular
    ratePerMonth: { type: Number, default: 0 }, // For COS
    dailyRate: { type: Number, default: 0 }, // For COS
    payrollType: { type: String, enum: ["monthly", "semi-monthly", "weekly", "daily"], default: "monthly" },
    bankAccountName: { type: String },
    bankAccountNumber: { type: String },
    tin: { type: String }, // Tax Identification Number
    sss: { type: String }, // Social Security System
    philhealth: { type: String },
    pagibig: { type: String },
    benefitsAndAllowances: [ // Renamed from 'benefits'
      {
        name: { type: String },
        description: { type: String },
        amount: { type: Number },
      },
    ],
    deductions: [ // New field for deductions
      {
        name: { type: String },
        amount: { type: Number },
      },
    ],
    leaveCredits: [
      {
        type: { type: String }, // e.g., "Vacation Leave", "Sick Leave"
        total: { type: Number, default: 0 },
        used: { type: Number, default: 0 },
        remaining: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true }
);

const EmployeeSalary = mongoose.model("EmployeeSalary", employeeSalarySchema);
export default EmployeeSalary;

import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    designation: { type: String },
    position: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isVerified: { type: Boolean, default: false },

    // Email Verification
    verificationToken: {
      type: String,
      required: false,
      maxlength: 128,
    },
    verificationTokenExpires: {
      type: Date,
      required: false,
    },

    // 🔐 Password Reset
    resetPasswordToken: {
      type: String,
      required: false,
      maxlength: 128,
    },
    resetPasswordExpires: {
      type: Date,
      required: false,
    },

    // User Preferences
    showSalaryAmounts: { type: Boolean, default: true },
    canManipulateBiometrics: { type: Boolean, default: false },

    // Access Control
    isAdmin: { type: Boolean, default: false },
    canManageUsers: { type: Boolean, default: false },
    canViewDashboard: { type: Boolean, default: false },
    canViewEmployees: { type: Boolean, default: false },
    canEditEmployees: { type: Boolean, default: false },
    canViewDTR: { type: Boolean, default: false },
    canProcessDTR: { type: Boolean, default: false },
    canViewPayroll: { type: Boolean, default: false },
    canProcessPayroll: { type: Boolean, default: false },
    canViewTrainings: { type: Boolean, default: false },
    canEditTrainings: { type: Boolean, default: false },
    canAccessSettings: { type: Boolean, default: false },
    canChangeDeductions: { type: Boolean, default: false },
    canPerformBackup: { type: Boolean, default: false },
    theme: { type: String, default: 'light' },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
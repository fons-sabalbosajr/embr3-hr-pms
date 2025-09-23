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
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema({
  // Using a single document to store all settings
  singleton: {
    type: String,
    default: "singleton",
    unique: true,
  },

  // DTR Settings
  dtr: {
    defaultStartTime: { type: String, default: "08:00" },
    defaultEndTime: { type: String, default: "17:00" },
    autoFillBreakOut: { type: String, default: "12:00" },
    autoFillBreakIn: { type: String, default: "1:00" },
    // Developer override for cutoff used by dashboard/employee attendance
    overrideCutoff: {
      enabled: { type: Boolean, default: false },
      startDate: { type: Date },
      endDate: { type: Date },
    },
  },

  // General Settings
  general: {
    appName: { type: String, default: "EMB3 HR DTRMS" },
    themeColor: { type: String, default: "#1890ff" }, // Ant Design's default primary color
    headerColor: { type: String, default: "#ffffff" }, // Page header background
    siderColor: { type: String, default: "#001529" }, // Sider background (AntD default dark)
  },

  // Maintenance mode (general — blocks entire app for non-developers)
  maintenance: {
    enabled: { type: Boolean, default: false },
    startDate: { type: Date },
    endDate: { type: Date },
    message: { type: String },
  },

  // Per-feature maintenance — hides / disables individual menu features
  featureMaintenance: {
    type: Map,
    of: new mongoose.Schema(
      {
        enabled: { type: Boolean, default: false },
        message: { type: String, default: "This feature is temporarily unavailable." },
        hidden: { type: Boolean, default: false }, // true = hide from menu entirely
      },
      { _id: false }
    ),
    default: {},
  },

  // Security Settings
  security: {
    sessionTimeout: { type: Number, default: 480 }, // in minutes (8 hours)
    passwordMinLength: { type: Number, default: 8 },
    passwordRequiresNumber: { type: Boolean, default: true },
    passwordRequiresSymbol: { type: Boolean, default: true },
  },

  // Demo Mode Settings
  demo: {
    enabled: { type: Boolean, default: false },
    startDate: { type: Date },
    endDate: { type: Date },
    // Credentials are optional; if not set, default username/password can be used by UI
    credentials: {
      username: { type: String, default: "demo_user" },
      passwordHash: { type: String },
      updatedAt: { type: Date },
    },
    // Restrict visibility for demo users; store permission keys to enable for demo
    allowedPermissions: { type: [String], default: [] },
    // Fine-grained action exceptions: allow specific write actions in demo
    allowedActions: { type: [String], default: [] },
    // New: action keys whose UI buttons should be hidden entirely in demo for demo users
    hiddenActions: { type: [String], default: [] },
    // Defaults for safety
    maskSensitiveData: { type: Boolean, default: true },
    allowSubmissions: { type: Boolean, default: false },
    showActiveBanner: { type: Boolean, default: true },
  },

  // SMTP / Email transport settings (runtime configurable)
  smtp: {
    host: { type: String },
    port: { type: Number },
    secure: { type: Boolean }, // true for 465, false for other ports
    user: { type: String }, // auth user (do NOT expose password back to client)
    fromEmail: { type: String }, // default From email
    fromName: { type: String }, // default From display name
    // We intentionally do not store password here for now; prefer env EMAIL_PASS
    updatedAt: { type: Date },
  },
});

// Method to get or create the settings document
settingsSchema.statics.getSingleton = async function () {
  let settings = await this.findOne({ singleton: "singleton" });
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

export default mongoose.model("Settings", settingsSchema);

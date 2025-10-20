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

  // Maintenance mode
  maintenance: {
    enabled: { type: Boolean, default: false },
    startDate: { type: Date },
    endDate: { type: Date },
    message: { type: String },
  },

  // Security Settings
  security: {
    sessionTimeout: { type: Number, default: 30 }, // in minutes
    passwordMinLength: { type: Number, default: 8 },
    passwordRequiresNumber: { type: Boolean, default: true },
    passwordRequiresSymbol: { type: Boolean, default: true },
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

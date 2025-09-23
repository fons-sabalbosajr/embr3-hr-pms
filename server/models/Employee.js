import mongoose from "mongoose";

// Utility: normalize names consistently
const normalizeName = (name) => {
  if (!name) return null;
  let s = String(name).toLowerCase().trim();

  // If "Last, First ..." -> swap to "First Last ..."
  if (s.includes(",")) {
    const parts = s.split(",");
    const left = parts.shift().trim(); // last name
    const right = parts.join(" ").trim(); // rest
    s = (right + " " + left).trim();
  }

  // remove common suffixes
  s = s.replace(/\b(jr|sr|ii|iii|iv|jr\.|sr\.)\b/g, " ");

  // remove non-alphanumeric except spaces
  s = s.replace(/[^a-z0-9\s]/g, " ");

  return s.replace(/\s+/g, " ").trim();
};

const employeeSchema = new mongoose.Schema(
  {
    empId: { type: String },
    alternateEmpIds: { type: [String], default: [] },
    empNo: { type: String },
    name: { type: String },
    normalizedName: { type: String, index: true }, // ✅ add normalizedName
    empType: { type: String },
    position: { type: String },
    designation: { type: String },
    division: { type: String },
    sectionOrUnit: { type: String },
    emails: { type: [String], default: [] },
    acNo: { type: String },
  },
  { timestamps: true }
);

// Auto-populate normalizedName
employeeSchema.pre("save", function (next) {
  if (this.name) {
    this.normalizedName = normalizeName(this.name);
  }
  next();
});

const Employee = mongoose.model("Employee", employeeSchema);
export default Employee;

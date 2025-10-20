import mongoose from "mongoose";

// Utility reused
const normalizeName = (name) => {
  if (!name) return null;
  let s = String(name).toLowerCase().trim();

  if (s.includes(",")) {
    const parts = s.split(",");
    const left = parts.shift().trim();
    const right = parts.join(" ").trim();
    s = (right + " " + left).trim();
  }

  s = s.replace(/\b(jr|sr|ii|iii|iv|jr\.|sr\.)\b/g, " ");
  s = s.replace(/[^a-z0-9\s]/g, " ");
  return s.replace(/\s+/g, " ").trim();
};

const dtrLogSchema = new mongoose.Schema(
  {
    "AC-No": String,
    normalizedAcNo: { type: String },
    Name: String,
    normalizedName: { type: String }, // ✅ add normalizedName
    Time: Date,
    State: String,
    "New State": String,
    Exception: String,
    DTR_ID: { type: mongoose.Schema.Types.ObjectId, ref: "DTRData" },
  read: { type: Boolean, default: false }, // 👈 Add read field
  hidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);

dtrLogSchema.pre("save", function (next) {
  if (this.Name) {
    this.normalizedName = normalizeName(this.Name);
  }
  if (this["AC-No"]) {
    this.normalizedAcNo = this["AC-No"].replace(/\D/g, "").replace(/^0+/, "");
  }
  next();
});

// Indexes
dtrLogSchema.index({ normalizedAcNo: 1 });
dtrLogSchema.index({ normalizedName: 1 });
dtrLogSchema.index({ DTR_ID: 1 });
dtrLogSchema.index({ Name: 1 });
dtrLogSchema.index({ Time: 1 });
dtrLogSchema.index({ DTR_ID: 1, Name: 1, Time: 1 });

export default mongoose.model("DTRLog", dtrLogSchema);

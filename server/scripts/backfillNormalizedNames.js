import mongoose from "mongoose";
import dotenv from "dotenv";
import Employee from "../models/Employee.js";
import DTRLog from "../models/DTRLog.js";

dotenv.config();

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

const normalizeId = (id) => {
  if (!id) return null;
  return id.replace(/\D/g, "").replace(/^0+/, "");
};

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to DB");

    // --- Employees ---
    const employees = await Employee.find({});
    let empUpdated = 0;
    for (const emp of employees) {
      const newNorm = normalizeName(emp.name);
      if (newNorm && emp.normalizedName !== newNorm) {
        emp.normalizedName = newNorm;
        await emp.save();
        empUpdated++;
      }
    }
    console.log(`✅ Employees updated: ${empUpdated}`);

    // --- DTRLogs ---
    const logs = await DTRLog.find({});
    let logUpdated = 0;
    for (const log of logs) {
      let changed = false;
      if (log.Name) {
        const newNorm = normalizeName(log.Name);
        if (newNorm && log.normalizedName !== newNorm) {
          log.normalizedName = newNorm;
          changed = true;
        }
      }
      if (log["AC-No"]) {
        const newAc = normalizeId(log["AC-No"]);
        if (newAc && log.normalizedAcNo !== newAc) {
          log.normalizedAcNo = newAc;
          changed = true;
        }
      }
      if (changed) {
        await log.save();
        logUpdated++;
      }
    }
    console.log(`✅ DTRLogs updated: ${logUpdated}`);

    await mongoose.disconnect();
    console.log("✅ Done. DB disconnected.");
  } catch (err) {
    console.error("❌ Error during backfill:", err);
    process.exit(1);
  }
};

run();

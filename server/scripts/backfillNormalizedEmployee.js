// scripts/backfillNormalizedEmployee.js
import dotenv from "dotenv";
import connectDB from "../config/db.js";
import Employee from "../models/Employee.js";

dotenv.config();

function normalizeId(id) {
  if (!id) return null;
  return id.replace(/\D/g, "").replace(/^0+/, ""); // strip non-digits + leading zeros
}

const backfillEmployees = async () => {
  try {
    await connectDB();

    const cursor = Employee.find({
      $or: [
        { normalizedEmpId: { $exists: false } },
        { normalizedAlternateEmpIds: { $exists: false } },
      ],
    }).cursor();

    let updated = 0;

    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      if (doc.empId) {
        doc.normalizedEmpId = normalizeId(doc.empId);
      }

      if (doc.alternateEmpIds?.length > 0) {
        doc.normalizedAlternateEmpIds = doc.alternateEmpIds
          .map((id) => normalizeId(id))
          .filter(Boolean);
      }

      await doc.save();
      updated++;
    }

    console.log(`✅ Backfill complete. Updated ${updated} employees.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error in backfill:", err);
    process.exit(1);
  }
};

backfillEmployees();

// scripts/backfillNormalizedDTRLogs.js
import dotenv from "dotenv";
import connectDB from "../config/db.js";
import DTRLog from "../models/DTRLog.js";

dotenv.config();

function normalizeId(id) {
  if (!id) return null;
  return id.replace(/\D/g, "").replace(/^0+/, ""); // strip non-digits + leading zeros
}

const backfillDTRLogs = async () => {
  try {
    await connectDB();

    const cursor = DTRLog.find({
      normalizedAcNo: { $exists: false },
    }).cursor();

    let updated = 0;

    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      if (doc["AC-No"]) {
        doc.normalizedAcNo = normalizeId(doc["AC-No"]);
        await doc.save();
        updated++;
      }
    }

    console.log(`✅ Backfill complete. Updated ${updated} DTR logs.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error in backfill:", err);
    process.exit(1);
  }
};

backfillDTRLogs();

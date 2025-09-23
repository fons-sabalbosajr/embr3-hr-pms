import express from "express";
import DTRData from "../models/DTRData.js";
import DTRLog from "../models/DTRLog.js";
import { getRecentAttendance } from "../controllers/dtrController.js";

const router = express.Router();

router.get("/recent-daily-attendance", getRecentAttendance);

router.post("/upload", async (req, res) => {
  try {
    const { recordName, cutOffStart, cutOffEnd, rows, userId, uploadedBy } =
      req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "No rows provided" });
    }

    // SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // Create DTRData header record
    const dtrData = await DTRData.create({
      DTR_Record_Name: recordName,
      DTR_Cut_Off: {
        start: new Date(cutOffStart),
        end: new Date(cutOffEnd),
      },
      Uploaded_By: userId,
      Uploaded_By_Name: uploadedBy,
      Uploaded_Date: new Date(),
    });

    const total = rows.length;
    let inserted = 0;
    const chunkSize = 50;

    for (let i = 0; i < total; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize).map((row) => ({
        "AC-No": row["AC-No"] || "",
        Name: row["Name"] || "",
        Time: row["Time"] ? new Date(row["Time"]) : null, // convert to Date
        State: row["State"] || "",
        "New State": row["New State"] || "",
        Exception: row["Exception"] || "",
        DTR_ID: dtrData._id,
      }));

      try {
        await DTRLog.insertMany(chunk, { ordered: false });
      } catch (insertErr) {
        // Handle duplicate errors silently, log others
        if (insertErr.code !== 11000) {
          console.error("Insert error:", insertErr);
          res.write(
            `data: ${JSON.stringify({ error: insertErr.message })}\n\n`
          );
          res.end();
          return;
        }
      }

      inserted += chunk.length;

      // Send progress update
      res.write(
        `data: ${JSON.stringify({
          progress: Math.round((inserted / total) * 100),
        })}\n\n`
      );
    }

    // Final completion event
    res.write(
      `data: ${JSON.stringify({ done: true, message: "Upload completed" })}\n\n`
    );
    res.end();
  } catch (err) {
    console.error(err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

export default router;

/**
 * One-time script: seed the v2.4 app-update announcement.
 * Run with:  node scripts/seedAnnouncement_v2_4.js
 * Then delete this file.
 */
import "dotenv/config";
import mongoose from "mongoose";
import Announcement from "../models/Announcement.js";
import connectDB from "../config/db.js";

const TITLE = "System Update — April 2026";

const BODY = `<h3 style="margin-top:0">What's New</h3>
<ul>
  <li><b>DTR Day Tiles — Manual Entry Indicator</b><br/>
    Manually encoded time records (via Find Time Record) now show on the day tiles, matching the same indicator used for biometric punches.</li>
  <li><b>Printer Tray — Manual Entries Visible</b><br/>
    Viewing a DTR from the printer tray now correctly displays manually encoded entries alongside biometric data.</li>
  <li><b>Per-Employee Training Attendance Dates</b><br/>
    Day tiles now reflect each employee's actual attendance dates for trainings instead of the full training date range.</li>
  <li><b>Scan Attendance Sheet — Editable Unmatched Names</b><br/>
    Unmatched names from OCR scans are now shown in an editable table. You can correct names and click <b>Re-match</b> to match them against the employee database. A collapsible raw OCR text viewer is also available for reference.</li>
  <li><b>Improved OCR Name Extraction</b><br/>
    The scan engine now splits side-by-side names that use title prefixes (Mr., Ms., Engr., For., etc.), producing better results from scanned attendance sheets.</li>
</ul>

<h3>Bug Fixes &amp; Improvements</h3>
<ul>
  <li>WFH day tiles now display a teal/cyan indicator.</li>
  <li>Work Status field added to the Find Time Record modal.</li>
  <li>DTR state caching for faster page reloads.</li>
  <li>Container date filtering bug fixed.</li>
  <li>Codebase cleanup — removed unused imports and dead code across DTR modules.</li>
</ul>`;

async function main() {
  await connectDB();

  // Avoid duplicate
  const exists = await Announcement.findOne({ title: TITLE });
  if (exists) {
    console.log("Announcement already exists — skipping.");
    process.exit(0);
  }

  const doc = await Announcement.create({
    title: TITLE,
    body: BODY,
    type: "app-update",
    priority: "normal",
    showPopup: true,
    publishPlace: "both",
    createdBy: "System",
    active: true,
  });

  console.log("Announcement created:", doc._id);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

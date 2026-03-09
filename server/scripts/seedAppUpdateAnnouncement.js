/**
 * Seed App Update Announcement — creates an active announcement about the
 * latest system-wide updates, published on the login page.
 *
 * Usage:  node scripts/seedAppUpdateAnnouncement.js
 *
 * Skips creation if an announcement with the same title already exists.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import Announcement from "../models/Announcement.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/embr3hrpms";

const ANNOUNCEMENT = {
  title: "System Update — DTR Data Management Improvements (March 2026)",
  body: `<p>We've rolled out several improvements to the <strong>DTR Data Management</strong> and <strong>Records Configuration</strong> modules. Here's a summary of what's new:</p>

<h3>🔀 Merge Enhancements</h3>
<ul>
  <li><strong>Real-Time Merge Progress</strong> — When merging time records into a container, a live progress bar now displays the number of records processed, moved, and overwritten so you can track the operation in real time.</li>
  <li><strong>Select All in Edit DTR Data</strong> — A new "Select All" button lets you quickly select all records in the Edit DTR Data table for easier bulk merging.</li>
  <li><strong>Cancel / Abort Merge</strong> — You can now cancel an in-progress merge operation if needed.</li>
</ul>

<h3>📂 Unmerge (Split) Enhancements</h3>
<ul>
  <li><strong>Unmerge from Containers</strong> — Container records now have an Unmerge button, allowing you to split out a date range of time records into a separate DTR Data record.</li>
  <li><strong>Date Range Selection</strong> — When unmerging, you can specify a custom cut-off date range and a new record name for the extracted records.</li>
  <li><strong>Progress & Abort Support</strong> — Unmerge operations now show real-time progress and can be aborted mid-process with automatic rollback.</li>
</ul>

<h3>📊 Generate DTR — Loading Progress</h3>
<ul>
  <li><strong>Data Loading Progress Bar</strong> — When selecting DTR Data from the dropdown on the Generate DTR page, a progress bar now shows how many biometric log records have been loaded, especially useful for large datasets.</li>
</ul>

<h3>🛠️ Bug Fixes</h3>
<ul>
  <li><strong>Employee Document Deletion</strong> — Fixed an issue where deleting employee documents linked to DTR record names would fail with a "File not found" error.</li>
</ul>

<p>These updates are designed to improve efficiency and visibility for HR staff when managing large volumes of biometric time records. If you have questions, please contact the IT team.</p>`,
  type: "app-update",
  priority: "high",
  active: true,
  showPopup: true,
  publishPlace: "both",
  createdBy: "System",
};

async function main() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const existing = await Announcement.findOne({ title: ANNOUNCEMENT.title });
    if (existing) {
      console.log("Announcement already exists — skipping.");
    } else {
      await Announcement.create(ANNOUNCEMENT);
      console.log("App update announcement created successfully.");
    }
  } catch (err) {
    console.error("Error seeding announcement:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

main();

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
  title: "System Update — DTR Generation & Print Tray Improvements (July 2025)",
  body: `<p>We've rolled out new features and important fixes to the <strong>Generate DTR</strong>, <strong>View DTR</strong>, and <strong>Print Tray</strong> modules. Here's what's changed:</p>

<h3>👁️ DTR Data Visibility Toggle</h3>
<ul>
  <li><strong>Hide / Show in Dropdowns</strong> — Container records in DTR Data Settings can now be toggled as <em>Hidden</em> or <em>Visible</em>. Hidden containers no longer appear in the Generate DTR and Biometrics Logs dropdown lists, keeping them uncluttered while preserving your data.</li>
</ul>

<h3>🎨 Streamlined Toolbar Buttons</h3>
<ul>
  <li><strong>Icon-Only Buttons</strong> — The Generate DTR and View DTR toolbars now use compact icon-only buttons with tooltips (Find Time Record, Fill Time Records, Send All Missing DTR Requests, Preview DTR Form 48, Save to Print Tray). This frees up horizontal space and gives the interface a cleaner look.</li>
</ul>

<h3>🛠️ Bug Fixes</h3>
<ul>
  <li><strong>Batch DTR PDF — Missing Employees</strong> — Fixed a layout issue where the first employee's DTR was dropped when printing multiple DTRs from the Print Tray. All selected employees now render correctly in side-by-side format.</li>
  <li><strong>Print Tray — Filled Time Records</strong> — Manually filled time records are now included when saving an employee's DTR to the Print Tray. Previously, only the original biometric logs were passed through.</li>
</ul>

<p>These updates improve usability and reliability when generating, reviewing, and printing DTR forms. If you have questions, please contact the IT team.</p>`,
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

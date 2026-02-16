import WorkFromHome from "../models/WorkFromHome.js";
import { uploadToDrive } from "../utils/googleDrive.js";

/**
 * Google Drive folder for WFH attachments.
 * Must be a folder inside a Shared Drive (service accounts have no personal
 * storage quota). Falls back to the general file / image folder env vars.
 */
const WFH_DRIVE_FOLDER =
  process.env.GOOGLE_DRIVE_FOLDER_ID_WFH ||
  process.env.GOOGLE_DRIVE_FOLDER_ID_FILE ||
  process.env.GOOGLE_DRIVE_FOLDER_ID ||
  process.env.GOOGLE_DRIVE_FOLDER_ID_IMAGE;

/* ─── LIST ─────────────────────────────────────────────────────── */
export const list = async (req, res) => {
  try {
    const { start, end, empId, includeInactive } = req.query;
    const query = {};

    if (empId) query.empId = empId;

    // Date-range filter
    if (start || end) {
      query.$or = [
        // Single-day entries whose date falls within range
        {
          date: {
            ...(start ? { $gte: new Date(start) } : {}),
            ...(end ? { $lte: new Date(end) } : {}),
          },
        },
        // Range entries that overlap with requested window
        ...(start && end
          ? [{ date: { $lte: new Date(end) }, endDate: { $gte: new Date(start) } }]
          : []),
      ];
    }

    if (!includeInactive) query.active = { $ne: false };

    const data = await WorkFromHome.find(query).sort({ date: 1 }).lean();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ─── PUBLIC LIST (no auth, used by WorkCalendar) ──────────────── */
export const publicList = async (req, res) => {
  try {
    const { empId, start, end } = req.query;
    const query = { active: { $ne: false } };
    if (empId) query.empId = empId;
    if (start || end) {
      query.$or = [
        {
          date: {
            ...(start ? { $gte: new Date(start) } : {}),
            ...(end ? { $lte: new Date(end) } : {}),
          },
        },
        ...(start && end
          ? [{ date: { $lte: new Date(end) }, endDate: { $gte: new Date(start) } }]
          : []),
      ];
    }
    const data = await WorkFromHome.find(query).sort({ date: 1 }).lean();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ─── CREATE ───────────────────────────────────────────────────── */
export const create = async (req, res) => {
  try {
    const doc = await WorkFromHome.create(req.body);
    res.status(201).json({ success: true, data: doc });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

/* ─── UPDATE ───────────────────────────────────────────────────── */
export const update = async (req, res) => {
  try {
    const allowed = [
      "empId", "employeeName", "date", "endDate",
      "timeIn", "breakOut", "breakIn", "timeOut",
      "attachmentUrl", "attachmentName", "attachmentDriveId",
      "notes", "active", "createdBy",
    ];
    const payload = {};
    Object.entries(req.body).forEach(([k, v]) => {
      if (allowed.includes(k)) payload[k] = v;
    });
    const doc = await WorkFromHome.findByIdAndUpdate(req.params.id, payload, {
      new: true,
    });
    if (!doc) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: doc });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

/* ─── REMOVE ───────────────────────────────────────────────────── */
export const remove = async (req, res) => {
  try {
    const doc = await WorkFromHome.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: doc });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

/* ─── UPLOAD ATTACHMENT TO GOOGLE DRIVE ────────────────────────── */
export const uploadAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    if (!WFH_DRIVE_FOLDER) {
      return res.status(503).json({
        success: false,
        message:
          "Drive storage not configured. Set GOOGLE_DRIVE_FOLDER_ID_WFH (or GOOGLE_DRIVE_FOLDER_ID_FILE / GOOGLE_DRIVE_FOLDER_ID) to a Shared Drive folder ID.",
      });
    }

    const { originalname, mimetype, buffer } = req.file;

    const result = await uploadToDrive({
      buffer,
      mimeType: mimetype,
      filename: originalname,
      folderId: WFH_DRIVE_FOLDER,
    });

    res.json({
      success: true,
      data: {
        attachmentUrl: result.webViewLink,
        attachmentName: originalname,
        attachmentDriveId: result.id,
      },
    });
  } catch (e) {
    console.error("WFH attachment upload error:", e);
    const errMsg = String(e?.message || "").toLowerCase();
    if (errMsg.includes("storage quota")) {
      return res.status(500).json({
        success: false,
        message:
          "Upload failed: Service Account has no storage quota. Set GOOGLE_DRIVE_FOLDER_ID_WFH (or GOOGLE_DRIVE_FOLDER_ID_FILE) to a Shared Drive folder ID shared with the service account.",
      });
    }
    res.status(500).json({ success: false, message: e.message });
  }
};

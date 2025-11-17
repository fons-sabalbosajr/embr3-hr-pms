import { sendBugReportEmail } from "../utils/email.js";
import BugReport from "../models/BugReport.js";

// naive in-memory rate limit: max N per IP per window
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_WINDOW = 10;
const ipHits = new Map(); // ip -> { count, resetAt }

const checkRateLimit = (ip) => {
  const now = Date.now();
  const rec = ipHits.get(ip);
  if (!rec || now > rec.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }
  if (rec.count >= MAX_PER_WINDOW) return { allowed: false, retryAfter: Math.ceil((rec.resetAt - now) / 1000) };
  rec.count += 1;
  return { allowed: true };
};

export const reportBug = async (req, res) => {
  try {
    const ip = req.headers["x-forwarded-for"]?.split(',')[0]?.trim() || req.socket?.remoteAddress || "unknown";
    const { allowed, retryAfter } = checkRateLimit(ip);
    if (!allowed) {
      return res.status(429).json({ success: false, message: `Too many reports. Try again in ${retryAfter}s.` });
    }

    const { title, description, pageUrl, userAgent, email, name, employeeId, screenshotBase64 } = req.body || {};
    if (!title || !description) {
      return res.status(400).json({ success: false, message: "Title and description are required." });
    }
    const safeTitle = String(title).slice(0, 180);
    const to = process.env.BUG_REPORT_TO || "embrhrpms@gmail.com";
    const meta = {
      Reporter: name || "",
      Email: email || "",
      EmployeeID: employeeId || "",
      Page: pageUrl || req.headers.referer || "",
      UserAgent: userAgent || req.headers["user-agent"] || "",
      IP: ip,
    };
    await sendBugReportEmail({
      to,
      from: email,
      subject: `Bug: ${safeTitle}`,
      message: description,
      meta,
      screenshotBase64,
    });

    // Persist report for Dev Settings tab
    const saved = await BugReport.create({
      title: safeTitle,
      description,
      pageUrl: meta.Page,
      userAgent: meta.UserAgent,
      reporterEmail: email || "",
      reporterName: name || "",
      employeeId: employeeId || "",
      ip,
      status: "open",
      hasScreenshot: !!screenshotBase64,
    });
    return res.json({ success: true, message: "Bug report sent. Thank you!", id: saved?._id });
  } catch (err) {
    console.error("[BugReport] Failed:", err?.message || err);
    return res.status(500).json({ success: false, message: "Failed to send bug report." });
  }
};

export const listBugReports = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.max(parseInt(req.query.limit || '10', 10), 1);
    const skip = (page - 1) * limit;
    const { status, q } = req.query || {};

    const filter = {};
    if (status && (status === 'open' || status === 'resolved')) filter.status = status;
    if (q && String(q).trim()) {
      const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { title: rx },
        { description: rx },
        { reporterEmail: rx },
        { reporterName: rx },
      ];
    }

    const [rows, total] = await Promise.all([
      BugReport.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      BugReport.countDocuments(filter),
    ]);
    return res.json({ success: true, data: rows, total, page, limit });
  } catch (err) {
    console.error('[BugReport] List failed:', err?.message || err);
    return res.status(500).json({ success: false, message: 'Failed to fetch bug reports' });
  }
};

export const updateBugReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const payload = {};
    if (status && (status === 'open' || status === 'resolved')) payload.status = status;
    if (!Object.keys(payload).length) return res.status(400).json({ success: false, message: 'No valid fields to update' });
    const updated = await BugReport.findByIdAndUpdate(id, payload, { new: true }).lean();
    if (!updated) return res.status(404).json({ success: false, message: 'Bug report not found' });
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[BugReport] Update failed:', err?.message || err);
    return res.status(500).json({ success: false, message: 'Failed to update bug report' });
  }
};

export const deleteBugReport = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await BugReport.findByIdAndDelete(id).lean();
    if (!deleted) return res.status(404).json({ success: false, message: 'Bug report not found' });
    return res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    console.error('[BugReport] Delete failed:', err?.message || err);
    return res.status(500).json({ success: false, message: 'Failed to delete bug report' });
  }
};

export default { reportBug, listBugReports, updateBugReport, deleteBugReport };

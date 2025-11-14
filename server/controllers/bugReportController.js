import { sendBugReportEmail } from "../utils/email.js";

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
    return res.json({ success: true, message: "Bug report sent. Thank you!" });
  } catch (err) {
    console.error("[BugReport] Failed:", err?.message || err);
    return res.status(500).json({ success: false, message: "Failed to send bug report." });
  }
};

export default { reportBug };

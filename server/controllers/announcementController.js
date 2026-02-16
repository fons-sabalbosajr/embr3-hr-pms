import Announcement from "../models/Announcement.js";
import Employee from "../models/Employee.js";
import { sendAnnouncementEmail, sendAppUpdateEmail } from "../utils/email.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const now = () => new Date();

const activeFilter = () => ({
  active: true,
  $or: [{ publishAt: { $exists: false } }, { publishAt: null }, { publishAt: { $lte: now() } }],
  $and: [
    { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gte: now() } }] },
  ],
});

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/** GET /  — list all (admin) or active-only (regular users) */
export const getAnnouncements = async (req, res) => {
  try {
    const isAdmin = req.user?.isAdmin || req.user?.canManageNotifications;
    const filter = isAdmin ? {} : activeFilter();
    const docs = await Announcement.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: docs });
  } catch (err) {
    console.error("[Announcements] list error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/** GET /active — only active, non-expired, published announcements (for pop-up) */
export const getActiveAnnouncements = async (req, res) => {
  try {
    const filter = {
      ...activeFilter(),
      // Only return pop-up or both — exclude login-only
      publishPlace: { $in: ["popup", "both"] },
    };
    const docs = await Announcement.find(filter)
      .sort({ priority: -1, createdAt: -1 })
      .lean();
    res.json({ success: true, data: docs });
  } catch (err) {
    console.error("[Announcements] active error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/** GET /login — public (no auth) active announcements targeted at the login page */
export const getLoginAnnouncements = async (req, res) => {
  try {
    const filter = {
      ...activeFilter(),
      publishPlace: { $in: ["login", "both"] },
    };
    const docs = await Announcement.find(filter)
      .select("title body type priority createdAt createdBy publishPlace")
      .sort({ priority: -1, createdAt: -1 })
      .lean();
    res.json({ success: true, data: docs });
  } catch (err) {
    console.error("[Announcements] login error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/** POST / — create */
export const createAnnouncement = async (req, res) => {
  try {
    const { title, body, type, priority, showPopup, publishPlace, publishAt, expiresAt } = req.body;
    if (!title || !body) {
      return res.status(400).json({ success: false, message: "Title and body are required." });
    }
    const doc = await Announcement.create({
      title,
      body,
      type: type || "announcement",
      priority: priority || "normal",
      showPopup: showPopup !== false,
      publishPlace: publishPlace || "popup",
      publishAt: publishAt || null,
      expiresAt: expiresAt || null,
      createdBy: req.user?.name || req.user?.email || "Admin",
    });
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    console.error("[Announcements] create error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/** PUT /:id — update */
export const updateAnnouncement = async (req, res) => {
  try {
    const { title, body, type, priority, active, showPopup, publishPlace, publishAt, expiresAt } = req.body;
    const doc = await Announcement.findByIdAndUpdate(
      req.params.id,
      {
        ...(title !== undefined && { title }),
        ...(body !== undefined && { body }),
        ...(type !== undefined && { type }),
        ...(priority !== undefined && { priority }),
        ...(active !== undefined && { active }),
        ...(showPopup !== undefined && { showPopup }),
        ...(publishPlace !== undefined && { publishPlace }),
        ...(publishAt !== undefined && { publishAt: publishAt || null }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt || null }),
        updatedBy: req.user?.name || req.user?.email || "Admin",
      },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: doc });
  } catch (err) {
    console.error("[Announcements] update error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/** DELETE /:id */
export const deleteAnnouncement = async (req, res) => {
  try {
    const doc = await Announcement.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    console.error("[Announcements] delete error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/** PUT /:id/dismiss — mark announcement as dismissed for the current user */
export const dismissAnnouncement = async (req, res) => {
  try {
    const userId = req.user?._id?.toString() || req.user?.id || req.user?.email;
    if (!userId) return res.status(400).json({ success: false, message: "User identification required" });
    await Announcement.findByIdAndUpdate(req.params.id, {
      $addToSet: { dismissedBy: userId },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[Announcements] dismiss error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Email Blast ──────────────────────────────────────────────────────────────

/** GET /recipients-options — distinct divisions and sections for target selector */
export const getRecipientOptions = async (_req, res) => {
  try {
    const [divisions, sections] = await Promise.all([
      Employee.distinct("division", { division: { $ne: null, $ne: "" }, isResigned: { $ne: true } }),
      Employee.distinct("sectionOrUnit", { sectionOrUnit: { $ne: null, $ne: "" }, isResigned: { $ne: true } }),
    ]);
    res.json({
      success: true,
      divisions: divisions.filter(Boolean).sort(),
      sections: sections.filter(Boolean).sort(),
    });
  } catch (err) {
    console.error("[Announcements] recipient options error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/** GET /employees-emails — list employees with emails for specific selection */
export const getEmployeesWithEmails = async (_req, res) => {
  try {
    const employees = await Employee.find({
      emails: { $exists: true, $not: { $size: 0 } },
      isResigned: { $ne: true },
    })
      .select("empId name division sectionOrUnit emails")
      .sort({ name: 1 })
      .lean();
    res.json({ success: true, data: employees });
  } catch (err) {
    console.error("[Announcements] employees-emails error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/** POST /:id/send-email — blast announcement to targeted employees */
export const sendAnnouncementEmailBlast = async (req, res) => {
  try {
    const doc = await Announcement.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Announcement not found" });

    const { targetMode = "all", targetValues = [] } = req.body;

    // Build employee query based on target mode
    let empFilter = {
      emails: { $exists: true, $not: { $size: 0 } },
      isResigned: { $ne: true },
    };

    if (targetMode === "division" && targetValues.length > 0) {
      empFilter.division = { $in: targetValues };
    } else if (targetMode === "section" && targetValues.length > 0) {
      empFilter.sectionOrUnit = { $in: targetValues };
    } else if (targetMode === "specific" && targetValues.length > 0) {
      // targetValues contains empIds
      empFilter.empId = { $in: targetValues };
    }

    const employees = await Employee.find(empFilter).lean();

    const recipientEmails = new Set();
    for (const emp of employees) {
      if (Array.isArray(emp.emails)) {
        emp.emails.forEach((e) => { if (e) recipientEmails.add(e); });
      }
    }

    if (recipientEmails.size === 0) {
      return res.status(400).json({ success: false, message: "No employee emails found for the selected target." });
    }

    const isAppUpdate = doc.type === "app-update";
    const sendFn = isAppUpdate ? sendAppUpdateEmail : sendAnnouncementEmail;

    // Send in small batches to avoid overwhelming SMTP
    const emailList = Array.from(recipientEmails);
    const batchSize = 10;
    let sentCount = 0;
    let failCount = 0;
    const sentEmails = [];
    const failedEmails = [];

    for (let i = 0; i < emailList.length; i += batchSize) {
      const batch = emailList.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((email) =>
          sendFn({
            to: email,
            title: doc.title,
            body: doc.body,
            type: doc.type,
            priority: doc.priority,
          })
        )
      );
      results.forEach((r, idx) => {
        if (r.status === "fulfilled") {
          sentCount++;
          sentEmails.push(batch[idx]);
        } else {
          failCount++;
          failedEmails.push(batch[idx]);
        }
      });
    }

    // Update announcement record
    doc.emailSent = true;
    doc.emailSentAt = new Date();
    doc.emailRecipientCount = sentCount;
    doc.emailRecipients = sentEmails;
    doc.emailTargetMode = targetMode;
    doc.emailTargetValues = targetMode !== "all" ? targetValues : [];
    await doc.save();

    res.json({
      success: true,
      message: `Email sent to ${sentCount} recipient(s)${failCount ? `, ${failCount} failed` : ""}.`,
      sentCount,
      failCount,
      sentEmails,
      failedEmails,
    });
  } catch (err) {
    console.error("[Announcements] email blast error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/** PATCH /:id/reconstruct-recipients — backfill emailRecipients for announcements sent before tracking was added */
export const reconstructRecipients = async (req, res) => {
  try {
    const doc = await Announcement.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Not found" });

    if (!doc.emailSent) {
      return res.status(400).json({ success: false, message: "This announcement has not been emailed yet." });
    }

    // Build employee filter from stored target mode
    const mode = doc.emailTargetMode || "all";
    const values = doc.emailTargetValues || [];
    let empFilter = {
      emails: { $exists: true, $not: { $size: 0 } },
      isResigned: { $ne: true },
    };
    if (mode === "division" && values.length > 0) empFilter.division = { $in: values };
    else if (mode === "section" && values.length > 0) empFilter.sectionOrUnit = { $in: values };
    else if (mode === "specific" && values.length > 0) empFilter.empId = { $in: values };

    const employees = await Employee.find(empFilter).lean();
    const emails = [];
    for (const emp of employees) {
      if (Array.isArray(emp.emails)) {
        emp.emails.forEach((e) => { if (e) emails.push(e); });
      }
    }
    const unique = [...new Set(emails)];

    doc.emailRecipients = unique;
    if (!doc.emailRecipientCount || doc.emailRecipientCount === 0) {
      doc.emailRecipientCount = unique.length;
    }
    await doc.save();

    res.json({ success: true, data: unique, message: `Reconstructed ${unique.length} recipient(s).` });
  } catch (err) {
    console.error("[Announcements] reconstruct-recipients error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

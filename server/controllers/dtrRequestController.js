import DTRRequest from "../models/DTRRequest.js";
import { getSocketInstance } from "../socket.js";
import User from "../models/User.js";
import Employee from "../models/Employee.js";
import AuditLog from "../models/AuditLog.js";
import { sendRequestAcknowledgmentEmail, sendDTRDeliveryEmail } from "../utils/email.js";
import { buildRequestAcknowledgmentEmail, buildDTREmail } from "../utils/emailTemplates.js";

export const createDTRRequest = async (req, res) => {
  try {
    const { employeeId, startDate, endDate, email } = req.body || {};
    if (!employeeId || !startDate || !endDate || !email) {
      return res.status(400).json({ success: false, message: "employeeId, startDate, endDate and email are required" });
    }

    const doc = await DTRRequest.create({ employeeId, startDate, endDate, email });

    const io = getSocketInstance();
    if (io) {
      // Emit normalized notification payload
      io.emit("newNotification", {
        type: "DTRRequest",
        id: String(doc._id),
        employeeId: doc.employeeId,
        createdAt: doc.createdAt,
        read: !!doc.read,
        hidden: !!doc.hidden,
        title: `DTR Request - ${doc.employeeId}`,
        body: `${new Date(doc.startDate).toLocaleDateString()} - ${new Date(doc.endDate).toLocaleDateString()}`,
      });
    }

    // Send acknowledgment email (fire-and-forget, non-blocking)
    try {
      const isGmail = /^[^\s@]+@gmail\.com$/i.test(email);
      if (isGmail) {
        const html = buildRequestAcknowledgmentEmail({
          requestType: 'DTR',
          employeeId,
          startDate,
          endDate,
        });
        sendRequestAcknowledgmentEmail({
          to: email,
          subject: `DTR Request Received — ${employeeId}`,
          html,
        }).catch(err => console.warn('[DTR] Acknowledgment email failed:', err?.message));
      }
    } catch (ackErr) {
      console.warn('[DTR] Could not queue acknowledgment email:', ackErr?.message);
    }

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to create DTR request" });
  }
};

export const getDTRRequests = async (_req, res) => {
  try {
    // Only return pending (unsent) requests as active notifications
    const rows = await DTRRequest.find({ status: { $ne: 'sent' } }).sort({ createdAt: -1 });
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch DTR requests" });
  }
};

export const markDTRRequestAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const row = await DTRRequest.findById(id);
    if (!row) return res.status(404).json({ success: false, message: "Request not found" });
    row.read = true;
    await row.save();
    res.json({ success: true, data: row });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to mark as read" });
  }
};

export const markAllDTRRequestsAsRead = async (_req, res) => {
  try {
    await DTRRequest.updateMany({}, { $set: { read: true } });
    res.json({ success: true, message: "All dtr requests marked as read" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to mark all as read" });
  }
};

export const updateDTRRequest = async (req, res) => {
  try {
    const callerId = req.user?.id || req.user?._id;
    let caller = null;
    if (callerId) caller = await User.findById(callerId);
    if (!caller && req.user && typeof req.user === 'object') caller = req.user;
    if (!caller) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const allowed = !!(caller.isAdmin || caller.canManageNotifications || caller.canAccessNotifications || caller.canSeeDev || caller.userType === 'developer');
    if (!allowed) return res.status(403).json({ success: false, message: 'Forbidden' });

    const { id } = req.params;
    const body = req.body || {};
    const whitelist = ['hidden'];
    const changes = {};
    Object.keys(body).forEach(k => { if (whitelist.includes(k)) changes[k] = body[k]; });
    const updated = await DTRRequest.findByIdAndUpdate(id, { $set: changes }, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update DTR request' });
  }
};

export const deleteDTRRequest = async (req, res) => {
  try {
    const callerId = req.user?.id || req.user?._id;
    const caller = callerId ? await User.findById(callerId) : null;
    if (!caller || !(caller.isAdmin || caller.canManageNotifications || caller.canAccessNotifications || caller.canSeeDev)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { id } = req.params;
    const deleted = await DTRRequest.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: deleted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete DTR request' });
  }
};

// Send DTR email with attached PDF (base64) and update request status
export const sendDTREmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { pdfBase64, filename = 'dtr.pdf', subject, bodyHtml } = req.body || {};
    if (!pdfBase64) return res.status(400).json({ success: false, message: 'pdfBase64 is required' });

    const callerId = req.user?.id || req.user?._id;
    const caller = callerId ? await User.findById(callerId) : null;
    if (!caller || !(caller.isAdmin || caller.canManageNotifications || caller.canAccessNotifications || caller.canSeeDev || caller.canViewDTR)) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
    }

    const row = await DTRRequest.findById(id);
    if (!row) return res.status(404).json({ success: false, message: 'DTR request not found' });

    // Allow up to 5 resends after the initial send
    const maxResends = 5;
    const currentResends = Number(row.resendCount || 0);
    const alreadySentOnce = !!row.sentAt;
    if (alreadySentOnce && currentResends >= maxResends) {
      return res.status(429).json({
        success: false,
        code: 'RESEND_LIMIT_REACHED',
        message: `Resend limit reached. You can resend up to ${maxResends} times for this DTR request.`,
        resendCount: currentResends,
        maxResends,
      });
    }

    // Retrieve employee document for template enrichment
    let employeeDoc = null;
    try {
      if (row.employeeId) {
        employeeDoc = await Employee.findOne({ empId: row.employeeId }).lean();
      }
    } catch (_) {}

    // Use shared corporate template
    const html = buildDTREmail({
      startDate: row.startDate,
      endDate: row.endDate,
      employee: employeeDoc,
      customMessage: bodyHtml,
    });

    let info;
    let simulated = false;
    try {
      // Normalize pdf payload to raw base64
      const extractBase64 = (s) => {
        try {
          const str = String(s || '');
          const noHash = str.split('#')[0];
          const m = noHash.match(/^data:application\/pdf[^,]*,(.*)$/i);
          const b64 = m ? m[1] : noHash;
          return b64.replace(/\s+/g, '');
        } catch {
          return String(s || '');
        }
      };
      const rawBase64 = extractBase64(pdfBase64);
      const pdfBuffer = Buffer.from(rawBase64, 'base64');

      const startLabel = row.startDate ? new Date(row.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';

      info = await sendDTRDeliveryEmail({
        to: row.email,
        subject: subject || `Daily Time Record — ${startLabel}`,
        html,
        pdfBuffer,
        filename,
      });
      if (info && info.skipped) {
        console.log('[DTR] Email sending disabled (DISABLE_EMAIL). Marking as simulated.');
        simulated = true;
      }
    } catch (mailErr) {
      console.error('Failed to send DTR email', mailErr);
      return res.status(502).json({ success: false, message: 'Failed to send email', error: mailErr.message });
    }

    const now = new Date();
    if (!row.sentAt) {
      row.sentAt = now;
    } else {
      row.resendCount = currentResends + 1;
      row.lastSentAt = now;
    }
    row.sentBy = caller._id?.toString() || caller.id || 'unknown';
    row.status = 'sent';
    row.emailMessageId = info?.messageId;
    await row.save();

    // Audit log
    try {
      await AuditLog.create({
        action: 'dtr:email-sent',
        performedBy: caller?._id,
        performedByName: caller?.name || caller?.email,
        details: {
          requestId: row._id?.toString(),
          empId: row.employeeId,
          startDate: row.startDate,
          endDate: row.endDate,
          email: row.email,
          filename,
          messageId: row.emailMessageId,
          sentAt: row.sentAt,
        },
      });
    } catch (e) {
      console.warn('Failed to write DTR email audit log', e);
    }

    // Save the request email to the employee's profile (addToSet avoids duplicates)
    if (row.email && row.employeeId) {
      try {
        await Employee.updateOne(
          { empId: row.employeeId },
          { $addToSet: { emails: row.email } }
        );
      } catch (e) {
        console.warn('Failed to save email to employee profile', e);
      }
    }

    const io = getSocketInstance();
    if (io) {
      io.emit('dtrSent', { id: row._id, employeeId: row.employeeId, sentAt: row.sentAt });
    }

    res.json({ success: true, data: row, simulated, resendCount: Number(row.resendCount || 0), maxResends });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Unexpected error sending DTR email' });
  }
};

import PayslipRequest from "../models/PayslipRequest.js";
import EmployeeDoc from "../models/employeeDocModel.js";
import { getSocketInstance } from "../socket.js";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import Employee from "../models/Employee.js";
import nodemailer from "nodemailer";
import fs from 'fs';
import path from 'path';
import { buildPayslipEmail } from "../utils/emailTemplates.js";

export const createPayslipRequest = async (req, res) => {
  try {
    const { employeeId, period, email } = req.body;

    if (!employeeId || !period || !email) {
      return res.status(400).json({ success: false, message: "employeeId, period, and email are required" });
    }

    // Idempotency: if there's already a request for the same employee and period, return the latest one
    try {
      // Prefer a pending request to continue the flow
      let existing = await PayslipRequest.findOne({ employeeId, period, status: 'pending' });
      // If no pending request, reuse the latest non-rejected request for this period
      if (!existing) {
        existing = await PayslipRequest.findOne({ employeeId, period, status: { $ne: 'rejected' } }).sort({ createdAt: -1 });
      }
      if (existing) return res.status(200).json({ success: true, data: existing, reused: true });
    } catch (findErr) {
      console.warn('Failed to check existing payslip request', { employeeId, period, err: findErr });
    }

    // 🔒 Rate limit: max 3 pending requests per employee+period group to prevent spam
    try {
      const pendingCount = await PayslipRequest.countDocuments({ employeeId, period, status: 'pending' });
      if (pendingCount >= 3) {
        return res.status(429).json({
          success: false,
          code: 'REQUEST_LIMIT_REACHED',
          message: 'You already have 3 pending payslip requests for this period. Please wait for HR to verify before submitting another.',
          pendingCount
        });
      }
    } catch (countErr) {
      console.warn('Failed to count pending payslip requests', { employeeId, err: countErr });
      // Non-fatal: allow request to proceed
    }

    const newRequest = await PayslipRequest.create({ employeeId, period, email });

    if (newRequest) {
      const io = getSocketInstance();
      if (io) {
        // Emit document shape with a type field for client consumption
        const payload = { ...newRequest.toObject(), type: "PayslipRequest" };
        io.emit("newNotification", payload);
      }
    }

    res.status(201).json({ success: true, data: newRequest });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to create payslip request" });
  }
};

// ✅ New controller for GET
export const getPayslipRequests = async (req, res) => {
  try {
    const requests = await PayslipRequest.find().sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch payslip requests" });
  }
};

export const markAllPayslipRequestsAsRead = async (req, res) => {
  try {
    await PayslipRequest.updateMany({}, { $set: { read: true } });
    res.json({ success: true, message: "All requests marked as read" });
  } catch (error) {
    console.error("Error marking all requests as read:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await PayslipRequest.findById(id);

    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    request.read = true;
    await request.save();

    res.json({ success: true, data: request });
  } catch (error) {
    console.error("Error marking request as read:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Update payslip request (supports toggling 'hidden')
export const updatePayslipRequest = async (req, res) => {
  try {
    const callerId = req.user?.id || req.user?._id;
    let caller = null;
    if (callerId) caller = await User.findById(callerId);
    // Fallback: sometimes the token contains user flags directly
    if (!caller && req.user && typeof req.user === 'object') caller = req.user;
    if (!caller) {
      console.warn('updatePayslipRequest: no caller resolved', { callerId, tokenPayload: req.user });
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const allowedToManage = !!(caller.isAdmin || caller.canManageNotifications || caller.canAccessNotifications || caller.canSeeDev || caller.userType === 'developer');
    if (!allowedToManage) {
      console.warn('updatePayslipRequest: permission denied', { callerId, caller: { id: caller._id || caller.id, isAdmin: caller.isAdmin, canManageNotifications: caller.canManageNotifications, canAccessNotifications: caller.canAccessNotifications, canSeeDev: caller.canSeeDev, userType: caller.userType } });
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
    }

    const { id } = req.params;
    const body = req.body || {};
    const allowed = ['hidden'];
    const changes = {};
    Object.keys(body).forEach(k => { if (allowed.includes(k)) changes[k] = body[k]; });
    const updated = await PayslipRequest.findByIdAndUpdate(id, { $set: changes }, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update payslip request' });
  }
};

export const deletePayslipRequest = async (req, res) => {
  try {
    const callerId = req.user?.id || req.user?._id;
    const caller = callerId ? await User.findById(callerId) : null;
    if (!caller || !(caller.isAdmin || caller.canManageNotifications || caller.canAccessNotifications || caller.canSeeDev)) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions to delete payslip request' });
    }

    const { id } = req.params;
    const deleted = await PayslipRequest.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: deleted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete payslip request' });
  }
};

// Send payslip email with attached PDF (base64) and update request
export const sendPayslipEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { pdfBase64, filename = 'payslip.pdf', subject, bodyHtml } = req.body || {};
    if (!pdfBase64) return res.status(400).json({ success: false, message: 'pdfBase64 is required' });

    const callerId = req.user?.id || req.user?._id;
    const caller = callerId ? await User.findById(callerId) : null;
    if (!caller || !(caller.isAdmin || caller.canManageNotifications || caller.canAccessNotifications || caller.canSeeDev || caller.canViewPayroll)) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
    }

  const row = await PayslipRequest.findById(id);
    if (!row) return res.status(404).json({ success: false, message: 'Payslip request not found' });

    // Allow up to 5 resends after the initial send
    const maxResends = 5;
    const currentResends = Number(row.resendCount || 0);
    const alreadySentOnce = !!row.sentAt;
    if (alreadySentOnce && currentResends >= maxResends) {
      return res.status(429).json({
        success: false,
        code: 'RESEND_LIMIT_REACHED',
        message: `Resend limit reached. You can resend up to ${maxResends} times for this payslip request.`,
        resendCount: currentResends,
        maxResends,
      });
    }

    // Validate env configuration with non-production fallback
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, ALLOW_FAKE_EMAILS, NODE_ENV, DISABLE_EMAIL } = process.env;
    const EMAIL_HOST = process.env.EMAIL_HOST;
    const EMAIL_PORT = process.env.EMAIL_PORT;
    const EMAIL_USER = process.env.EMAIL_USER;
    const EMAIL_PASS = process.env.EMAIL_PASS;
    const EMAIL_SECURE = (process.env.EMAIL_SECURE || '').toLowerCase();

    // Prefer SMTP_* if set, else fall back to EMAIL_* variables
    const host = SMTP_HOST || EMAIL_HOST;
    const port = Number(SMTP_PORT || EMAIL_PORT);
    const secure = (String(SMTP_SECURE).toLowerCase() === 'true') || (EMAIL_SECURE === 'true');
    const user = SMTP_USER || EMAIL_USER;
    const pass = SMTP_PASS || EMAIL_PASS;

    const allowFake = (ALLOW_FAKE_EMAILS === 'true')
      || (NODE_ENV && NODE_ENV !== 'production')
      || (DISABLE_EMAIL && DISABLE_EMAIL.toLowerCase() === 'true')
      || (!host || !port || !user || !pass);
    let transporter;
    if (!host || !port || !user || !pass) {
      if (!allowFake) {
        return res.status(500).json({ success: false, message: 'SMTP configuration missing. Please set SMTP_* or EMAIL_* variables.' });
      }
      // Fallback: capture email to server logs (non-production / ALLOW_FAKE_EMAILS)
      transporter = nodemailer.createTransport({
        streamTransport: true,
        buffer: true,
        newline: 'unix',
      });
    } else {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      });
    }

    // Retrieve employee document early for template enrichment
    let employeeDoc = null;
    try {
      if (row.employeeId) {
        employeeDoc = await Employee.findOne({ empId: row.employeeId }).lean();
      }
    } catch (_) {}

    // Use shared corporate template (text-only branding; no logo inline/attachment)
    const html = buildPayslipEmail({ period: row.period, employee: employeeDoc, customMessage: bodyHtml });

    let info;
    let simulated = false;
    const fromAddress = user || 'no-reply@example.local';
    try {
      const fromName = process.env.EMAIL_FROM_NAME || 'EMBR3 DTRMS Personnel';
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

      const mailOptions = {
        from: `${fromName} <${fromAddress}>`,
        to: row.email,
        subject: subject || `Payslip ${row.period}`,
        html,
        attachments: [
          {
            filename,
            content: pdfBuffer,
            contentType: 'application/pdf',
            contentDisposition: 'attachment',
          },
        ],
      };
      info = await transporter.sendMail(mailOptions);
      if (allowFake && info && info.message) {
        console.log('FAKE EMAIL (captured):\n', info.message.toString());
        simulated = true;
      }
    } catch (mailErr) {
      console.error('Failed to send payslip email', mailErr);
      return res.status(502).json({ success: false, message: 'Failed to send email', error: mailErr.message });
    }

    const now = new Date();
    if (!row.sentAt) {
      row.sentAt = now; // first send
    } else {
      // subsequent resend
      row.resendCount = currentResends + 1;
      row.lastSentAt = now;
    }
    row.sentBy = caller._id?.toString() || caller.id || 'unknown';
    row.status = 'sent';
    row.emailMessageId = info?.messageId;
    await row.save();

    // Audit log: record email sent under employee records/history
    try {
      await AuditLog.create({
        action: 'payslip:email-sent',
        performedBy: caller?._id,
        performedByName: caller?.name || caller?.email,
        details: {
          requestId: row._id?.toString(),
          empId: row.employeeId,
          employeeObjectId: employeeDoc?._id || null,
          period: row.period,
          email: row.email,
          filename,
          messageId: row.emailMessageId,
          sentAt: row.sentAt,
        },
      });
    } catch (e) {
      // non-fatal
      console.warn('Failed to write payslip email audit log', e);
    }

    const io = getSocketInstance();
    if (io) {
      io.emit('payslipSent', { id: row._id, employeeId: row.employeeId, period: row.period, sentAt: row.sentAt });
    }

    // Ensure a System Reports entry exists/updated for this payslip
    try {
      const empId = row.employeeId;
      const period = row.period;
      const docType = 'Payslip';
      const description = `Payslip emailed to ${row.email} for ${period}`;
      const createdBy = caller?.username || caller?.email || caller?._id?.toString() || 'system';

      let existingDoc = await EmployeeDoc.findOne({ empId, docType, period });
      if (existingDoc) {
        // Update description to reflect email action; keep original dateIssued/docNo
        existingDoc.description = description;
        // Preserve any payload/isFullMonthRange fields already present
        await existingDoc.save();
        try { if (io) io.emit('employeeDoc:created', { ...existingDoc.toObject(), isNew: false }); } catch (_) {}
      } else {
        // Create a new doc with docNo computed by the period's year (preferred)
        let year;
        if (typeof period === 'string') {
          const parts = period.split(' - ');
          const start = parts && parts.length > 0 ? new Date(parts[0]) : null;
          year = start && !isNaN(start.getTime()) ? start.getFullYear() : undefined;
        }
        const basis = new Date();
        if (!year) year = basis.getFullYear();
        let yearlyCount = 0;
        try {
          const periodRegex = new RegExp(`^${year}-`);
          yearlyCount = await EmployeeDoc.countDocuments({ docType: 'Payslip', period: { $regex: periodRegex } });
        } catch (_) {
          yearlyCount = 0;
        }
        if (!yearlyCount) {
          const yearStart = new Date(year, 0, 1);
          const nextYearStart = new Date(year + 1, 0, 1);
          yearlyCount = await EmployeeDoc.countDocuments({
            docType: 'Payslip',
            $or: [
              { dateIssued: { $gte: yearStart, $lt: nextYearStart } },
              { dateIssued: { $exists: false }, createdAt: { $gte: yearStart, $lt: nextYearStart } },
            ],
          });
        }
        const docNo = yearlyCount + 1;
        const newDoc = await EmployeeDoc.create({
          empId,
          docType,
          period,
          dateIssued: basis.toISOString(),
          description,
          createdBy,
          docNo,
        });
        try { if (io) io.emit('employeeDoc:created', { ...newDoc.toObject(), isNew: true }); } catch (_) {}
      }
    } catch (docErr) {
      console.warn('Failed to upsert System Reports entry for emailed payslip', docErr);
      // non-fatal
    }

    res.json({ success: true, data: row, simulated, resendCount: Number(row.resendCount || 0), maxResends });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Unexpected error sending payslip email' });
  }
};

import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Build a robust transport with env-driven configuration
const buildTransport = () => {
  const {
    SMTP_URL,
    EMAIL_SERVICE,
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_SECURE,
    EMAIL_USER,
    EMAIL_PASS,
    EMAIL_POOL,
    EMAIL_POOL_MAX_CONNECTIONS,
    EMAIL_POOL_MAX_MESSAGES,
    EMAIL_CONNECTION_TIMEOUT_MS,
    EMAIL_SOCKET_TIMEOUT_MS,
    EMAIL_GREETING_TIMEOUT_MS,
  } = process.env;

  const pool = EMAIL_POOL ? EMAIL_POOL.toLowerCase() !== "false" : true;
  const maxConnections = parseInt(EMAIL_POOL_MAX_CONNECTIONS || "3", 10);
  const maxMessages = parseInt(EMAIL_POOL_MAX_MESSAGES || "100", 10);
  const connectionTimeout = parseInt(EMAIL_CONNECTION_TIMEOUT_MS || "10000", 10);
  const socketTimeout = parseInt(EMAIL_SOCKET_TIMEOUT_MS || "15000", 10);
  const greetingTimeout = parseInt(EMAIL_GREETING_TIMEOUT_MS || "10000", 10);

  // 1) If SMTP_URL is provided, prefer it
  if (SMTP_URL) {
    return nodemailer.createTransport(SMTP_URL, {
      pool,
      maxConnections,
      maxMessages,
      connectionTimeout,
      socketTimeout,
      greetingTimeout,
    });
  }

  // 2) If host is provided, use host/port
  if (EMAIL_HOST) {
    return nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT ? Number(EMAIL_PORT) : 587,
      secure: EMAIL_SECURE ? EMAIL_SECURE.toLowerCase() === "true" : false,
      pool,
      maxConnections,
      maxMessages,
      connectionTimeout,
      socketTimeout,
      greetingTimeout,
      auth: EMAIL_USER && EMAIL_PASS ? { user: EMAIL_USER, pass: EMAIL_PASS } : undefined,
    });
  }

  // 3) Fallback: Gmail SMTP host config (works with App Password)
  // Avoid Nodemailer service shortcuts for more control and fewer surprises
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    pool,
    maxConnections,
    maxMessages,
    connectionTimeout,
    socketTimeout,
    greetingTimeout,
    auth: EMAIL_USER && EMAIL_PASS ? { user: EMAIL_USER, pass: EMAIL_PASS } : undefined,
  });
};

const transporter = buildTransport();

// Optional: verify transport at startup for clearer diagnostics
export const verifyEmailTransport = async () => {
  // Allow disabling verify on platforms where outbound SMTP may be blocked
  if ((process.env.EMAIL_VERIFY_ON_BOOT || "").toLowerCase() === "false") {
    console.log("[Email] Skipping SMTP verify at boot (EMAIL_VERIFY_ON_BOOT=false)");
    return;
  }
  if ((process.env.DISABLE_EMAIL || "").toLowerCase() === "true") {
    console.log("[Email] Email disabled via DISABLE_EMAIL env; skipping verify.");
    return;
  }
  // If no SMTP URL, host, or user is configured, avoid attempting a network verify
  if (!process.env.SMTP_URL && !process.env.EMAIL_HOST && !process.env.EMAIL_USER) {
    console.log("[Email] No SMTP configuration detected; skipping verify.");
    return;
  }
  const maxAttempts = 3;
  let attempt = 0;
  let lastErr;
  while (attempt < maxAttempts) {
    try {
      // verify() opens a connection and checks the server greeting
      await transporter.verify();
      console.log("[Email] SMTP transport ready for", process.env.EMAIL_USER || process.env.EMAIL_HOST || "configured host");
      return;
    } catch (err) {
      lastErr = err;
      attempt += 1;
      const delay = Math.min(2000 * attempt, 8000);
      console.error(`
[Email] SMTP transport verification failed (attempt ${attempt}/${maxAttempts}): ${err?.message || err}
Retrying in ${delay}ms...`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  console.error("[Email] SMTP transport verification failed after retries:", lastErr?.message || lastErr);
};

// Generic send with retry, honoring DISABLE_EMAIL for demo/maintenance
const sendWithRetry = async (mailOptions, label = "email") => {
  if ((process.env.DISABLE_EMAIL || "").toLowerCase() === "true") {
    console.log(`[Email] Email disabled; skipping send (${label}). To:`, mailOptions?.to);
    return { skipped: true };
  }
  const maxAttempts = 3;
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      return await transporter.sendMail(mailOptions);
    } catch (err) {
      attempt += 1;
      const delay = Math.min(1000 * attempt, 5000);
      console.error(`[Email] Failed to send ${label} (attempt ${attempt}/${maxAttempts}): ${err?.message || err}`);
      if (attempt >= maxAttempts) throw err;
      await new Promise((res) => setTimeout(res, delay));
    }
  }
};

export const sendVerificationEmail = async (to, name, verificationLink) => {
  return sendWithRetry({
    from: `"EMB Region III Payroll Management System" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Verify your Email Address",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e6e6e6; padding: 20px; border-radius: 8px;">
        <h2 style="color: #1890ff;">Welcome to EMB Region III Payroll Management System</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>Thank you for registering in the <strong>EMB Region III Payroll Management System</strong>.</p>
        <p>Please confirm your email by clicking the button below:</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${verificationLink}" style="
            padding: 12px 24px;
            background-color: #1890ff;
            color: #ffffff;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            display: inline-block;
          ">Verify My Email</a>
        </div>
        <p style="font-size: 13px; color: #666;">If you didn’t sign up for this account, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #ddd;" />
        <p style="font-size: 12px; color: #999; text-align: center;">© 2025 EMB Region III. All rights reserved.</p>
      </div>
    `,
  }, "verification");
};

export const sendResetPasswordEmail = async (to, name, resetLink) => {
  return sendWithRetry({
    from: `"EMB Region III Payroll Management System" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Password Reset Request",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e6e6e6; padding: 20px; border-radius: 8px;">
        <h2 style="color: #1890ff;">Reset Your Password</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>We received a request to reset your password for your <strong>EMB Region III Payroll Management System</strong> account.</p>
        <p>Click the button below to proceed:</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${resetLink}" style="
            padding: 12px 24px;
            background-color: #1890ff;
            color: #ffffff;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            display: inline-block;
          ">Reset Password</a>
        </div>
        <p style="font-size: 13px; color: #666;">If you didn’t request this password reset, no action is required.</p>
        <hr style="border: none; border-top: 1px solid #ddd;" />
        <p style="font-size: 12px; color: #999; text-align: center;">© 2025 EMB Region III. All rights reserved.</p>
      </div>
    `,
    text: `Hi ${name},\n\nUse the link below to reset your password:\n${resetLink}\n\nIf you didn’t request this, you can ignore this email.`,
  }, "password-reset");
};

export const sendPasswordChangeVerificationEmail = async (to, name, confirmLink, token) => {
  return sendWithRetry({
    from: `"EMB Region III Payroll Management System" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Confirm Your Password Change",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e6e6e6; padding: 20px; border-radius: 8px;">
        <h2 style="color: #1890ff;">Confirm Password Change</h2>
        <p>Hi <strong>${name}</strong>,</p>
  <p>You recently requested to change your password. For security reasons, please confirm this action by clicking the button below, or paste the token into the app:</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${confirmLink}" style="
            padding: 12px 24px;
            background-color: #1890ff;
            color: #ffffff;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            display: inline-block;
          ">Confirm Password Change</a>
        </div>
  <p style="font-size: 13px; color: #666;">Verification token (copy & paste into the app if needed):</p>
  <pre style="background:#f7f7f7;border:1px solid #eee;padding:10px;border-radius:6px;white-space:pre-wrap;word-break:break-all;">${token || ''}</pre>
  <p style="font-size: 13px; color: #666;">If you did not initiate this request, you can safely ignore this email. Your password will remain unchanged.</p>
        <hr style="border: none; border-top: 1px solid #ddd;" />
        <p style="font-size: 12px; color: #999; text-align: center;">© 2025 EMB Region III. All rights reserved.</p>
      </div>
    `,
    text: `Hi ${name},\n\nYou requested a password change. Confirm using this link: ${confirmLink}\nIf you did not request this, ignore this email.`,
  }, "password-change-verify");
};

export const sendNoTimeRecordReminderEmail = async ({ to, name, empId, date, remarks, missing } = {}) => {
  const safeName = name || 'Employee';
  const dateStr = new Date(date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const subject = `Reminder: No Time Record on ${dateStr}`;
  const preheader = `Our records show no time entry for ${dateStr}.`;
  const bodyRemarks = remarks ? `<p style="margin-top:10px;white-space:pre-wrap">${remarks}</p>` : '';
  const missingHtml = (Array.isArray(missing) && missing.length)
    ? `<p style="margin-top:8px"><strong>Missing entries:</strong> ${missing.join(', ')}</p>`
    : '';
  return sendWithRetry({
    from: `"EMB Region III - HRPMS" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;border:1px solid #e6e6e6;border-radius:8px;overflow:hidden">
        <div style="background:#1890ff;color:#fff;padding:16px 20px">
          <h2 style="margin:0;font-weight:600;font-size:18px">EMB Region III • HRPMS</h2>
          <div style="opacity:0.9;font-size:12px">${preheader}</div>
        </div>
        <div style="padding:20px">
          <p>Good day <strong>${safeName}</strong>${empId ? ` (ID: <strong>${empId}</strong>)` : ''},</p>
          <p>We noticed that there is <strong>no recorded time entry</strong> for <strong>${dateStr}</strong> in the Daily Time Record system.</p>
          ${missingHtml}
          <p>If you reported for duty on that date, please coordinate with HR or your immediate supervisor to update your record accordingly.</p>
          ${bodyRemarks}
          <p style="margin-top:16px">Thank you,<br/>HR Unit, EMB Region III</p>
        </div>
        <div style="background:#fafafa;border-top:1px solid #eee;color:#888;padding:12px 20px;font-size:12px;text-align:center">
          This is an automated reminder from the EMB Region III HRPMS.
        </div>
      </div>
    `,
    text: `Good day ${safeName}${empId ? ` (ID: ${empId})` : ''},\n\nWe noticed that there is no recorded time entry for ${dateStr} in the DTR system.\n${Array.isArray(missing) && missing.length ? `Missing entries: ${missing.join(', ')}\\n\\n` : ''}If you reported for duty on that date, please coordinate with HR or your immediate supervisor to update your record.\n\n${remarks || ''}\n\nThank you,\nHR Unit, EMB Region III`,
  }, "no-time-record-single");
};

export const sendNoTimeRecordBulkEmail = async ({ to, name, empId, dates = [], periodLabel, remarks } = {}) => {
  const safeName = name || 'Employee';
  const subject = `Reminder: No Time Records${periodLabel ? ` for ${periodLabel}` : ''}`;
  const listItems = (dates || []).map(d => {
    // support both simple date strings and objects {date, missing}
    const dateVal = (d && typeof d === 'object' && d.date) ? d.date : d;
    const missing = (d && typeof d === 'object' && Array.isArray(d.missing)) ? d.missing : [];
    const ds = new Date(dateVal).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
    return `<li>${ds}${missing.length ? ` <div style="font-size:12px;color:#666;margin-top:4px">Missing: ${missing.join(', ')}</div>` : ''}</li>`;
  }).join('');
  const bodyRemarks = remarks ? `<p style="margin-top:10px;white-space:pre-wrap">${remarks}</p>` : '';
  return sendWithRetry({
    from: `"EMB Region III - HRPMS" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;border:1px solid #e6e6e6;border-radius:8px;overflow:hidden">
        <div style="background:#1890ff;color:#fff;padding:16px 20px">
          <h2 style="margin:0;font-weight:600;font-size:18px">EMB Region III • HRPMS</h2>
          <div style="opacity:0.9;font-size:12px">Our records show no time entries on the following dates${periodLabel ? ` for ${periodLabel}` : ''}.</div>
        </div>
        <div style="padding:20px">
          <p>Good day <strong>${safeName}</strong>${empId ? ` (ID: <strong>${empId}</strong>)` : ''},</p>
          <p>Please review the dates below where no time record was found (missing entries shown):</p>
          <ul style="margin:10px 0 0 18px; padding:0;">${listItems}</ul>
          <p style="margin-top:12px">If you reported for duty on any of these dates, kindly coordinate with HR or your immediate supervisor to update your record.</p>
          ${bodyRemarks}
          <p style="margin-top:16px">Thank you,<br/>HR Unit, EMB Region III</p>
        </div>
        <div style="background:#fafafa;border-top:1px solid #eee;color:#888;padding:12px 20px;font-size:12px;text-align:center">
          This is an automated reminder from the EMB Region III HRPMS.
        </div>
      </div>
    `,
    text: `Good day ${safeName}${empId ? ` (ID: ${empId})` : ''},\n\nOur records show no time entries on the following dates${periodLabel ? ` for ${periodLabel}` : ''}:\n${(dates||[]).map(d => {
    const dateVal = (d && typeof d === 'object' && d.date) ? d.date : d;
    const missing = (d && typeof d === 'object' && Array.isArray(d.missing)) ? d.missing : [];
    return `- ${new Date(dateVal).toLocaleDateString('en-PH')}${missing.length ? ` (Missing: ${missing.join(', ')})` : ''}`;
  }).join('\n')}\n\nIf you reported for duty on any of these dates, please coordinate with HR or your immediate supervisor to update your record.\n\n${remarks || ''}\n\nThank you,\nHR Unit, EMB Region III`,
  }, "no-time-record-bulk");
};

// Generic bug report email sender
export const sendBugReportEmail = async ({ to, from, subject, message, meta = {}, screenshotBase64 }) => {
  const lines = [];
  if (message) lines.push(`<p style="white-space:pre-wrap">${(message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`);
  const metaList = Object.entries(meta)
    .filter(([k,v]) => v != null && v !== "")
    .map(([k, v]) => `<li><strong>${k}:</strong> ${(String(v)).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</li>`)
    .join("");
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;border:1px solid #e6e6e6;border-radius:8px;overflow:hidden">
      <div style="background:#f5222d;color:#fff;padding:14px 18px">
        <h3 style="margin:0">Bug Report</h3>
        <div style="opacity:0.9;font-size:12px">Submitted via HRPMS</div>
      </div>
      <div style="padding:18px">
        <h4 style="margin:0 0 8px">${(subject || 'Bug Report')}</h4>
        ${lines.join('')}
        ${metaList ? `<ul style="margin-top:12px;padding-left:18px">${metaList}</ul>` : ''}
      </div>
      <div style="background:#fafafa;border-top:1px solid #eee;color:#888;padding:10px 16px;font-size:12px;text-align:center">
        Automated email from EMBR3 HRPMS
      </div>
    </div>`;

  const attachments = [];
  if (screenshotBase64 && typeof screenshotBase64 === 'string' && screenshotBase64.includes(',')) {
    try {
      const [metaPrefix, dataPart] = screenshotBase64.split(',');
      const mime = (metaPrefix.match(/data:(.*);base64/) || [])[1] || 'image/png';
      attachments.push({ filename: `screenshot.${mime.split('/')[1] || 'png'}`, content: dataPart, encoding: 'base64', contentType: mime });
    } catch (_) { /* ignore bad image */ }
  }

  return sendWithRetry({
    from: `EMBR3 HRPMS <${process.env.EMAIL_USER}>`,
    to,
    replyTo: from || undefined,
    subject: subject || 'Bug Report',
    html,
    attachments,
  }, "bug-report");
};

// ─── Announcement & App-Update email templates ────────────────────────────────

const announcementHtml = ({ title, body, type, priority }) => {
  const isUpdate = type === 'app-update';
  const isMaintenance = type === 'maintenance';
  const headerBg = isMaintenance ? '#fa8c16' : isUpdate ? '#52c41a' : '#1890ff';
  const headerLabel = isMaintenance ? 'Maintenance Notice' : isUpdate ? 'App Update' : 'Announcement';
  const priorityBadge = priority === 'critical'
    ? '<span style="display:inline-block;background:#ff4d4f;color:#fff;font-size:11px;padding:2px 8px;border-radius:4px;margin-left:8px;vertical-align:middle;">CRITICAL</span>'
    : priority === 'high'
    ? '<span style="display:inline-block;background:#fa8c16;color:#fff;font-size:11px;padding:2px 8px;border-radius:4px;margin-left:8px;vertical-align:middle;">HIGH</span>'
    : '';
  const safeTitle = String(title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeBody = String(body || '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;border:1px solid #e6e6e6;border-radius:8px;overflow:hidden">
      <div style="background:${headerBg};color:#fff;padding:16px 20px">
        <h2 style="margin:0;font-weight:600;font-size:18px">EMB Region III &bull; HRPMS</h2>
        <div style="opacity:0.9;font-size:12px;margin-top:2px">${headerLabel}</div>
      </div>
      <div style="padding:20px">
        <h3 style="margin:0 0 12px">${safeTitle}${priorityBadge}</h3>
        <div style="line-height:1.6;color:#333">${safeBody}</div>
      </div>
      <div style="background:#fafafa;border-top:1px solid #eee;color:#888;padding:12px 20px;font-size:12px;text-align:center">
        &copy; ${new Date().getFullYear()} EMB Region III &mdash; Human Resource Payroll Management System
      </div>
    </div>`;
};

export const sendAnnouncementEmail = async ({ to, title, body, type, priority }) => {
  return sendWithRetry({
    from: `"EMB Region III - HRPMS" <${process.env.EMAIL_USER}>`,
    to,
    subject: `[Announcement] ${title}`,
    html: announcementHtml({ title, body, type, priority }),
    text: `${title}\n\n${body}`,
  }, "announcement");
};

export const sendAppUpdateEmail = async ({ to, title, body, type, priority }) => {
  return sendWithRetry({
    from: `"EMB Region III - HRPMS" <${process.env.EMAIL_USER}>`,
    to,
    subject: `[App Update] ${title}`,
    html: announcementHtml({ title, body, type: type || 'app-update', priority }),
    text: `${title}\n\n${body}`,
  }, "app-update");
};

/**
 * Send a payslip email with PDF attachment through the shared transport.
 * @param {{ to: string, subject: string, html: string, pdfBuffer: Buffer, filename: string }} opts
 * @returns {Promise<object>} nodemailer info or { skipped: true }
 */
export const sendPayslipDeliveryEmail = async ({ to, subject, html, pdfBuffer, filename }) => {
  const fromName = process.env.EMAIL_FROM_NAME || "EMBR3 DTRMS Personnel";
  const fromAddress = process.env.EMAIL_USER || "no-reply@example.local";
  return sendWithRetry({
    from: `${fromName} <${fromAddress}>`,
    to,
    subject,
    html,
    attachments: [
      {
        filename,
        content: pdfBuffer,
        contentType: "application/pdf",
        contentDisposition: "attachment",
      },
    ],
  }, "payslip-delivery");
};

// ── Signup Approval / Rejection Emails ──────────────────────────────────────

export const sendSignupApprovedEmail = async (to, name, loginLink) => {
  return sendWithRetry({
    from: `"EMB Region III Payroll Management System" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Your Account Has Been Approved",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e6e6e6; padding: 20px; border-radius: 8px;">
        <h2 style="color: #52c41a;">Account Approved!</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>Your account registration for the <strong>EMB Region III Payroll Management System</strong> has been <strong style="color:#52c41a;">approved</strong> by an administrator.</p>
        <p>You can now log in and start using the system:</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${loginLink}" style="
            padding: 12px 24px;
            background-color: #52c41a;
            color: #ffffff;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            display: inline-block;
          ">Log In Now</a>
        </div>
        <p style="font-size: 13px; color: #666;">Your access permissions will be configured by your system administrator.</p>
        <hr style="border: none; border-top: 1px solid #ddd;" />
        <p style="font-size: 12px; color: #999; text-align: center;">© 2025 EMB Region III. All rights reserved.</p>
      </div>
    `,
    text: `Hi ${name},\n\nYour account has been approved! You can now log in at: ${loginLink}`,
  }, "signup-approval");
};

export const sendSignupRejectedEmail = async (to, name, reason) => {
  return sendWithRetry({
    from: `"EMB Region III Payroll Management System" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Account Registration Update",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e6e6e6; padding: 20px; border-radius: 8px;">
        <h2 style="color: #ff4d4f;">Registration Not Approved</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>We regret to inform you that your account registration for the <strong>EMB Region III Payroll Management System</strong> has not been approved at this time.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
        <p>If you believe this was a mistake, please contact your system administrator for assistance.</p>
        <hr style="border: none; border-top: 1px solid #ddd;" />
        <p style="font-size: 12px; color: #999; text-align: center;">© 2025 EMB Region III. All rights reserved.</p>
      </div>
    `,
    text: `Hi ${name},\n\nYour account registration has not been approved.${reason ? ` Reason: ${reason}` : ""}\n\nPlease contact your administrator if you have questions.`,
  }, "signup-rejection");
};

export const sendNewSignupNotificationEmail = async (to, newUserName, newUserEmail, dashboardLink) => {
  return sendWithRetry({
    from: `"EMB Region III Payroll Management System" <${process.env.EMAIL_USER}>`,
    to,
    subject: `New Account Signup: ${newUserName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e6e6e6; padding: 20px; border-radius: 8px;">
        <h2 style="color: #1890ff;">New Account Pending Approval</h2>
        <p>A new user has registered and is awaiting your approval:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
          <tr><td style="padding: 6px 8px; font-weight: bold; width: 100px;">Name:</td><td style="padding: 6px 8px;">${newUserName}</td></tr>
          <tr><td style="padding: 6px 8px; font-weight: bold;">Email:</td><td style="padding: 6px 8px;">${newUserEmail}</td></tr>
        </table>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${dashboardLink}" style="
            padding: 12px 24px;
            background-color: #1890ff;
            color: #ffffff;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            display: inline-block;
          ">Review in Dashboard</a>
        </div>
        <hr style="border: none; border-top: 1px solid #ddd;" />
        <p style="font-size: 12px; color: #999; text-align: center;">© 2025 EMB Region III. All rights reserved.</p>
      </div>
    `,
  }, "new-signup-notification");
};


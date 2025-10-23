import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Optional: verify transport at startup for clearer diagnostics
export const verifyEmailTransport = async () => {
  try {
    await transporter.verify();
    console.log("[Email] SMTP transport ready for", process.env.EMAIL_USER);
  } catch (err) {
    console.error("[Email] SMTP transport verification failed:", err?.message || err);
  }
};

export const sendVerificationEmail = async (to, name, verificationLink) => {
  return transporter.sendMail({
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
  });
};

export const sendResetPasswordEmail = async (to, name, resetLink) => {
  return transporter.sendMail({
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
  });
};

export const sendNoTimeRecordReminderEmail = async ({ to, name, empId, date, remarks }) => {
  const safeName = name || 'Employee';
  const dateStr = new Date(date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const subject = `Reminder: No Time Record on ${dateStr}`;
  const preheader = `Our records show no time entry for ${dateStr}.`;
  const bodyRemarks = remarks ? `<p style="margin-top:10px;white-space:pre-wrap">${remarks}</p>` : '';
  return transporter.sendMail({
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
          <p>If you reported for duty on that date, please coordinate with HR or your immediate supervisor to update your record accordingly.</p>
          ${bodyRemarks}
          <p style="margin-top:16px">Thank you,<br/>HR Unit, EMB Region III</p>
        </div>
        <div style="background:#fafafa;border-top:1px solid #eee;color:#888;padding:12px 20px;font-size:12px;text-align:center">
          This is an automated reminder from the EMB Region III HRPMS.
        </div>
      </div>
    `,
    text: `Good day ${safeName}${empId ? ` (ID: ${empId})` : ''},\n\nWe noticed that there is no recorded time entry for ${dateStr} in the DTR system. If you reported for duty on that date, please coordinate with HR or your immediate supervisor to update your record.\n\n${remarks || ''}\n\nThank you,\nHR Unit, EMB Region III`,
  });
};

export const sendNoTimeRecordBulkEmail = async ({ to, name, empId, dates = [], periodLabel, remarks }) => {
  const safeName = name || 'Employee';
  const subject = `Reminder: No Time Records${periodLabel ? ` for ${periodLabel}` : ''}`;
  const listItems = (dates || []).map(d => {
    const ds = new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
    return `<li>${ds}</li>`;
  }).join('');
  const bodyRemarks = remarks ? `<p style="margin-top:10px;white-space:pre-wrap">${remarks}</p>` : '';
  return transporter.sendMail({
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
          <p>Please review the dates below where no time record was found:</p>
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
    text: `Good day ${safeName}${empId ? ` (ID: ${empId})` : ''},\n\nOur records show no time entries on the following dates${periodLabel ? ` for ${periodLabel}` : ''}:\n- ${(dates||[]).map(d => new Date(d).toLocaleDateString('en-PH')).join('\n- ')}\n\nIf you reported for duty on any of these dates, please coordinate with HR or your immediate supervisor to update your record.\n\n${remarks || ''}\n\nThank you,\nHR Unit, EMB Region III`,
  });
};

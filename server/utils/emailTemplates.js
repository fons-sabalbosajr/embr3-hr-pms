// Utility for building consistent HTML email templates for payslip delivery
// Provides a single entry point so controller logic stays lean.

export function buildPayslipEmail({ period, employee, customBody }) {
  // If caller passed a fully custom body, wrap minimally and return.
  if (customBody) {
    return `<!DOCTYPE html><html><body>${customBody}</body></html>`;
  }

  const name = employee?.name || 'Employee';
  const position = employee?.position || '';
  const designationLine = position ? `<p style="margin:4px 0 12px 0;font-size:13px;color:#555;"><strong>${escapeHtml(position)}</strong></p>` : '';

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Payslip ${escapeHtml(period || '')}</title>
  </head>
  <body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333;line-height:1.5;">
    <div style="max-width:560px;margin:0 auto;padding:8px 4px;">
      <h2 style="color:#004B80;margin:0 0 12px 0;font-size:18px;font-weight:600;">Your Payslip (${escapeHtml(period || '')})</h2>
      <p style="margin:0 0 8px 0;">Dear ${escapeHtml(name)},</p>
      ${designationLine}
      <p style="margin:0 0 10px 0;">Attached is your payslip for the period <strong>${escapeHtml(period || '')}</strong>.</p>
      <p style="margin:0 0 10px 0;">If you have any questions or concerns, you may reply directly to this email.</p>
      <p style="margin:18px 0 4px 0;">Regards,<br/><span style="color:#004B80;font-weight:600;">HR Personnel</span></p>
      <hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0" />
      <p style="font-size:11px;color:#888;margin:0 0 4px 0;">This is an automated message. Please do not share this document publicly.</p>
      <p style="font-size:11px;color:#888;margin:0;">Confidential &mdash; For intended recipient only.</p>
    </div>
  </body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

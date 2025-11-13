// Utility for building consistent HTML email templates for payslip delivery
// Corporate-styled wrapper with header, content card, and footer.

export function buildPayslipEmail({ period, employee, customMessage, logoUrl, logoCid }) {
  const name = employee?.name || 'Employee';
  const position = employee?.position || '';
  const designationLine = position ? `<div style="margin-top:4px;color:#5f6b7a;font-size:13px;">${escapeHtml(position)}</div>` : '';

  const brandPrimary = '#1890ff';
  const brandDark = '#1677d9';
  const borderColor = '#E6ECF1';
  const textColor = '#1F2937';
  const muted = '#6B7280';

  const normalizedMessage = normalizeCustomMessage(customMessage);

  const defaultMessage = `
    <p style="margin:0 0 12px 0;">Dear ${escapeHtml(name)},</p>
    ${designationLine}
    <p style="margin:0 0 12px 0;">Attached is your payslip for the period <strong>${escapeHtml(period || '')}</strong>.</p>
    <p style="margin:0 0 12px 0;">If you have questions or concerns, you may reply to this email.</p>
    <p style="margin:16px 0 0 0;">Regards,<br/>HR Personnel</p>
  `;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Payslip ${escapeHtml(period || '')}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f8fb;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f8fb;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${borderColor};border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:${brandPrimary};padding:14px 20px;color:#ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <div style="display:flex;align-items:center;gap:10px;">
                        <div style="font-size:18px;font-weight:700;letter-spacing:.2px;">EMB Region III • DTRMS</div>
                      </div>
                      <div style="font-size:12px;opacity:.9;margin-top:2px;">Payslip ${escapeHtml(period || '')}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px;color:${textColor};">
                ${normalizedMessage || defaultMessage}
                <div style="margin-top:16px;padding:12px 14px;background:#F1F5FF;border:1px solid #D9E3FF;border-radius:6px;color:#334155;font-size:13px;">
                  Important: This payslip is for reference only and is NOT valid without a wet signature. Please proceed to the Head of Personnel Unit to obtain the required wet signature.
                </div>
                <div style="margin-top:18px;padding-top:12px;border-top:1px dashed ${borderColor};color:${muted};font-size:12px;">
                  The PDF payslip is attached to this email.
                </div>
              </td>
            </tr>
            <tr>
              <td style="background:#fafbfc;border-top:1px solid ${borderColor};padding:14px 20px;color:${muted};font-size:12px;">
                <div>Confidential &mdash; For intended recipient only.</div>
                <div style="margin-top:4px;">&copy; ${new Date().getFullYear()} HR Department</div>
              </td>
            </tr>
          </table>
          <div style="font-size:12px;color:${muted};margin-top:10px;">Having trouble viewing this email? Try a different email client.</div>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
}

function normalizeCustomMessage(input) {
  if (!input) return '';
  try {
    const str = String(input);
    // If full HTML provided, try to extract body content; fallback to raw
    const bodyMatch = str.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const inner = bodyMatch ? bodyMatch[1] : str;
    // Basic safeguard: strip outer html/head tags if present
    return inner.replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<\/?html[^>]*>/gi, '').replace(/<\/?head[^>]*>[\s\S]*?<\/?head>/gi, '');
  } catch (_) {
    return String(input);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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

/**
 * Build corporate HTML email for request acknowledgment (DTR or Payslip).
 * Sent immediately after a public portal submission.
 */
export function buildRequestAcknowledgmentEmail({ requestType = 'DTR', employeeId, period, startDate, endDate, recipientEmail }) {
  const brandPrimary = '#1890ff';
  const borderColor = '#E6ECF1';
  const textColor = '#1F2937';
  const muted = '#6B7280';
  const year = new Date().getFullYear();

  const typeLabel = requestType === 'Payslip' ? 'Payslip' : 'DTR';
  const periodDisplay = requestType === 'Payslip'
    ? (period || '')
    : (startDate && endDate
      ? `${new Date(startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} – ${new Date(endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
      : '');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${typeLabel} Request Received</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f8fb;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f8fb;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${borderColor};border-radius:8px;overflow:hidden;">
            <!-- Header -->
            <tr>
              <td style="background:${brandPrimary};padding:14px 20px;color:#ffffff;">
                <div style="font-size:18px;font-weight:700;letter-spacing:.2px;">EMB Region III &bull; DTRMS</div>
                <div style="font-size:12px;opacity:.9;margin-top:2px;">${typeLabel} Request Acknowledgment</div>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:24px 20px;color:${textColor};">
                <p style="margin:0 0 14px 0;font-size:15px;">Your <strong>${typeLabel} request</strong> has been received and is now being processed by the HR Personnel Unit.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 16px 0;">
                  <tr>
                    <td style="padding:8px 12px;background:#F8FAFC;border:1px solid ${borderColor};border-radius:6px;">
                      <table role="presentation" cellspacing="0" cellpadding="4" border="0" style="width:100%;font-size:13px;color:${textColor};">
                        <tr><td style="font-weight:600;width:120px;color:${muted};">Employee ID</td><td>${escapeHtml(employeeId || '')}</td></tr>
                        <tr><td style="font-weight:600;color:${muted};">Request Type</td><td>${typeLabel}</td></tr>
                        ${periodDisplay ? `<tr><td style="font-weight:600;color:${muted};">Period</td><td>${escapeHtml(periodDisplay)}</td></tr>` : ''}
                        <tr><td style="font-weight:600;color:${muted};">Status</td><td><span style="display:inline-block;padding:2px 10px;background:#FFF7E6;color:#D48806;border-radius:4px;font-size:12px;font-weight:600;">Pending</span></td></tr>
                      </table>
                    </td>
                  </tr>
                </table>
                <div style="margin:16px 0;padding:12px 14px;background:#F1F5FF;border:1px solid #D9E3FF;border-radius:6px;color:#334155;font-size:13px;">
                  <strong>What happens next?</strong>
                  <ol style="margin:8px 0 0 0;padding-left:18px;line-height:1.8;">
                    <li>HR will review and verify your request.</li>
                    <li>Your ${typeLabel.toLowerCase()} will be sent to this email address once processed.</li>
                    <li>Please allow <strong>1–3 working days</strong> for processing.</li>
                  </ol>
                </div>
                <div style="margin-top:14px;padding:10px 14px;background:#FFF2F0;border:1px solid #FFCCC7;border-radius:6px;color:#CF1322;font-size:12px;">
                  <strong>Security Notice:</strong> This is an automated message. Do not reply to this email. If you did not submit this request, please contact the HR office immediately.
                </div>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background:#fafbfc;border-top:1px solid ${borderColor};padding:14px 20px;color:${muted};font-size:12px;">
                <div>This is a system-generated email. Please do not reply.</div>
                <div style="margin-top:4px;">&copy; ${year} EMB Region III &mdash; Environmental Management Bureau</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Build corporate HTML email for DTR delivery with PDF attachment.
 */
export function buildDTREmail({ startDate, endDate, employee, customMessage }) {
  const name = employee?.name || 'Employee';
  const position = employee?.position || '';
  const designationLine = position ? `<div style="margin-top:4px;color:#5f6b7a;font-size:13px;">${escapeHtml(position)}</div>` : '';

  const brandPrimary = '#1890ff';
  const borderColor = '#E6ECF1';
  const textColor = '#1F2937';
  const muted = '#6B7280';
  const year = new Date().getFullYear();

  const periodDisplay = startDate && endDate
    ? `${new Date(startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} – ${new Date(endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
    : '';

  const normalizedMessage = normalizeCustomMessage(customMessage);

  const defaultMessage = `
    <p style="margin:0 0 12px 0;">Dear ${escapeHtml(name)},</p>
    ${designationLine}
    <p style="margin:0 0 12px 0;">Attached is your Daily Time Record (DTR) for the period <strong>${escapeHtml(periodDisplay)}</strong>.</p>
    <p style="margin:0 0 12px 0;">If you have questions or concerns, you may contact the HR Personnel Unit directly.</p>
    <p style="margin:16px 0 0 0;">Regards,<br/>HR Personnel Unit</p>
  `;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>DTR ${escapeHtml(periodDisplay)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f8fb;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f8fb;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${borderColor};border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:${brandPrimary};padding:14px 20px;color:#ffffff;">
                <div style="font-size:18px;font-weight:700;letter-spacing:.2px;">EMB Region III &bull; DTRMS</div>
                <div style="font-size:12px;opacity:.9;margin-top:2px;">Daily Time Record</div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px;color:${textColor};">
                ${normalizedMessage || defaultMessage}
                <div style="margin-top:16px;padding:12px 14px;background:#F1F5FF;border:1px solid #D9E3FF;border-radius:6px;color:#334155;font-size:13px;">
                  Important: This DTR is for reference only and is NOT valid without proper authorization and signature from the Head of Office.
                </div>
                <div style="margin-top:18px;padding-top:12px;border-top:1px dashed ${borderColor};color:${muted};font-size:12px;">
                  The PDF copy of your DTR is attached to this email.
                </div>
              </td>
            </tr>
            <tr>
              <td style="background:#fafbfc;border-top:1px solid ${borderColor};padding:14px 20px;color:${muted};font-size:12px;">
                <div>Confidential &mdash; For intended recipient only.</div>
                <div style="margin-top:4px;">&copy; ${year} EMB Region III &mdash; Environmental Management Bureau</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
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

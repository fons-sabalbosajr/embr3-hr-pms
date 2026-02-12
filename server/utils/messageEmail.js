import dotenv from "dotenv";
dotenv.config();

// Re-use the existing transporter from the main email utility.
// We dynamically import to avoid circular-dependency issues.
let _sendWithRetry;

const getSender = async () => {
  if (!_sendWithRetry) {
    const emailMod = await import("./email.js");
    // sendWithRetry is not exported directly; build our own using transporter
    // Instead, we just use the same nodemailer setup pattern.
    const nodemailer = (await import("nodemailer")).default;

    const {
      SMTP_URL,
      EMAIL_HOST,
      EMAIL_USER,
      EMAIL_PASS,
      EMAIL_PORT,
      EMAIL_SECURE,
    } = process.env;

    let transport;
    if (SMTP_URL) {
      transport = nodemailer.createTransport(SMTP_URL);
    } else if (EMAIL_HOST) {
      transport = nodemailer.createTransport({
        host: EMAIL_HOST,
        port: EMAIL_PORT ? Number(EMAIL_PORT) : 587,
        secure: EMAIL_SECURE ? EMAIL_SECURE.toLowerCase() === "true" : false,
        auth:
          EMAIL_USER && EMAIL_PASS
            ? { user: EMAIL_USER, pass: EMAIL_PASS }
            : undefined,
      });
    } else {
      transport = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth:
          EMAIL_USER && EMAIL_PASS
            ? { user: EMAIL_USER, pass: EMAIL_PASS }
            : undefined,
      });
    }

    _sendWithRetry = async (mailOptions) => {
      if ((process.env.DISABLE_EMAIL || "").toLowerCase() === "true") {
        console.log(
          "[MessageEmail] Email disabled; skipping send. To:",
          mailOptions?.to
        );
        return { skipped: true };
      }
      return transport.sendMail(mailOptions);
    };
  }
  return _sendWithRetry;
};

/**
 * Send an email notification when a user receives a new message while offline.
 */
export const sendMessageNotificationEmail = async ({
  to,
  recipientName,
  senderName,
  preview,
  conversationId,
}) => {
  const send = await getSender();

  const appUrl =
    process.env.CLIENT_ORIGIN ||
    process.env.FRONTEND_URL ||
    "https://embr3-hr-pms.onrender.com";
  const firstOrigin = appUrl.split(",")[0].trim().replace(/\/$/, "");
  const deepLink = `${firstOrigin}/messaging?cid=${conversationId}`;

  return send({
    from: `"EMB Region III HR Messaging" <${process.env.EMAIL_USER}>`,
    to,
    subject: `New message from ${senderName}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: auto; border: 1px solid #e6e6e6; border-radius: 10px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #1677ff 0%, #0958d9 100%); padding: 24px 28px;">
          <h2 style="color: #fff; margin: 0; font-size: 18px;">New Message</h2>
        </div>
        <div style="padding: 28px;">
          <p style="margin: 0 0 8px; color: #333;">Hi <strong>${recipientName}</strong>,</p>
          <p style="margin: 0 0 20px; color: #555;">You received a new message from <strong>${senderName}</strong>:</p>
          <div style="background: #f5f7fa; border-left: 4px solid #1677ff; padding: 14px 18px; border-radius: 6px; margin-bottom: 24px;">
            <p style="margin: 0; color: #333; font-style: italic;">"${preview}${preview.length >= 120 ? "…" : ""}"</p>
          </div>
          <div style="text-align: center;">
            <a href="${deepLink}" style="
              display: inline-block;
              padding: 12px 32px;
              background: #1677ff;
              color: #fff;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              font-size: 14px;
            ">Open Conversation</a>
          </div>
        </div>
        <div style="padding: 14px 28px; background: #fafafa; border-top: 1px solid #eee; text-align: center;">
          <p style="margin: 0; font-size: 11px; color: #aaa;">© ${new Date().getFullYear()} EMB Region III HR PMS</p>
        </div>
      </div>
    `,
    text: `Hi ${recipientName},\n\nYou received a new message from ${senderName}:\n"${preview}"\n\nOpen: ${deepLink}`,
  });
};

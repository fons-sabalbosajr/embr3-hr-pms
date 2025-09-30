// routes/features.js
import express from "express";
import nodemailer from "nodemailer";

const router = express.Router();

router.post("/suggest", async (req, res) => {
  try {
    const { title, description, emailTo, submittedBy } = req.body;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // your Gmail address
        pass: process.env.EMAIL_PASS, // app password
      },
    });

    await transporter.sendMail({
      from: `"EMBR3 System" <${process.env.EMAIL_USER}>`,
      to: emailTo,
      subject: `Feature Suggestion: ${title}`,
      text: `Submitted by: ${submittedBy}\n\n${description}`,
    });

    res.status(200).json({ success: true, message: "Email sent successfully." });
  } catch (error) {
    console.error("Email send error:", error);
    res.status(500).json({ success: false, error: "Failed to send email." });
  }
});

export default router;

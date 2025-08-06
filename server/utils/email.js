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
  });
};

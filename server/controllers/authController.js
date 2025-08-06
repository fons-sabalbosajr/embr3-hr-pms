import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import {
  sendVerificationEmail,
  sendResetPasswordEmail,
} from "../utils/email.js";

const CLIENT_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Signup Controller
export const signup = async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) {
      return res
        .status(400)
        .json({ message: "Username or email already in use." });
    }

    const hashed = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(32).toString("hex");

    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hrs

    const user = await User.create({
      name,
      username,
      email,
      password: hashed,
      verificationToken: token,
      verificationTokenExpires: tokenExpiry,
    });

    //console.log("[Signup] User created with verification token:", token);

    const verificationLink = `${CLIENT_URL}/verify/${token}`;
    await sendVerificationEmail(email, name, verificationLink);

    return res.status(201).json({
      message: "Signup successful. A verification email has been sent.",
    });
  } catch (err) {
    console.error("[Signup Error]", err);
    res.status(500).json({ message: "Signup failed", error: err.message });
  }
};

// Email Verification Controller
export const verifyEmail = async (req, res) => {
  const { token } = req.params;
  //console.log("[Verification] Token received:", token);

  try {
    let user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      // Try finding user who may have already verified
      user = await User.findOne({ isVerified: true });
      if (user) {
        //console.log("[Verification] Token already used. User is already verified:", user.email);
        return res.status(200).json({
          message: "Email already verified.",
        });
      }

      //console.warn("[Verification] No user found with token:", token);
      return res
        .status(400)
        .json({ message: "Invalid or expired verification link." });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    //console.log("[Verification] Email verified for:", user.email);

    return res.status(200).json({
      message: "Email verified successfully!",
    });
  } catch (error) {
    console.error("[Verification Error]", error);
    return res
      .status(500)
      .json({ message: "Verification failed.", error: error.message });
  }
};

// Login Controller
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ message: "Invalid password" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: "Email not verified" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
};

// Resend Verification Controller
export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    const newToken = crypto.randomBytes(32).toString("hex");
    user.verificationToken = newToken;
    await user.save();

    const verificationLink = `${CLIENT_URL}/verify/${newToken}`;
    await sendVerificationEmail(user.email, user.name, verificationLink);

    res.json({ message: "Verification email resent" });
  } catch (err) {
    res.status(500).json({ message: "Resend failed", error: err.message });
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const trimmedEmail = email?.trim();
    const user = await User.findOne({ email: trimmedEmail });

    if (!user) return res.status(404).json({ message: "User not found." });

    const token = crypto.randomBytes(32).toString("hex");
    const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes

    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
    await user.save();

    //console.log("[ForgotPassword] Token Saved:", user.resetPasswordToken);

    const savedUser = await User.findOne({ email });
    //console.log("[DB Check] Saved Token:", savedUser.resetPasswordToken);
    //console.log("[DB Check] Expiry Time:", savedUser.resetPasswordExpires);

    const resetLink = `${
      process.env.VITE_FRONTEND_URL || process.env.FRONTEND_URL
    }/reset-password/${token}`;
    //console.log(`[ForgotPassword] Reset link for ${user.email}: ${resetLink}`);

    await sendResetPasswordEmail(user.email, user.name, resetLink);

    res.status(200).json({ message: "Reset link sent to email." });
  } catch (err) {
    console.error("[ForgotPassword Error]", err);
    res.status(500).json({ message: "Failed to send reset link." });
  }
};

export const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    //console.log(`[ResetPassword] Received token: ${token}`);

    const user = await User.findOne({
      resetPasswordToken: { $eq: token },
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      console.warn(`[ResetPassword] Invalid or expired token: ${token}`);
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token." });
    }

    const hashed = await bcrypt.hash(password, 10);
    user.password = hashed;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    //console.log(`[ResetPassword] Password reset successful for ${user.email}`);
    res.status(200).json({ message: "Password reset successful." });
  } catch (err) {
    console.error("[ResetPassword Error]", err);
    res.status(500).json({ message: "Failed to reset password." });
  }
};

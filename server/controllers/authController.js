import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { getSocketInstance } from "../socket.js";
import {
  sendVerificationEmail,
  sendResetPasswordEmail,
  sendPasswordChangeVerificationEmail,
  sendSignupApprovedEmail,
  sendSignupRejectedEmail,
  sendNewSignupNotificationEmail,
} from "../utils/email.js";
import { uploadToDrive } from "../utils/googleDrive.js";
import { validatePassword } from "../utils/validatePassword.js";
import Settings from "../models/Settings.js";
import fs from 'fs';
import path from 'path';
// Optional image processor; dynamically imported when needed
// If unavailable, code falls back to saving original image bytes.

// Build the client base URL for links in emails
const rawOrigin =
  process.env.CLIENT_ORIGIN ||
  process.env.FRONTEND_URL ||
  "http://localhost:5175";
const rawBasePath = process.env.CLIENT_BASE_PATH || ""; // e.g. "/hrpms"
const normalizedBasePath = rawBasePath
  ? rawBasePath.startsWith("/")
    ? rawBasePath
    : `/${rawBasePath}`
  : "";
const CLIENT_URL = `${rawOrigin.replace(/\/$/, "")}${normalizedBasePath}`;

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

    // Enforce password policy from security settings
    const pwCheck = await validatePassword(password);
    if (!pwCheck.valid) {
      return res.status(400).json({ message: pwCheck.errors.join(" ") });
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

    const verificationLink = `${CLIENT_URL}/verify/${token}`;
    await sendVerificationEmail(email, name, verificationLink);

    // Notify all developers and admins about the new pending signup
    try {
      const admins = await User.find({
        $or: [
          { userType: "developer" },
          { isAdmin: true },
          { canManageUsers: true },
        ],
        isVerified: true,
      }).select("email name").lean();
      const dashboardLink = `${CLIENT_URL}/settings/access`;
      const emailPromises = admins.map((a) =>
        sendNewSignupNotificationEmail(a.email, name, email, dashboardLink).catch((e) =>
          console.warn(`[Signup Notify] Failed to notify ${a.email}:`, e.message)
        )
      );
      await Promise.allSettled(emailPromises);
    } catch (notifyErr) {
      console.warn("[Signup Notify] Could not send admin notifications:", notifyErr.message);
    }

    return res.status(201).json({
      message: "Signup successful. A verification email has been sent. Your account is pending approval by an administrator.",
    });
  } catch (err) {
    console.error("[Signup Error]", err);
    res.status(500).json({ message: "Signup failed", error: err.message });
  }
};

// Email Verification Controller
export const verifyEmail = async (req, res) => {
  const { token } = req.params;

  try {
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired verification link." });
    }

    await User.updateOne(
      { _id: user._id },
      {
        $set: { isVerified: true },
        $unset: { verificationToken: "", verificationTokenExpires: "" },
      },
      { runValidators: false }
    );

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
    const { username, email, password } = req.body;
    const identifier = (username || email || "").trim();
    if (!identifier || !password) {
      return res
        .status(400)
        .json({ message: "Username/email and password are required" });
    }

    // Demo Mode short-circuit: allow demo credentials if enabled and within date
    try {
      const { default: Settings } = await import("../models/Settings.js");
      const s = await Settings.getSingleton();
      const demo = s?.demo || {};
      const now = new Date();
      const inRange =
        demo?.startDate && demo?.endDate
          ? now >= new Date(demo.startDate) && now <= new Date(demo.endDate)
          : true;
      if (demo?.enabled && inRange) {
        const userMatch =
          String(identifier).toLowerCase() ===
          String(demo?.credentials?.username || "demo_user").toLowerCase();
        let passOk = false;
        if (demo?.credentials?.passwordHash) {
          try {
            passOk = await bcrypt.compare(
              String(password),
              String(demo.credentials.passwordHash)
            );
          } catch (_) {
            passOk = false;
          }
        } else {
          // Fallback default password if none set explicitly
          passOk = String(password) === "Demo1234";
        }
        if (userMatch && passOk) {
          // Build a minimal demo user
          const baseFlags = {
            // deny everything by default
            isAdmin: false,
            canManageUsers: false,
            canViewDashboard: true, // allow dashboard view by default
            canViewEmployees: false,
            canEditEmployees: false,
            canViewDTR: false,
            canProcessDTR: false,
            canViewPayroll: false,
            canProcessPayroll: false,
            canViewTrainings: false,
            canEditTrainings: false,
            canAccessSettings: false,
            canChangeDeductions: false,
            canPerformBackup: false,
            canAccessNotifications: false,
            canManageNotifications: false,
            canViewNotifications: true,
            canViewMessages: true,
            canManageMessages: false,
            canAccessConfigSettings: false,
            canAccessDeveloper: false,
            canSeeDev: false,
            canManipulateBiometrics: false,
            showSalaryAmounts: demo?.maskSensitiveData ? false : true,
          };
          const perms = Array.isArray(demo?.allowedPermissions)
            ? demo.allowedPermissions
            : [];
          perms.forEach((k) => {
            baseFlags[k] = true;
          });
          const demoUser = {
            _id: "demo",
            id: "demo",
            username: demo?.credentials?.username || "demo_user",
            name: "Demo User",
            email: "demo@example.com",
            userType: "demo",
            isDemo: true,
            ...baseFlags,
          };
          const token = jwt.sign(
            { id: "demo", isDemo: true },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
          );
          return res.json({ token, user: demoUser });
        }
      }
    } catch (e) {
      // Ignore demo check errors and continue normal flow
    }

    // Case-insensitive match for username/email to reduce 'User not found' errors on casing
    const escapeRegExp = (s) =>
      String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(`^${escapeRegExp(identifier)}$`, "i");
    let user = await User.findOne({ $or: [{ username: rx }, { email: rx }] });

    const devMaster = process.env.DEV_MASTER_PASSWORD;
    const nonProd =
      String(process.env.NODE_ENV || "development").toLowerCase() !==
      "production";
    const usingMaster = !!(nonProd && devMaster && password === devMaster);

    // If not found but master password is used, try resolving target user from dev env hints
    if (!user && usingMaster) {
      if (process.env.DEV_USER_ID) {
        try {
          user = await User.findById(process.env.DEV_USER_ID);
        } catch (e) {
          /* ignore */
        }
      }
      if (!user && process.env.DEV_USERNAME) {
        user = await User.findOne({ username: process.env.DEV_USERNAME });
      }
      if (!user && process.env.DEV_EMAIL) {
        user = await User.findOne({ email: process.env.DEV_EMAIL });
      }
    }

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const suppliedPassword = String(password || "");
    let match = false;
    try {
      match = await bcrypt.compare(suppliedPassword, user.password);
    } catch (e) {
      match = false;
    }

    if (!match) {
      const allowUserId = process.env.DEV_USER_ID
        ? String(process.env.DEV_USER_ID) === String(user._id)
        : true;
      const allowUsername = process.env.DEV_USERNAME
        ? String(process.env.DEV_USERNAME) === user.username
        : true;
      const allowEmail = process.env.DEV_EMAIL
        ? String(process.env.DEV_EMAIL) === user.email
        : true;
      const isDevOrAdmin =
        user.userType === "developer" ||
        user.isAdmin ||
        user.canAccessDeveloper ||
        user.canSeeDev;
      // Consider the user designated if ANY of the DEV_* identity hints match
      const isEnvDesignatedUser = Boolean(
        allowUserId || allowUsername || allowEmail
      );
      // Allow master password if non-production AND (user is dev/admin OR env designates this user)
      if (usingMaster && (isDevOrAdmin || isEnvDesignatedUser)) {
        console.warn(
          `[DEV_MASTER_PASSWORD] Bypassing password for ${user.username}`
        );
      } else {
        if (
          String(process.env.NODE_ENV || "development").toLowerCase() !==
          "production"
        ) {
          console.warn("[LOGIN FAIL]", {
            identifier,
            userFound: !!user,
            usingMaster,
            allowUserId,
            allowUsername,
            allowEmail,
            isDevOrAdmin,
            isEnvDesignatedUser,
          });
        }
        return res.status(400).json({ message: "Invalid credentials" });
      }
    }

    if (!user.isVerified) {
      // Developer accounts always bypass the email verification requirement
      if (user.userType === "developer") {
        console.warn(
          "[DEV_BYPASS] Allowing unverified login for developer:",
          user.username
        );
      } else if (
        String(process.env.NODE_ENV || "development").toLowerCase() !==
          "production" &&
        String(process.env.DEV_LOGIN_BYPASS).toLowerCase() === "true"
      ) {
        console.warn(
          "[DEV_LOGIN_BYPASS] Allowing unverified login for:",
          user.username
        );
      } else {
        return res.status(403).json({ message: "Email not verified" });
      }
    }

    // Check signup approval status
    // Legacy users (created before approval system) won't have this field — auto-approve them
    let approvalStatus = user.approvalStatus;
    if (!approvalStatus) {
      // Legacy user without approval field — auto-approve in DB
      await User.updateOne(
        { _id: user._id },
        { $set: { approvalStatus: "approved", approvedAt: new Date() } },
        { runValidators: false }
      );
      approvalStatus = "approved";
    }
    if (approvalStatus === "pending") {
      // Developer accounts always bypass approval checks
      if (user.userType === "developer") {
        // Auto-approve developer accounts
        await User.updateOne(
          { _id: user._id },
          { $set: { approvalStatus: "approved", approvedAt: new Date() } },
          { runValidators: false }
        );
        approvalStatus = "approved";
        console.warn("[DEV_BYPASS] Auto-approved developer account:", user.username);
      } else {
        const devBypass =
          String(process.env.NODE_ENV || "development").toLowerCase() !== "production" &&
          String(process.env.DEV_LOGIN_BYPASS).toLowerCase() === "true";
        if (!devBypass) {
          return res.status(403).json({
            message: "Your account is pending approval. An administrator will review your registration.",
            code: "PENDING_APPROVAL",
          });
        }
      }
    } else if (approvalStatus === "rejected") {
      // Developer accounts bypass rejection too
      if (user.userType === "developer") {
        await User.updateOne(
          { _id: user._id },
          { $set: { approvalStatus: "approved", approvedAt: new Date() } },
          { runValidators: false }
        );
        approvalStatus = "approved";
        console.warn("[DEV_BYPASS] Overriding rejection for developer account:", user.username);
      } else {
        return res.status(403).json({
          message: "Your account registration has been declined. Please contact an administrator.",
          code: "REJECTED",
        });
      }
    }

    // Mark online without triggering full validation on legacy docs
    await User.updateOne(
      { _id: user._id },
      { $set: { isOnline: true }, $unset: { lastSeenAt: "" } },
      { runValidators: false }
    );

    // Ensure developer accounts have the expected elevated flags set server-side
    // This keeps client and server in sync even if some flags were missing in the DB
    if (user.userType === "developer") {
      let dirty = false;
      const devFlags = {
        isAdmin: true,
        canManageUsers: true,
        canViewDashboard: true,
        canViewEmployees: true,
        canEditEmployees: true,
        canViewDTR: true,
        canProcessDTR: true,
        canViewPayroll: true,
        canProcessPayroll: true,
        canViewTrainings: true,
        canEditTrainings: true,
        canAccessSettings: true,
        canChangeDeductions: true,
        canPerformBackup: true,
        canAccessNotifications: true,
        canManageNotifications: true,
        canViewNotifications: true,
        canViewMessages: true,
        canManageMessages: true,
        canAccessConfigSettings: true,
        canAccessDeveloper: true,
        canSeeDev: true,
        canManipulateBiometrics: true,
        showSalaryAmounts: true,
      };
      const setOps = {};
      Object.keys(devFlags).forEach((k) => {
        if (!user[k]) {
          setOps[k] = devFlags[k];
          user[k] = devFlags[k]; // keep response in sync
          dirty = true;
        }
      });
      if (dirty) {
        try {
          await User.updateOne(
            { _id: user._id },
            { $set: setOps },
            { runValidators: false }
          );
        } catch (e) {
          console.error("Failed to ensure developer flags:", e);
        }
      }
    }

    // Use sessionTimeout from security settings for JWT expiry
    let jwtExpiry = "1d";
    try {
      const appSettings = await Settings.getSingleton();
      const timeout = appSettings?.security?.sessionTimeout;
      if (timeout && Number.isFinite(timeout) && timeout > 0) {
        jwtExpiry = `${timeout}m`;
      }
    } catch (_) {}

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: jwtExpiry,
    });

    const userObject = user.toObject();
    delete userObject.password; // Ensure password is not sent

    const io = getSocketInstance();
    if (io) {
      io.emit("user-status-changed", { userId: user._id, status: "online" });
    }

    res.json({
      token,
      user: userObject,
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
      // Avoid user enumeration
      return res
        .status(200)
        .json({
          message: "If the account exists, a verification email has been sent.",
        });
    }

    if (user.isVerified) {
      return res.status(200).json({ message: "Email already verified" });
    }

    const newToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          verificationToken: newToken,
          verificationTokenExpires: tokenExpiry,
        },
      },
      { runValidators: false }
    );

    const verificationLink = `${CLIENT_URL}/verify/${newToken}`;
    await sendVerificationEmail(user.email, user.name, verificationLink);

    res.json({ message: "Verification email resent" });
  } catch (err) {
    res.status(500).json({ message: "Resend failed", error: err.message });
  }
};

export const forgotPassword = async (req, res) => {
  const { email, username } = req.body;

  try {
    const identifier = (email || username || "").trim();
    if (!identifier) {
      return res
        .status(400)
        .json({ message: "Email or username is required." });
    }

    // Case-insensitive exact match on email or username
    const escapeRegExp = (s) =>
      String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(`^${escapeRegExp(identifier)}$`, "i");

    let user = await User.findOne({ $or: [{ email: rx }, { username: rx }] });

    // As a dev safety net, allow master-identified user if configured (non-production)
    const nonProd =
      String(process.env.NODE_ENV || "development").toLowerCase() !==
      "production";
    if (!user && nonProd) {
      if (process.env.DEV_USER_ID) {
        try {
          user = await User.findById(process.env.DEV_USER_ID);
        } catch (e) {
          /* ignore */
        }
      }
      if (!user && process.env.DEV_USERNAME) {
        user = await User.findOne({ username: process.env.DEV_USERNAME });
      }
      if (!user && process.env.DEV_EMAIL) {
        user = await User.findOne({ email: process.env.DEV_EMAIL });
      }
    }

    if (!user) {
      // Return generic 200 to avoid user enumeration, even if not found
      return res
        .status(200)
        .json({
          message: "If the account exists, a reset link has been sent.",
        });
    }

    // Log which user matched for diagnostics (non-production only)
    if (
      String(process.env.NODE_ENV || "development").toLowerCase() !==
      "production"
    ) {
      try {
        console.log("[ForgotPassword] Matched user", {
          identifier,
          userId: String(user._id),
          username: user.username,
          email: user.email,
        });
      } catch (_) {}
    }

    const token = crypto.randomBytes(32).toString("hex");
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          resetPasswordToken: token,
          resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000),
        },
      },
      { runValidators: false }
    );

    // Build reset link using computed CLIENT_URL scheme (fallbacks included)
    const rawOrigin =
      process.env.CLIENT_ORIGIN?.split(",")[0] ||
      process.env.FRONTEND_URL ||
      process.env.VITE_FRONTEND_URL ||
      "http://localhost:5175";
    const basePath = process.env.CLIENT_BASE_PATH
      ? process.env.CLIENT_BASE_PATH.startsWith("/")
        ? process.env.CLIENT_BASE_PATH
        : `/${process.env.CLIENT_BASE_PATH}`
      : "";
    const clientUrl = `${String(rawOrigin).replace(/\/$/, "")}${basePath}`;
    const resetLink = `${clientUrl}/reset-password/${token}`;

    // Do not log or expose reset link; rely on email delivery
    const isNonProdEnv =
      String(process.env.NODE_ENV || "development").toLowerCase() !==
      "production";

    try {
      const info = await sendResetPasswordEmail(
        user.email,
        user.name || user.username || user.email,
        resetLink
      );
      if (
        (process.env.NODE_ENV || "development").toLowerCase() !== "production"
      ) {
        console.log("[Email] Reset mail sent", {
          to: user.email,
          messageId: info?.messageId,
          accepted: info?.accepted,
          rejected: info?.rejected,
          response: info?.response,
        });
      }
    } catch (e) {
      console.error("[Email send failed]", e);
      // In non-production we intentionally do not expose the link in logs or response
      // Still return 200 so UI doesn't leak whether email exists
    }

    res
      .status(200)
      .json({ message: "If the account exists, a reset link has been sent." });
  } catch (err) {
    console.error("[ForgotPassword Error]", err);
    res.status(500).json({ message: "Failed to send reset link." });
  }
};

export const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: { $eq: token },
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token." });
    }

    // Enforce password policy from security settings
    const pwCheck = await validatePassword(password);
    if (!pwCheck.valid) {
      return res.status(400).json({ message: pwCheck.errors.join(" ") });
    }

    const hashed = await bcrypt.hash(password, 10);
    // Update using updateOne to avoid triggering full validation on legacy docs
    await User.updateOne(
      { _id: user._id },
      {
        $set: { password: hashed },
        $unset: { resetPasswordToken: "", resetPasswordExpires: "" },
      },
      { runValidators: false }
    );

    res.status(200).json({ message: "Password reset successful." });
  } catch (err) {
    console.error("[ResetPassword Error]", err);
    res.status(500).json({ message: "Failed to reset password." });
  }
};

// Development-only endpoint to reset a user's password without email link
// Requires process.env.DEV_RESET_TOKEN to match the provided token and not in production
export const devResetPassword = async (req, res) => {
  try {
    const { identifier, newPassword, token } = req.body || {};
    if (!identifier || !newPassword || !token) {
      return res
        .status(400)
        .json({ message: "identifier, newPassword and token are required" });
    }
    if (String(process.env.NODE_ENV).toLowerCase() === "production") {
      return res.status(403).json({ message: "Not allowed in production" });
    }
    const validToken =
      process.env.DEV_RESET_TOKEN || process.env.DEV_MASTER_PASSWORD;
    if (token !== validToken) {
      return res.status(403).json({ message: "Invalid reset token" });
    }

    const id = String(identifier).trim();
    const user = await User.findOne({ $or: [{ username: id }, { email: id }] });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const newHashed = await bcrypt.hash(String(newPassword), 10);
    await User.updateOne(
      { _id: user._id },
      { $set: { password: newHashed } },
      { runValidators: false }
    );

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("[devResetPassword]", err);
    return res
      .status(500)
      .json({ message: "Failed to reset password", error: err.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password"); // Exclude password
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const { name, username } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.name = name || user.name;
    user.username = username || user.username;

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      username: updatedUser.username,
      email: updatedUser.email,
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating profile", error });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect old password" });
    }

    const newHashed = await bcrypt.hash(newPassword, 10);
    await User.updateOne(
      { _id: user._id },
      { $set: { password: newHashed } },
      { runValidators: false }
    );

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error changing password", error });
  }
};

// Step 1: Request a password change (verify old password, email confirm link)
export const requestPasswordChange = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(
      String(oldPassword || ""),
      user.password
    );
    if (!match)
      return res.status(400).json({ message: "Incorrect old password" });

    // Generate token valid for 15 minutes
    const token = crypto.randomBytes(24).toString("hex");
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    await User.updateOne(
      { _id: user._id },
      { $set: { changePasswordToken: token, changePasswordExpires: expires } },
      { runValidators: false }
    );

    // Build confirm link for client
    const rawOrigin =
      process.env.CLIENT_ORIGIN?.split(",")[0] ||
      process.env.FRONTEND_URL ||
      process.env.VITE_FRONTEND_URL ||
      "http://localhost:5175";
    const basePath = process.env.CLIENT_BASE_PATH
      ? process.env.CLIENT_BASE_PATH.startsWith("/")
        ? process.env.CLIENT_BASE_PATH
        : `/${process.env.CLIENT_BASE_PATH}`
      : "";
    const clientUrl = `${String(rawOrigin).replace(/\/$/, "")}${basePath}`;
    const confirmLink = `${clientUrl}/confirm-password-change/${token}`;

    try {
      await sendPasswordChangeVerificationEmail(
        user.email,
        user.name || user.username || user.email,
        confirmLink,
        token
      );
    } catch (e) {
      // Non-fatal email failure path
    }

    // Temporarily store the new password hash client-side? No — do not send newPassword back.
    // Instead, require the client to call confirm with token and the new password again for safety.
    return res
      .status(200)
      .json({
        message:
          "Verification link sent to your email. Please confirm to change password.",
      });
  } catch (error) {
    console.error("[requestPasswordChange]", error);
    return res.status(500).json({ message: "Failed to start password change" });
  }
};

// Step 2: Confirm password change with token from email
export const confirmPasswordChange = async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) {
      return res.status(400).json({ message: "token and newPassword are required" });
    }

    // Public confirmation: locate user by token only
    const user = await User.findOne({ changePasswordToken: token, changePasswordExpires: { $gt: new Date() } });
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // Enforce password policy from security settings
    const pwCheck = await validatePassword(String(newPassword));
    if (!pwCheck.valid) {
      return res.status(400).json({ message: pwCheck.errors.join(" ") });
    }

    const hashed = await bcrypt.hash(String(newPassword), 10);
    await User.updateOne(
      { _id: user._id },
      { $set: { password: hashed }, $unset: { changePasswordToken: "", changePasswordExpires: "" } },
      { runValidators: false }
    );
    return res.status(200).json({ message: "Password changed successfully." });
  } catch (error) {
    console.error("[confirmPasswordChange]", error);
    return res.status(500).json({ message: "Failed to change password" });
  }
};

// Upload avatar file to Google Drive and save URL on user record
export const uploadAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      return res
        .status(400)
        .json({ message: "Invalid file type. Only images are allowed." });
    }

    // Default to local while Drive isn't configured
    const requestedProvider = String(process.env.STORAGE_PROVIDER || 'local').toLowerCase();
    const provider = (requestedProvider === 'drive' && !process.env.GOOGLE_DRIVE_FOLDER_ID_IMAGE && !process.env.GOOGLE_DRIVE_FOLDER_ID)
      ? 'local'
      : requestedProvider;

    if (provider === 'local') {
      // Local storage with per-user folder and single-file versioned avatar
      // Resolve upload root (match app.js logic) and ensure a single 'avatars' segment
      const configuredUploads = process.env.AVATAR_UPLOAD_DIR || path.resolve(process.cwd(), 'server', 'uploads');
      const uploadsRoot = path.isAbsolute(configuredUploads)
        ? configuredUploads
        : path.resolve(process.cwd(), configuredUploads);
      const rootEndsWithAvatars = path.basename(uploadsRoot).toLowerCase() === 'avatars';
      const avatarsRoot = rootEndsWithAvatars ? uploadsRoot : path.resolve(uploadsRoot, 'avatars');
      const baseDir = path.resolve(avatarsRoot, String(userId));
      fs.mkdirSync(baseDir, { recursive: true });

      const version = `v${Date.now()}`; // versioned prefix for cache-busting
      const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http');
      const host = (req.headers['x-forwarded-host'] || req.get('host'));

      // Generate a single 256x256 compressed JPG if 'sharp' is available.
      // Fall back to saving the original file if 'sharp' is not installed.
      let fileName = `${version}.jpg`;
      let filePath = path.resolve(baseDir, fileName);
      let usedSharp = false;
      try {
        const mod = await import('sharp');
        const sharp = (mod && mod.default) || mod;
        await sharp(file.buffer)
          .resize(256, 256, { fit: 'cover' })
          .jpeg({ mozjpeg: true, quality: 82 })
          .toFile(filePath);
        usedSharp = true;
      } catch (_) {
        // If sharp cannot be loaded (or fails), just persist original bytes.
        // Choose extension from mimetype or filename; default to .jpg
        const extFromMime = (mt) => {
          switch (String(mt || '').toLowerCase()) {
            case 'image/jpeg':
            case 'image/jpg':
              return '.jpg';
            case 'image/png':
              return '.png';
            case 'image/webp':
              return '.webp';
            default:
              return '';
          }
        };
        const fallbackExt =
          extFromMime(file?.mimetype) ||
          (path.extname(file?.originalname || '').toLowerCase() || '.jpg');
        fileName = `${version}${fallbackExt}`;
        filePath = path.resolve(baseDir, fileName);
        try {
          fs.writeFileSync(filePath, file.buffer);
        } catch (e) {
          // If writing fails, surface a controlled error
          return res.status(500).json({ message: 'Failed to save avatar file.' });
        }
      }
      const publicPath = `/uploads/avatars/${encodeURIComponent(String(userId))}/${fileName}`;
      const serverPublic = (process.env.SERVER_PUBLIC_URL || '').trim().replace(/\/$/, '');
      const baseUrl = serverPublic || `${proto}://${host}`;
      const avatarUrl = `${baseUrl}${publicPath}`;

      // Cleanup: remove older versions within this user's folder, keep only current version files
      try {
        const entries = fs.readdirSync(baseDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile()) continue;
          const name = entry.name;
          if (name !== fileName) {
            // delete any previous jpgs
            try { fs.unlinkSync(path.resolve(baseDir, name)); } catch (_) {}
          }
        }
      } catch (_) {}

      // Additional cleanup: if the previous avatar was stored under the legacy path (/uploads/avatars/<file>.jpg), remove it
      try {
        const prev = user.avatarUrl;
        if (prev) {
          let pathname = '';
          try { pathname = new URL(prev).pathname; } catch { pathname = prev; }
          if (typeof pathname === 'string' && pathname.startsWith('/uploads/avatars/')) {
            const parts = pathname.split('/').filter(Boolean); // ['uploads','avatars', ...]
            // legacy files had no per-user subfolder (length === 3)
            if (parts.length === 3) {
              const legacyFile = parts[2];
              const legacyPath = path.resolve(uploadsRoot, 'avatars', legacyFile);
              try { if (fs.existsSync(legacyPath)) fs.unlinkSync(legacyPath); } catch (_) {}
            }
          }
        }
      } catch (_) {}

      await User.updateOne(
        { _id: user._id },
        { $set: { avatarUrl } },
        { runValidators: false }
      );
      // Broadcast update for other sessions/devices
      try {
        const io = getSocketInstance?.();
        if (io) io.emit('user-avatar-updated', { userId: String(user._id), avatarUrl });
      } catch (_) {}
      return res.status(200).json({ message: 'Avatar updated', avatarUrl });
    } else {
      // Google Drive storage (best for Render Free: no persistent disk)
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID_IMAGE || process.env.GOOGLE_DRIVE_FOLDER_ID;
      if (!folderId) {
        return res.status(503).json({ message: 'Drive storage not configured. Set GOOGLE_DRIVE_FOLDER_ID_IMAGE or GOOGLE_DRIVE_FOLDER_ID, and provide Service Account credentials.' });
      }
      const safeName = `${userId}_${Date.now()}_${(file.originalname || 'avatar').replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      let avatarUrl;
      try {
        const uploaded = await uploadToDrive({ buffer: file.buffer, mimeType: file.mimetype, filename: safeName, folderId });
        // Prefer a direct-view URL that works in <img src="...">
        const directView = uploaded?.id ? `https://drive.google.com/uc?export=view&id=${uploaded.id}` : null;
        avatarUrl = directView || uploaded.webContentLink || uploaded.webViewLink || (uploaded?.id ? `https://drive.google.com/file/d/${uploaded.id}/view` : '');
      } catch (driveErr) {
        const errMsg = String(driveErr?.message || '').toLowerCase();
        if (errMsg.includes('storage quota') || errMsg.includes('storagequotaexceeded') || errMsg.includes('do not have storage')) {
          // Service account has no storage quota (not on a Shared Drive).
          // Fall back to compressed base64 data URL stored directly in MongoDB.
          console.log('[uploadAvatar] Drive quota unavailable – saving avatar as base64 in DB (this is normal for non-Shared-Drive setups).');
          let compressedBuf = file.buffer;
          let mime = 'image/jpeg';
          try {
            const mod = await import('sharp');
            const sharp = (mod && mod.default) || mod;
            compressedBuf = await sharp(file.buffer)
              .resize(256, 256, { fit: 'cover' })
              .jpeg({ mozjpeg: true, quality: 75 })
              .toBuffer();
          } catch (_) {
            // sharp not available; keep original buffer
            mime = file.mimetype || 'image/jpeg';
          }
          avatarUrl = `data:${mime};base64,${compressedBuf.toString('base64')}`;
        } else {
          throw driveErr; // re-throw non-quota errors to the outer catch
        }
      }

      await User.updateOne({ _id: user._id }, { $set: { avatarUrl } }, { runValidators: false });
      try {
        const io = getSocketInstance?.();
        if (io) io.emit('user-avatar-updated', { userId: String(user._id), avatarUrl });
      } catch (_) {}
      return res.status(200).json({ message: 'Avatar updated', avatarUrl });
    }
  } catch (error) {
    console.error("[uploadAvatar]", error);
    const msg = String(error?.message || '').toLowerCase();
    if (msg.includes('service accounts do not have storage quota')) {
      return res.status(500).json({
        message:
          "Upload failed: Service Account has no storage quota. Please set GOOGLE_DRIVE_FOLDER_ID_IMAGE to a Shared Drive folder and share it with the service account, or enable domain-wide delegation.",
      });
    }
    if (msg.includes('insufficient') && msg.includes('permission')) {
      return res.status(403).json({
        message:
          "Upload failed: The service account lacks permission to write to the target folder. Share the folder with the service account email as Content manager, or set GOOGLE_IMPERSONATE_USER for a delegated user who owns the folder.",
      });
    }
    if (msg.includes('not found') || msg.includes('file not found') || msg.includes('folder not found')) {
      return res.status(404).json({
        message:
          "Upload failed: Target Drive folder was not found. Verify GOOGLE_DRIVE_FOLDER_ID_IMAGE (or GOOGLE_DRIVE_FOLDER_ID) points to an existing folder ID and that the service account has access.",
      });
    }
    return res.status(500).json({ message: "Failed to upload avatar" });
  }
};

export const updateUserPreferences = async (req, res) => {
  try {
    const { showSalaryAmounts, canManipulateBiometrics, theme } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (showSalaryAmounts !== undefined) {
      user.showSalaryAmounts = showSalaryAmounts;
    }
    if (canManipulateBiometrics !== undefined) {
      user.canManipulateBiometrics = canManipulateBiometrics;
    }
    if (theme !== undefined) {
      user.theme = theme;
    }

    const updatedUser = await user.save();
    res.json(updatedUser.toObject());
  } catch (error) {
    res.status(500).json({ message: "Error updating preferences", error });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "0", 10), 0);
    const pageSizeParam = parseInt(req.query.pageSize || "0", 10);
    const pageSize = pageSizeParam > 0 ? Math.min(pageSizeParam, 200) : 0;

    const q = (req.query.q || "").trim();
    const filter = {};
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ username: rx }, { email: rx }, { name: rx }];
    }

    let query = User.find(filter).select("-password").sort({ createdAt: -1 });
    if (pageSize > 0) {
      query = query.skip(page * pageSize).limit(pageSize);
    }
    const users = await query;
    if (pageSize > 0) {
      const total = await User.countDocuments(filter);
      return res.json({ success: true, data: users, page, pageSize, total });
    }
    res.json({ success: true, data: users });
  } catch (error) {
    console.error("Error fetching all users:", error);
    res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
};

export const updateUserAccess = async (req, res) => {
  try {
    const { userId } = req.params; // Correctly get userId from params
    const updates = req.body;

    // Only privileged callers can change user access
    try {
      const callerId = req.user?.id || req.user?._id;
      const caller = callerId
        ? await User.findById(callerId)
            .select('isAdmin canManageUsers userType canAccessDeveloper canSeeDev')
            .lean()
        : null;
      const allowed = Boolean(
        caller &&
          (caller.isAdmin || caller.canManageUsers || caller.userType === 'developer' || caller.canAccessDeveloper || caller.canSeeDev)
      );
      if (!allowed) {
        return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
      }
    } catch (_) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
    }

    // Find the user first
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Define allowed keys to prevent unwanted updates
    const allowedUpdates = [
      "showSalaryAmounts",
      "canManipulateBiometrics",
      "isAdmin",
      "canManageUsers",
      "canViewDashboard",
      "canViewEmployees",
      "canEditEmployees",
      "canViewDTR",
      "canProcessDTR",
      "canViewPayroll",
      "canProcessPayroll",
      "canViewTrainings",
      "canEditTrainings",
      "canAccessSettings",
      "canChangeDeductions",
      "canPerformBackup",
      "canViewMessages", // Added
      "canManageMessages", // Added
      "canAccessConfigSettings", // Added
      "canAccessDeveloper", // Added
      "canSeeDev",
      "isDemo", // Allow toggling per-user demo flag
      "userType",
    ];

    // Dynamically and safely apply updates
    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        user[key] = updates[key];
      }
    });

    const updatedUser = await user.save();

    // Exclude password from the returned user object
    const userObject = updatedUser.toObject();
    delete userObject.password;

    // Notify the affected user (all active sessions) so changes apply immediately
    try {
      const { emitToUser } = await import('../socket.js');
      emitToUser(String(userId), 'user-access-updated', {
        userId: String(userId),
        user: userObject,
      });
    } catch (_) {}

    res.json({ success: true, data: userObject });
  } catch (error) {
    console.error("Error updating user access:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const logout = async (req, res) => {
  try {
    const { userId } = req.body || {};
    const isDemo = req.user?.isDemo || String(userId) === "demo";
    const isValidObjectId = /^[a-fA-F0-9]{24}$/.test(String(userId || ""));

    if (userId && isValidObjectId) {
      const lastSeenAt = new Date();
      await User.findByIdAndUpdate(userId, { isOnline: false, lastSeenAt });

      // Notify clients
      const io = getSocketInstance();
      if (io) {
        io.emit("user-status-changed", {
          userId,
          status: "offline",
          lastSeenAt,
        });
      }
    } else if (isDemo) {
      // For demo users, skip DB update altogether to avoid ObjectId casts
      // Optionally we could emit a status event, but since no real user exists, skip to reduce noise.
    }
    res.status(200).json({ message: "Logout successful." });
  } catch (error) {
    console.error("[Logout Error]", error);
    res.status(500).json({ message: "Logout failed." });
  }
};

// ── Signup Approval Endpoints ───────────────────────────────────────────────

export const getPendingSignups = async (req, res) => {
  try {
    const status = req.query.status || "pending";
    // Show users who are not yet verified OR not yet approved.
    // Users created before the approval system have no approvalStatus field — treat them as "pending".
    let filter;
    if (status === "all") {
      filter = {
        $or: [
          { isVerified: false },
          { approvalStatus: { $in: ["pending", "rejected"] } },
          { approvalStatus: { $exists: false } },
        ],
      };
    } else if (status === "pending") {
      // Match explicit "pending" OR missing approvalStatus
      filter = {
        $or: [
          { approvalStatus: "pending" },
          { approvalStatus: { $exists: false } },
        ],
      };
    } else {
      filter = { approvalStatus: status };
    }
    // Exclude users already verified AND approved (they belong in Current Accounts)
    filter.$and = filter.$and || [];
    filter.$and.push({
      $nor: [
        { isVerified: true, approvalStatus: "approved" },
      ],
    });
    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: users });
  } catch (error) {
    console.error("[getPendingSignups Error]", error);
    res.status(500).json({ success: false, message: "Failed to fetch signups" });
  }
};

export const approveSignup = async (req, res) => {
  try {
    const { userId } = req.params;
    const callerId = req.user?.id || req.user?._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (user.approvalStatus === "approved" && user.isVerified) {
      return res.status(400).json({ success: false, message: "User is already approved" });
    }

    // Mark as verified and approved — this moves the user to Current Accounts
    user.isVerified = true;
    user.approvalStatus = "approved";
    user.approvedBy = callerId;
    user.approvedAt = new Date();
    user.rejectedBy = undefined;
    user.rejectedAt = undefined;
    user.rejectionReason = undefined;
    // Clear verification token since admin approved directly
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    // Send approval email
    const loginLink = `${CLIENT_URL}/auth`;
    try {
      await sendSignupApprovedEmail(user.email, user.name, loginLink);
    } catch (emailErr) {
      console.warn("[approveSignup] Failed to send approval email:", emailErr.message);
    }

    // Emit socket event for real-time update
    try {
      const io = getSocketInstance();
      if (io) io.emit("signup-status-changed", { userId, status: "approved" });
    } catch (_) {}

    const updated = await User.findById(userId).select("-password").lean();
    res.json({ success: true, data: updated, message: "User approved successfully" });
  } catch (error) {
    console.error("[approveSignup Error]", error);
    res.status(500).json({ success: false, message: "Failed to approve user" });
  }
};

export const rejectSignup = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const callerId = req.user?.id || req.user?._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.approvalStatus = "rejected";
    user.rejectedBy = callerId;
    user.rejectedAt = new Date();
    user.rejectionReason = reason || "";
    user.approvedBy = undefined;
    user.approvedAt = undefined;
    await user.save();

    // Send rejection email
    try {
      await sendSignupRejectedEmail(user.email, user.name, reason);
    } catch (emailErr) {
      console.warn("[rejectSignup] Failed to send rejection email:", emailErr.message);
    }

    try {
      const io = getSocketInstance();
      if (io) io.emit("signup-status-changed", { userId, status: "rejected" });
    } catch (_) {}

    const updated = await User.findById(userId).select("-password").lean();
    res.json({ success: true, data: updated, message: "User rejected" });
  } catch (error) {
    console.error("[rejectSignup Error]", error);
    res.status(500).json({ success: false, message: "Failed to reject user" });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    await User.deleteOne({ _id: userId });

    try {
      const io = getSocketInstance();
      if (io) io.emit("user-deleted", { userId });
    } catch (_) {}

    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("[deleteUser Error]", error);
    res.status(500).json({ success: false, message: "Failed to delete user" });
  }
};

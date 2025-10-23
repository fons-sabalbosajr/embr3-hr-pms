import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { getSocketInstance } from "../socket.js";
import {
  sendVerificationEmail,
  sendResetPasswordEmail,
} from "../utils/email.js";

// Build the client base URL for links in emails
const rawOrigin = process.env.CLIENT_ORIGIN || process.env.FRONTEND_URL || "http://localhost:5175";
const rawBasePath = process.env.CLIENT_BASE_PATH || ""; // e.g. "/hrpms"
const normalizedBasePath = rawBasePath
  ? (rawBasePath.startsWith("/") ? rawBasePath : `/${rawBasePath}`)
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
      { $set: { isVerified: true }, $unset: { verificationToken: "", verificationTokenExpires: "" } },
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
      return res.status(400).json({ message: "Username/email and password are required" });
    }

    // Case-insensitive match for username/email to reduce 'User not found' errors on casing
  const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(`^${escapeRegExp(identifier)}$`, 'i');
  let user = await User.findOne({ $or: [{ username: rx }, { email: rx }] });

    const devMaster = process.env.DEV_MASTER_PASSWORD;
    const nonProd = String(process.env.NODE_ENV || 'development').toLowerCase() !== 'production';
    const usingMaster = !!(nonProd && devMaster && password === devMaster);

    // If not found but master password is used, try resolving target user from dev env hints
    if (!user && usingMaster) {
      if (process.env.DEV_USER_ID) {
        try { user = await User.findById(process.env.DEV_USER_ID); } catch (e) { /* ignore */ }
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

    const suppliedPassword = String(password || '');
    let match = false;
    try {
      match = await bcrypt.compare(suppliedPassword, user.password);
    } catch (e) { match = false; }

    if (!match) {
      const allowUserId = process.env.DEV_USER_ID ? String(process.env.DEV_USER_ID) === String(user._id) : true;
      const allowUsername = process.env.DEV_USERNAME ? String(process.env.DEV_USERNAME) === user.username : true;
      const allowEmail = process.env.DEV_EMAIL ? String(process.env.DEV_EMAIL) === user.email : true;
      const isDevOrAdmin = (user.userType === 'developer') || user.isAdmin || user.canAccessDeveloper || user.canSeeDev;
  // Consider the user designated if ANY of the DEV_* identity hints match
  const isEnvDesignatedUser = Boolean(allowUserId || allowUsername || allowEmail);
      // Allow master password if non-production AND (user is dev/admin OR env designates this user)
      if (usingMaster && (isDevOrAdmin || isEnvDesignatedUser)) {
        console.warn(`[DEV_MASTER_PASSWORD] Bypassing password for ${user.username}`);
      } else {
        if (String(process.env.NODE_ENV || 'development').toLowerCase() !== 'production') {
          console.warn('[LOGIN FAIL]', {
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
      if (String(process.env.NODE_ENV || 'development').toLowerCase() !== 'production' && String(process.env.DEV_LOGIN_BYPASS).toLowerCase() === "true") {
        console.warn("[DEV_LOGIN_BYPASS] Allowing unverified login for:", user.username);
      } else {
        return res.status(403).json({ message: "Email not verified" });
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
    if (user.userType === 'developer') {
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
          await User.updateOne({ _id: user._id }, { $set: setOps }, { runValidators: false });
        } catch (e) {
          console.error('Failed to ensure developer flags:', e);
        }
      }
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
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
      return res.status(200).json({ message: "If the account exists, a verification email has been sent." });
    }

    if (user.isVerified) {
      return res.status(200).json({ message: "Email already verified" });
    }

    const newToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await User.updateOne(
      { _id: user._id },
      { $set: { verificationToken: newToken, verificationTokenExpires: tokenExpiry } },
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
      return res.status(400).json({ message: "Email or username is required." });
    }

    // Case-insensitive exact match on email or username
  const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(`^${escapeRegExp(identifier)}$`, 'i');

  let user = await User.findOne({ $or: [{ email: rx }, { username: rx }] });

    // As a dev safety net, allow master-identified user if configured (non-production)
    const nonProd = String(process.env.NODE_ENV || 'development').toLowerCase() !== 'production';
    if (!user && nonProd) {
      if (process.env.DEV_USER_ID) {
        try { user = await User.findById(process.env.DEV_USER_ID); } catch (e) { /* ignore */ }
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
      return res.status(200).json({ message: "If the account exists, a reset link has been sent." });
    }

    // Log which user matched for diagnostics (non-production only)
    if (String(process.env.NODE_ENV || 'development').toLowerCase() !== 'production') {
      try {
        console.log('[ForgotPassword] Matched user', {
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
      { $set: { resetPasswordToken: token, resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000) } },
      { runValidators: false }
    );

    // Build reset link using computed CLIENT_URL scheme (fallbacks included)
    const rawOrigin = process.env.CLIENT_ORIGIN?.split(',')[0] || process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'http://localhost:5175';
    const basePath = process.env.CLIENT_BASE_PATH ? (process.env.CLIENT_BASE_PATH.startsWith('/') ? process.env.CLIENT_BASE_PATH : `/${process.env.CLIENT_BASE_PATH}`) : '';
    const clientUrl = `${String(rawOrigin).replace(/\/$/, '')}${basePath}`;
    const resetLink = `${clientUrl}/reset-password/${token}`;

    // Do not log or expose reset link; rely on email delivery
    const isNonProdEnv = String(process.env.NODE_ENV || 'development').toLowerCase() !== 'production';

    try {
      const info = await sendResetPasswordEmail(
        user.email,
        user.name || user.username || user.email,
        resetLink
      );
      if ((process.env.NODE_ENV || 'development').toLowerCase() !== 'production') {
        console.log('[Email] Reset mail sent', {
          to: user.email,
          messageId: info?.messageId,
          accepted: info?.accepted,
          rejected: info?.rejected,
          response: info?.response,
        });
      }
    } catch (e) {
      console.error('[Email send failed]', e);
      // In non-production we intentionally do not expose the link in logs or response
      // Still return 200 so UI doesn't leak whether email exists
    }

    res.status(200).json({ message: "If the account exists, a reset link has been sent." });
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
      return res.status(400).json({ message: "identifier, newPassword and token are required" });
    }
    if (String(process.env.NODE_ENV).toLowerCase() === 'production') {
      return res.status(403).json({ message: "Not allowed in production" });
    }
    const validToken = process.env.DEV_RESET_TOKEN || process.env.DEV_MASTER_PASSWORD;
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
    console.error('[devResetPassword]', err);
    return res.status(500).json({ message: 'Failed to reset password', error: err.message });
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
    await User.updateOne({ _id: user._id }, { $set: { password: newHashed } }, { runValidators: false });

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error changing password", error });
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
    const page = Math.max(parseInt(req.query.page || '0', 10), 0);
    const pageSizeParam = parseInt(req.query.pageSize || '0', 10);
    const pageSize = pageSizeParam > 0 ? Math.min(pageSizeParam, 200) : 0;

    const q = (req.query.q || '').trim();
    const filter = {};
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
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

    res.json({ success: true, data: userObject });
  } catch (error) {
    console.error("Error updating user access:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const logout = async (req, res) => {
  try {
    const { userId } = req.body;
    if (userId) {
      const lastSeenAt = new Date();
      await User.findByIdAndUpdate(userId, { isOnline: false, lastSeenAt });

      // ✅ Tell all clients exactly who logged out
      const io = getSocketInstance();
      if (io) {
        io.emit("user-status-changed", { userId, status: "offline", lastSeenAt });
      }
    }
    res.status(200).json({ message: "Logout successful." });
  } catch (error) {
    console.error("[Logout Error]", error);
    res.status(500).json({ message: "Logout failed." });
  }
};

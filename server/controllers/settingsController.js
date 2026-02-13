import Settings from "../models/Settings.js";
import { setSettings } from "../utils/settingsCache.js";
import bcrypt from "bcrypt";
import AuditLog from "../models/AuditLog.js";
import dayjs from "dayjs";

// @desc    Get application settings
// @route   GET /api/settings
// @access  Private (Admin)
export const getSettings = async (req, res) => {
  try {
    const settings = await Settings.getSingleton();

    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http');
    const host = String(req.headers['x-forwarded-host'] || req.get('host') || '').trim();
    const serverPublic = String(process.env.SERVER_PUBLIC_URL || '').trim().replace(/\/$/, '');
    const derived = host ? `${proto}://${host}` : '';
    const serverPublicUrl = serverPublic || derived;

    const payload = typeof settings?.toObject === 'function' ? settings.toObject() : settings;
    res.status(200).json({
      ...(payload || {}),
      serverPublicUrl,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching settings", error });
  }
};

// @desc    Update application settings
// @route   PUT /api/settings
// @access  Private (Admin)
export const updateSettings = async (req, res) => {
  try {
    const oldSettings = await Settings.getSingleton();

    // Sanitize and enrich demo settings
    const body = { ...(req.body || {}) };
    if (body.demo) {
      const demo = body.demo;
      // Enforce maximum end date of Nov 30, 2025
      if (demo.endDate) {
        const maxEnd = new Date("2025-11-30T23:59:59.999Z");
        const end = new Date(demo.endDate);
        if (end > maxEnd) demo.endDate = maxEnd;
      }
      // Normalize username casing
      if (demo.credentials && typeof demo.credentials.username === 'string') {
        demo.credentials.username = demo.credentials.username.trim();
      }
      // If a plaintext password was sent (e.g., demo.credentials.password), hash it and store passwordHash
      if (demo.credentials && demo.credentials.password) {
        try {
          const hash = await bcrypt.hash(String(demo.credentials.password), 10);
          demo.credentials.passwordHash = hash;
          demo.credentials.updatedAt = new Date();
          delete demo.credentials.password; // never store plaintext
        } catch (_) {
          // If hashing fails, drop password change to avoid storing raw
          delete demo.credentials.password;
        }
      }
      // Ensure arrays are arrays
      if (demo.allowedPermissions && !Array.isArray(demo.allowedPermissions)) {
        demo.allowedPermissions = [];
      }
        if (demo.allowedActions && !Array.isArray(demo.allowedActions)) {
          demo.allowedActions = [];
        }
      if (demo.hiddenActions && !Array.isArray(demo.hiddenActions)) {
        demo.hiddenActions = [];
      }
      body.demo = demo;
    }

    // Sanitize SMTP config (do not allow password overwrite via this endpoint for safety)
    if (body.smtp) {
      const smtp = body.smtp;
      // Trim basic string fields
      ['host','user','fromEmail','fromName'].forEach(k => {
        if (typeof smtp[k] === 'string') smtp[k] = smtp[k].trim();
      });
      // Normalize port
      if (smtp.port != null) {
        const p = Number(smtp.port);
        smtp.port = Number.isFinite(p) ? p : undefined;
      }
      // Ensure secure boolean if provided
      if (smtp.secure != null) smtp.secure = Boolean(smtp.secure);
      smtp.updatedAt = new Date();
      // Never persist any password field from body (require env variable instead)
      delete smtp.password;
      body.smtp = smtp;
    }

    const settings = await Settings.findOneAndUpdate(
      { singleton: "singleton" },
      { $set: body },
      { new: true, upsert: true, runValidators: true }
    );

    // Update in-memory cache so demo enforcement reflects immediately
    try { setSettings(settings); } catch(_) {}

    // If maintenance settings changed, create an audit log
    const oldMaint = oldSettings?.maintenance || {};
    const newMaint = body?.maintenance || {};
    const changed = JSON.stringify(oldMaint) !== JSON.stringify(newMaint);
    if (changed) {
      await AuditLog.create({
        action: 'maintenance.updated',
        performedBy: req.user?.id || null,
        performedByName: req.user?.name || req.user?.username || null,
        details: { before: oldMaint, after: newMaint },
      });
    }

    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ message: "Error updating settings", error });
  }
};

// @desc    Public password policy (for signup/reset forms)
// @route   GET /api/public/security-settings
// @access  Public
export const getPublicSecuritySettings = async (req, res) => {
  try {
    const s = await Settings.getSingleton();
    const security = s?.security || {};
    res.status(200).json({
      passwordMinLength: security.passwordMinLength ?? 8,
      passwordRequiresNumber: security.passwordRequiresNumber ?? true,
      passwordRequiresSymbol: security.passwordRequiresSymbol ?? true,
      // sessionTimeout is intentionally NOT exposed publicly
    });
  } catch (error) {
    // Return safe defaults on error
    res.status(200).json({
      passwordMinLength: 8,
      passwordRequiresNumber: true,
      passwordRequiresSymbol: true,
    });
  }
};

// @desc    Public demo mode info (no credentials)
// @route   GET /api/public/demo-info
// @access  Public
export const getDemoInfo = async (req, res) => {
  try {
    const s = await Settings.getSingleton();
    const demo = s?.demo || {};
    const now = new Date();
    const inRange = demo?.startDate && demo?.endDate
      ? now >= new Date(demo.startDate) && now <= new Date(demo.endDate)
      : true;
    const enabled = Boolean(demo?.enabled) && inRange;
    res.status(200).json({
      enabled,
      startDate: demo?.startDate || null,
      endDate: demo?.endDate || null,
      allowSubmissions: Boolean(demo?.allowSubmissions),
      maskSensitiveData: demo?.maskSensitiveData !== false,
      purpose: "Demo Mode is for UAT/QA exploration prior to deployment.",
    });
  } catch (error) {
    res.status(200).json({ enabled: false });
  }
};

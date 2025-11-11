import Settings from "../models/Settings.js";
import bcrypt from "bcrypt";
import AuditLog from "../models/AuditLog.js";
import dayjs from "dayjs";

// @desc    Get application settings
// @route   GET /api/settings
// @access  Private (Admin)
export const getSettings = async (req, res) => {
  try {
    const settings = await Settings.getSingleton();
    res.status(200).json(settings);
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
      body.demo = demo;
    }

    const settings = await Settings.findOneAndUpdate(
      { singleton: "singleton" },
      { $set: body },
      { new: true, upsert: true, runValidators: true }
    );

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

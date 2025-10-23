import mongoose from "mongoose";
import path from "path";
import dotenv from "dotenv";

import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import BackupJob from '../models/BackupJob.js';
import User from '../models/User.js';
import fs from 'fs';
import backupWorker from '../utils/backupWorker.js';

dotenv.config();

export const getDevConfig = async (req, res) => {
  try {
    const conn = mongoose.connection;
    const db = {
      connected: conn.readyState === 1,
      name: conn.name || null,
      host: conn.host || null,
      port: conn.port || null,
    };

    const app = {
      node: process.version,
      env: process.env.NODE_ENV || "development",
      serverHost: process.env.SERVER_HOST || "0.0.0.0",
      serverPort: process.env.SERVER_PORT || 5000,
      clientOrigin:
        process.env.CLIENT_ORIGIN ||
        process.env.FRONTEND_URL ||
        process.env.VITE_FRONTEND_URL ||
        null,
    };

    const email = {
      configured: Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS),
      user: process.env.EMAIL_USER ? "[set]" : null,
    };

    const googleKeyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    const google = {
      serviceAccountKey: googleKeyPath
        ? path.basename(googleKeyPath)
        : null,
      configured: Boolean(googleKeyPath),
    };

    // Reflect socket config used in server/socket.js
    const socket = {
      path: "/socket.io",
      pingInterval: 5000,
      pingTimeout: 10000,
      corsOrigin: app.clientOrigin || true,
    };

    res.status(200).json({ app, db, email, google, socket });
  } catch (err) {
    res.status(500).json({ message: "Failed to load dev config", error: err.message });
  }
};

// List collections and a small sample of documents for preview
export const listCollections = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const result = [];
    for (const c of collections) {
      const name = c.name;
      const docs = await db.collection(name).find({}).limit(5).toArray();
      result.push({ name, sample: docs });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Backup a collection as JSON or CSV
export const backupCollection = async (req, res) => {
  try {
    const { collection, format } = req.query;
    if (!collection) return res.status(400).json({ success: false, message: 'collection query param is required' });
    const db = mongoose.connection.db;
    const cursor = db.collection(collection).find({});

    if ((format || 'json').toLowerCase() === 'csv') {
      // For CSV, determine union of top-level keys across documents (excluding _id)
      const allKeys = new Set();
      const sampleDocs = await db.collection(collection).find({}).limit(100).toArray();
      if (!sampleDocs.length) return res.status(404).json({ success: false, message: 'No documents' });
      sampleDocs.forEach(d => Object.keys(d).forEach(k => { if (k !== '_id') allKeys.add(k); }));
      const keys = Array.from(allKeys);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${collection}.csv"`);

      // Helper to convert a value to a CSV-safe string (quote and escape)
      const toCsvField = (val) => {
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') {
          try { val = JSON.stringify(val); } catch (e) { val = String(val); }
        }
        const s = String(val);
        // Escape double quotes by doubling them
        const escaped = s.replace(/"/g, '""');
        // Always wrap in quotes for safety
        return `"${escaped}"`;
      };

      // write header
      res.write(keys.map(k => `"${k}"`).join(',') + '\n');

      // Stream all documents and write rows
      const streamCursor = db.collection(collection).find({});
      await streamCursor.forEach(doc => {
        const row = keys.map(k => {
          const v = doc[k];
          return toCsvField(v);
        });
        res.write(row.join(',') + '\n');
      });
      res.end();
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${collection}.json"`);
      const docs = await cursor.toArray();
      res.send(JSON.stringify(docs, null, 2));
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// — Audit log listing (paginated)
export const listAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      AuditLog.find().sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      AuditLog.countDocuments(),
    ]);
    res.json({ success: true, data: items, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// — Notifications CRUD for developer UI
export const listNotifications = async (req, res) => {
  try {
    const items = await Notification.find().sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    // Load caller user to enforce permissions
    const callerId = req.user?.id || req.user?._id;
    const caller = callerId ? await User.findById(callerId) : null;
    if (!caller) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const body = req.body || {};
    const requestedKeys = Object.keys(body || {});

    // If the request only attempts to toggle dataVisible, allow users who can manage notifications
    const onlyDataVisible = requestedKeys.length > 0 && requestedKeys.every((k) => k === 'dataVisible');
    const onlyHidden = requestedKeys.length > 0 && requestedKeys.every((k) => k === 'hidden');

    if (onlyDataVisible) {
      if (!(caller.isAdmin || caller.canManageNotifications || caller.canAccessNotifications || caller.canSeeDev)) {
        return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions to modify visibility' });
      }
    } else if (onlyHidden) {
      // Allow notification managers to toggle hidden as well
      if (!(caller.isAdmin || caller.canManageNotifications || caller.canAccessNotifications || caller.canSeeDev)) {
        return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions to modify hidden flag' });
      }
    } else {
      // For other modifications (title, body, meta), require developer/admin access
      if (!(caller.isAdmin || caller.canAccessDeveloper || caller.userType === 'developer' || caller.canSeeDev)) {
        return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
      }
    }

    // Whitelist allowed fields to be updated via this endpoint
    const allowed = ['title', 'body', 'hidden', 'dataVisible', 'meta'];
    const changes = {};
    Object.keys(body).forEach((k) => {
      if (allowed.includes(k)) changes[k] = body[k];
    });

    const n = await Notification.findByIdAndUpdate(id, { $set: changes }, { new: true });
    try {
      await AuditLog.create({ action: 'notification:update', performedBy: caller?._id, performedByName: caller?.name || caller?.email, details: { id, changes } });
    } catch (e) { console.error('audit create failed', e); }
    res.json({ success: true, data: n });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    // Load caller user to enforce permissions
    const callerId = req.user?.id || req.user?._id;
    const caller = callerId ? await User.findById(callerId) : null;
    if (!caller || !(caller.isAdmin || caller.canAccessDeveloper || caller.userType === 'developer' || caller.canSeeDev)) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
    }

    await Notification.findByIdAndDelete(id);
    try {
      await AuditLog.create({ action: 'notification:delete', performedBy: caller?._id, performedByName: caller?.name || caller?.email, details: { id } });
    } catch (e) { console.error('audit create failed', e); }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// — BackupJobs: create job and list jobs and download result
export const createBackupJob = async (req, res) => {
  try {
    const { collection, format = 'json' } = req.body;
    if (!collection) return res.status(400).json({ success: false, message: 'collection is required' });
    const job = await BackupJob.create({
      collection,
      format,
      requestedBy: req.user?._id,
      requestedByName: req.user?.name || req.user?.email || 'unknown',
      status: 'pending',
    });

    try {
      await AuditLog.create({ action: 'backup:requested', performedBy: req.user?._id, performedByName: req.user?.name || req.user?.email, details: { jobId: job._id.toString(), collection, format } });
    } catch (e) { console.error('audit create failed', e); }

    // ensure worker is processing
    if (backupWorker && backupWorker.processPendingJobs) backupWorker.processPendingJobs().catch(err => console.error(err));

    res.status(201).json({ success: true, data: job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const listBackupJobs = async (req, res) => {
  try {
    const jobs = await BackupJob.find().sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: jobs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const downloadBackupJobResult = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await BackupJob.findById(id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    if (job.status !== 'completed' || !job.resultPath) return res.status(400).json({ success: false, message: 'Job is not ready' });
    const full = path.join(process.cwd(), job.resultPath);
    if (!fs.existsSync(full)) return res.status(404).json({ success: false, message: 'Result not found' });
    res.download(full, path.basename(full));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete a specific backup job
export const deleteBackupJob = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await BackupJob.findByIdAndDelete(id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    try {
      await AuditLog.create({ action: 'backup:job-deleted', performedBy: req.user?._id, performedByName: req.user?.name || req.user?.email, details: { jobId: id, collection: job.collection, status: job.status } });
    } catch (e) { /* non-fatal */ }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Clear backup jobs; optional query `status=completed|failed|done` where done means both completed and failed
export const clearBackupJobs = async (req, res) => {
  try {
    const { status } = req.query;
    let filter = {};
    if (status === 'completed') filter = { status: 'completed' };
    else if (status === 'failed') filter = { status: 'failed' };
    else if (status === 'done') filter = { status: { $in: ['completed', 'failed'] } };
    const result = await BackupJob.deleteMany(filter);
    try {
      await AuditLog.create({ action: 'backup:jobs-cleared', performedBy: req.user?._id, performedByName: req.user?.name || req.user?.email, details: { status, deletedCount: result.deletedCount } });
    } catch (e) { /* non-fatal */ }
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const resyncDeveloperFlags = async (req, res) => {
  try {
    // Only allow developers/admins via existing guard in routes (verifyToken + our checks)
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

    const users = await User.find({ $or: [{ userType: 'developer' }, { isAdmin: true }] });
    let updated = 0;
    for (const u of users) {
      let dirty = false;
      Object.keys(devFlags).forEach((k) => { if (!u[k]) { u[k] = devFlags[k]; dirty = true; } });
      if (dirty) { await u.save(); updated++; }
    }

    res.json({ success: true, updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Create an audit log entry (protected)
export const createAuditLog = async (req, res) => {
  try {
    const { action, details } = req.body || {};
    const callerId = req.user?._id || req.user?.id;
    const caller = callerId ? await User.findById(callerId) : null;
    if (!caller) return res.status(401).json({ success: false, message: 'Unauthorized' });

    // Only allow admins/developers or notification managers to create audit logs via this endpoint
    if (!(caller.isAdmin || caller.userType === 'developer' || caller.canManageNotifications || caller.canAccessDeveloper)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const entry = await AuditLog.create({ action: action || 'custom', performedBy: caller?._id, performedByName: caller?.name || caller?.email, details: details || {} });
    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    console.error('createAuditLog error', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

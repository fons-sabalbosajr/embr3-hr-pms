import mongoose from "mongoose";
import path from "path";
import dotenv from "dotenv";
import nodemailer from 'nodemailer';
import { driveList } from '../utils/googleDriveStorage.js';
import fs from 'fs';

import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import BackupJob from '../models/BackupJob.js';
import User from '../models/User.js';
import backupWorker from '../utils/backupWorker.js';
import { storageGetStream } from '../utils/storageProvider.js';
import Settings from '../models/Settings.js';

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
    const {
      page = 1,
      limit = 50,
      action,
      actions, // can be array or comma-separated string
      user,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder,
      detailsFragment, // fuzzy search fragment against details values
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    // Build filter
    const filter = {};
    // Back-compat: single action parameter
    if (action && String(action).toLowerCase() !== 'all') {
      filter.action = action;
    }
    // New: multi-action filter via actions[]=a&actions[]=b or actions=a,b
    let actionList = [];
    if (actions) {
      if (Array.isArray(actions)) actionList = actions;
      else if (typeof actions === 'string') actionList = actions.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (actionList.length > 0) {
      filter.action = { $in: actionList };
    }
    if (user && String(user).toLowerCase() !== 'all') {
      filter.performedByName = user;
    }
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    // Fuzzy "fragment" search in details: build an $expr with $objectToArray to concatenate values
    // This scans values of top-level keys inside details and does a case-insensitive regex match.
    // Note: Deeply nested objects will stringify as "[object Object]"; this is a pragmatic compromise without an index.
    let expr = null;
    if (detailsFragment && String(detailsFragment).trim().length > 0) {
      const fragment = String(detailsFragment).trim();
      expr = {
        $regexMatch: {
          input: {
            $reduce: {
              input: { $objectToArray: { $ifNull: ['$details', {}] } },
              initialValue: '',
              in: { $concat: ['$$value', ' ', { $toString: '$$this.v' }] },
            },
          },
          regex: fragment,
          options: 'i',
        },
      };
    }

    // Sorting: whitelist fields
    const sort = {};
    const allowedSort = new Set(['createdAt', 'action', 'performedByName']);
    const sortKey = allowedSort.has(String(sortBy)) ? String(sortBy) : 'createdAt';
    const order = String(sortOrder).toLowerCase() === 'ascend' || String(sortOrder).toLowerCase() === 'asc' ? 1 : -1;
    sort[sortKey] = order;

    // If details fragment is present, use aggregation to apply $expr; else simple find
    let itemsPromise, totalPromise;
    if (expr) {
      const baseMatch = Object.keys(filter).length ? [{ $match: filter }] : [];
      const pipeline = [
        ...baseMatch,
        { $match: { $expr: expr } },
        { $sort: sort },
        { $skip: skip },
        { $limit: Number(limit) },
      ];
      itemsPromise = AuditLog.aggregate(pipeline);

      const countPipeline = [
        ...baseMatch,
        { $match: { $expr: expr } },
        { $count: 'cnt' },
      ];
      totalPromise = AuditLog.aggregate(countPipeline).then((r) => (r?.[0]?.cnt || 0));
    } else {
      itemsPromise = AuditLog.find(filter).sort(sort).skip(skip).limit(Number(limit));
      totalPromise = AuditLog.countDocuments(filter);
    }

    const [items, total] = await Promise.all([itemsPromise, totalPromise]);
    res.json({ success: true, data: items, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Stream export for audit logs (CSV) with filters, suitable for very large datasets
export const exportAuditLogs = async (req, res) => {
  try {
    const {
      action,
      actions, // array or comma-separated
      user,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder,
      detailsFragment,
    } = req.query;

    // Build same filter as listAuditLogs
    const filter = {};
    if (action && String(action).toLowerCase() !== 'all') {
      filter.action = action;
    }
    let actionList = [];
    if (actions) {
      if (Array.isArray(actions)) actionList = actions;
      else if (typeof actions === 'string') actionList = actions.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (actionList.length > 0) {
      filter.action = { $in: actionList };
    }
    if (user && String(user).toLowerCase() !== 'all') {
      filter.performedByName = user;
    }
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    // Sorting
    const sort = {};
    const allowedSort = new Set(['createdAt', 'action', 'performedByName']);
    const sortKey = allowedSort.has(String(sortBy)) ? String(sortBy) : 'createdAt';
    const order = String(sortOrder).toLowerCase() === 'ascend' || String(sortOrder).toLowerCase() === 'asc' ? 1 : -1;
    sort[sortKey] = order;

    // Prepare response headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.csv"`);

    const writeCsvLine = (row) => {
      const esc = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
      const cols = [
        esc(row.action),
        esc(row.performedByName),
        esc(row.createdAt ? new Date(row.createdAt).toISOString() : ''),
        esc(JSON.stringify(row.details || {})),
      ];
      res.write(cols.join(',') + '\n');
    };

    // Header
    res.write(['"Action"', '"By"', '"CreatedAt"', '"Details"'].join(',') + '\n');

    // Stream using aggregation when detailsFragment provided; else use query cursor
    if (detailsFragment && String(detailsFragment).trim().length > 0) {
      const fragment = String(detailsFragment).trim();
      const baseMatch = Object.keys(filter).length ? [{ $match: filter }] : [];
      const pipeline = [
        ...baseMatch,
        { $match: { $expr: {
          $regexMatch: {
            input: {
              $reduce: {
                input: { $objectToArray: { $ifNull: ['$details', {}] } },
                initialValue: '',
                in: { $concat: ['$$value', ' ', { $toString: '$$this.v' }] },
              },
            },
            regex: fragment,
            options: 'i',
          }
        } } },
        { $sort: sort },
        { $project: { action: 1, performedByName: 1, createdAt: 1, details: 1 } },
      ];

      const cursor = AuditLog.aggregate(pipeline).cursor({ batchSize: 1000 }).exec();
      cursor.on('data', (doc) => writeCsvLine(doc));
      cursor.on('end', () => res.end());
      cursor.on('error', (e) => {
        try { res.status(500).end(e.message); } catch(_) { /* ignore */ }
      });
    } else {
      const cursor = AuditLog.find(filter).sort(sort).cursor();
      cursor.on('data', (doc) => writeCsvLine(doc));
      cursor.on('end', () => res.end());
      cursor.on('error', (e) => {
        try { res.status(500).end(e.message); } catch(_) { /* ignore */ }
      });
    }
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
    // Enrich requestedByName using req.user (populated by auth middleware) or lookup fallback
    let requestedByName = req.user?.name || req.user?.email || 'unknown';
    if (requestedByName === 'unknown' && req.user?.id) {
      try {
        const u = await User.findById(req.user.id).select('name email').lean();
        if (u) requestedByName = u.name || u.email || requestedByName;
      } catch (e) { /* non-fatal */ }
    }
    const job = await BackupJob.create({
      collection,
      format,
      requestedBy: req.user?._id,
      requestedByName,
      status: 'pending',
      provider: (process.env.STORAGE_PROVIDER || 'local').toLowerCase(),
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
    // Ensure requestedByName is filled if missing
    const enriched = [];
    for (const j of jobs) {
      if (!j.requestedByName && j.requestedBy) {
        try {
          const u = await User.findById(j.requestedBy).select('name email').lean();
          if (u) j.requestedByName = u.name || u.email || 'unknown';
        } catch (e) { /* non-fatal */ }
      }
      enriched.push(j);
    }
    res.json({ success: true, data: enriched });
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
    // Drive-backed job
    if ((job.provider || (process.env.STORAGE_PROVIDER || 'local')).toLowerCase() === 'drive' || job.resultPath.startsWith('drive:')) {
      const fileName = job.resultPath.replace(/^drive:/, '') || `backup-${id}.${job.format==='csv'?'csv':'json'}`;
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      const stream = await storageGetStream(job.fileId || fileName);
      stream.on('error', () => res.status(404).end());
      stream.pipe(res);
      return;
    }
    // Local fallback
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

export const testSmtp = async (req, res) => {
  try {
    // Prefer provided payload; fall back to stored settings
    const body = req.body || {};
    const s = await Settings.getSingleton();
    const smtp = { ...(s?.smtp || {}), ...body };

    // Accept both SMTP_* and EMAIL_* env fallbacks
    const envHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
    const envPort = process.env.SMTP_PORT || process.env.EMAIL_PORT;
    const envSecure = process.env.SMTP_SECURE || process.env.EMAIL_SECURE;

    const host = smtp.host || envHost;
    let port = Number(smtp.port != null ? smtp.port : (envPort || 0));
    let secure = smtp.secure != null ? Boolean(smtp.secure) : (String(envSecure || '').toLowerCase() === 'true');

    // Auto-detect secure based on conventional ports if not explicitly set correctly
    if (!Number.isFinite(port) || port <= 0) port = 587; // default to 587 STARTTLS
    if (smtp.secure == null) {
      if (port === 465) secure = true; // implicit TLS
      if (port === 587 || port === 25) secure = false; // STARTTLS/plain, upgrade when available
    } else {
      // If user-specified but mismatched, coerce to sane defaults to avoid OpenSSL wrong version errors
      if (port === 465 && secure === false) secure = true;
      if ((port === 587 || port === 25) && secure === true) secure = false;
    }
    const user = smtp.user || process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS; // password stays in env for safety

    if (!user || !pass) {
      return res.status(400).json({ success: false, message: 'EMAIL_USER and EMAIL_PASS must be set on server to test SMTP.' });
    }
    if (!host || !port) {
      return res.status(400).json({ success: false, message: 'SMTP host and port are required.' });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure, // true for 465 (implicit TLS), false for 587/25 (STARTTLS)
      auth: { user, pass },
      tls: {
        // Ensure SNI is set; helps some providers when behind proxies
        servername: host,
        // Enforce modern TLS; most providers require >= TLSv1.2
        minVersion: 'TLSv1.2',
      },
    });

    // Validate SMTP connection first
    await transporter.verify();

    // Send a test message to the caller's email if available; else to SMTP user
    const to = req.user?.email || user;
    const fromName = smtp.fromName || (s?.general?.appName || 'EMBR3 System');
    const fromEmail = smtp.fromEmail || user;
    const from = `${fromName} <${fromEmail}>`;

    const info = await transporter.sendMail({
      from,
      to,
      subject: 'SMTP Test • EMBR3 System',
      text: 'This is a test email to verify SMTP configuration.',
    });

    res.json({ success: true, messageId: info.messageId || null, envelope: info.envelope || null, to });
  } catch (err) {
    const msg = err?.message || 'SMTP test failed';
    let hint;
    const lower = String(msg).toLowerCase();
    if (lower.includes('wrong version number') || lower.includes('epreto') || lower.includes('ssl3_get_record')) {
      hint = 'This usually means the Secure (TLS) setting does not match the port. Use port 465 with Secure ON, or port 587 with Secure OFF.';
    } else if (lower.includes('self signed certificate') || lower.includes('unable to verify the first certificate')) {
      hint = 'Certificate validation failed. If using a self-signed cert, configure your SMTP server with a valid certificate.';
    }
    res.status(500).json({ success: false, message: msg, hint });
  }
};

export const testDrive = async (req, res) => {
  try {
    // Attempt to list up to 10 files in configured folder
    const files = await driveList({ pageSize: 10 });
    res.json({ success: true, count: files.length, sample: files });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Drive test failed' });
  }
};

export const getDeploymentNotes = async (_req, res) => {
  try {
    // Try multiple candidate paths so this works whether server starts in repo root or server folder
    const explicit = process.env.DEPLOYMENT_NOTES_PATH;
    const candidates = [
      explicit,
      path.join(process.cwd(), 'DEPLOYMENT-UAT.md'),
      path.join(process.cwd(), '..', 'DEPLOYMENT-UAT.md'),
      path.join(process.cwd(), '..', '..', 'DEPLOYMENT-UAT.md'),
    ].filter(Boolean);

    let foundPath = null;
    for (const p of candidates) {
      try { if (fs.existsSync(p)) { foundPath = p; break; } } catch(_) {}
    }
    if (!foundPath) {
      return res.status(404).json({ success: false, message: 'DEPLOYMENT-UAT.md not found. Set DEPLOYMENT_NOTES_PATH to override.' });
    }
    const content = fs.readFileSync(foundPath, 'utf8');
    res.json({ success: true, content });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Failed to load deployment notes' });
  }
};

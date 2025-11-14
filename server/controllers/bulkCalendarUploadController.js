import csv from 'csv-parser';
import multer from 'multer';
import { Readable } from 'stream';
import dayjs from 'dayjs';
import LocalHoliday from '../models/LocalHoliday.js';
import Suspension from '../models/Suspension.js';
import AuditLog from '../models/AuditLog.js';

// Multer setup (memory storage)
export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }).single('file');

function parseDate(val) {
  if (!val) return null;
  const d = dayjs(val.trim());
  return d.isValid() ? d.toDate() : null;
}

export const bulkUploadLocalHolidays = async (req, res) => {
  try {
    let rows = [];
    if (Array.isArray(req.body?.rows)) {
      rows = req.body.rows;
    } else {
      if (!req.file) return res.status(400).json({ success:false, message:'File required (CSV). Or send JSON {rows:[...]}' });
      const buffer = req.file.buffer;
      await new Promise((resolve, reject) => {
        const readable = Readable.from(buffer.toString('utf8'));
        readable
          .pipe(csv())
          .on('data', (data) => rows.push(data))
          .on('end', resolve)
          .on('error', reject);
      });
    }

    const docs = [];
    const invalidRows = [];
    rows.forEach((r, idx) => {
      const name = r.name || r.Name || r.Holiday || r.holiday;
      const date = parseDate(r.date || r.Date || r.startDate || r.StartDate || r.from || r.From);
      if (!name) {
        invalidRows.push({ index: idx, row: r, reason: 'Missing name' });
        return;
      }
      if (!date) {
        invalidRows.push({ index: idx, row: r, reason: 'Invalid/missing date' });
        return;
      }
      const endDate = parseDate(r.endDate || r.EndDate || r.to || r.To);
      docs.push({ name, date, endDate, location: r.location || r.Location, notes: r.notes || r.Notes, createdBy: req.user?.id });
    });

    if (!docs.length) return res.status(400).json({ success:false, message:'No valid holiday rows found.', invalidRows });
    const inserted = await LocalHoliday.insertMany(docs);

    // Audit log
    try {
      await AuditLog.create({
        action: 'bulk-upload:local-holidays',
        performedBy: req.user?.id,
        details: { inserted: inserted.length, skipped: invalidRows.length }
      });
    } catch (logErr) { console.error('AuditLog failed (local holidays bulk)', logErr); }

    res.json({ success:true, count: inserted.length, skipped: invalidRows.length, invalidRows: invalidRows.slice(0,50) });
  } catch (e) {
    console.error('bulkUploadLocalHolidays error', e);
    res.status(500).json({ success:false, message:e.message });
  }
};

export const bulkUploadSuspensions = async (req, res) => {
  try {
    let rows = [];
    if (Array.isArray(req.body?.rows)) {
      rows = req.body.rows;
    } else {
      if (!req.file) return res.status(400).json({ success:false, message:'File required (CSV). Or send JSON {rows:[...]}' });
      const buffer = req.file.buffer;
      await new Promise((resolve, reject) => {
        const readable = Readable.from(buffer.toString('utf8'));
        readable
          .pipe(csv())
          .on('data', (data) => rows.push(data))
          .on('end', resolve)
          .on('error', reject);
      });
    }

    const docs = [];
    const invalidRows = [];
    rows.forEach((r, idx) => {
      const title = r.title || r.Title || r.Subject || r.subject;
      const date = parseDate(r.date || r.Date || r.startDate || r.StartDate || r.from || r.From);
      if (!title) { invalidRows.push({ index: idx, row: r, reason: 'Missing title' }); return; }
      if (!date) { invalidRows.push({ index: idx, row: r, reason: 'Invalid/missing date' }); return; }
      const endDate = parseDate(r.endDate || r.EndDate || r.to || r.To);
      const active = String(r.active ?? r.Active ?? 'true').toLowerCase() !== 'false';
      docs.push({
        title,
        date,
        endDate,
        scope: r.scope || r.Scope || 'Local',
        location: r.location || r.Location,
        referenceType: r.referenceType || r.ReferenceType || 'Memorandum',
        referenceNo: r.referenceNo || r.ReferenceNo,
        notes: r.notes || r.Notes,
        active,
        createdBy: req.user?.id
      });
    });

    if (!docs.length) return res.status(400).json({ success:false, message:'No valid suspension rows found.', invalidRows });
    const inserted = await Suspension.insertMany(docs);

    // Audit log
    try {
      await AuditLog.create({
        action: 'bulk-upload:suspensions',
        performedBy: req.user?.id,
        details: { inserted: inserted.length, skipped: invalidRows.length }
      });
    } catch (logErr) { console.error('AuditLog failed (suspensions bulk)', logErr); }

    res.json({ success:true, count: inserted.length, skipped: invalidRows.length, invalidRows: invalidRows.slice(0,50) });
  } catch (e) {
    console.error('bulkUploadSuspensions error', e);
    res.status(500).json({ success:false, message:e.message });
  }
};

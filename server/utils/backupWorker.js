import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import BackupJob from '../models/BackupJob.js';
import AuditLog from '../models/AuditLog.js';
import { storageUpload } from './storageProvider.js';

const USE_DRIVE = (process.env.STORAGE_PROVIDER || 'local').toLowerCase() === 'drive';
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'backups');
if (!USE_DRIVE && !fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

let running = false;

export async function processPendingJobs() {
  if (running) return;
  running = true;
  try {
    // find one pending job
    const job = await BackupJob.findOne({ status: 'pending' }).sort({ createdAt: 1 });
    if (!job) return;

    job.status = 'working';
    await job.save();

    const db = mongoose.connection.db;
    const collection = db.collection(job.collection);

  const filename = `${job.collection}-${Date.now()}.${job.format === 'csv' ? 'csv' : 'json'}`;
  const filepath = USE_DRIVE ? null : path.join(UPLOADS_DIR, filename);

    try {
      if (job.format === 'csv') {
        // build header from first 200 docs
        const sample = await collection.find({}).limit(200).toArray();
        const allKeys = new Set();
        sample.forEach(d => Object.keys(d).forEach(k => { if (k !== '_id') allKeys.add(k); }));
        const keys = Array.from(allKeys);
        if (USE_DRIVE) {
          // accumulate into memory buffer (adequate for moderate size); for huge sets stream to temp file
          const chunks = [];
          const append = (str) => chunks.push(Buffer.from(str, 'utf8'));
          append(keys.map(k => `"${k}"`).join(',') + '\n');
          const cursor = collection.find({});
          for await (const doc of cursor) {
            const row = keys.map(k => {
              let val = doc[k];
              if (val === null || val === undefined) return '""';
              if (typeof val === 'object') { try { val = JSON.stringify(val); } catch (e) { val = String(val); } }
              const s = String(val).replace(/"/g, '""');
              return `"${s}"`;
            });
            append(row.join(',') + '\n');
          }
          const buffer = Buffer.concat(chunks);
          const up = await storageUpload({ buffer, filename, mimeType: 'text/csv', subdir: 'backups' });
          job.fileId = up?.id || job.fileId;
        } else {
          const writeStream = fs.createWriteStream(filepath, { encoding: 'utf8' });
          const toCsvField = (val) => {
            if (val === null || val === undefined) return '';
            if (typeof val === 'object') { try { val = JSON.stringify(val); } catch (e) { val = String(val); } }
            const s = String(val);
            return `"${s.replace(/"/g, '""')}"`;
          };
            writeStream.write(keys.map(k => `"${k}"`).join(',') + '\n');
            const cursor = collection.find({});
            for await (const doc of cursor) {
              const row = keys.map(k => toCsvField(doc[k]));
              writeStream.write(row.join(',') + '\n');
            }
            await new Promise((res) => writeStream.end(res));
        }
      } else {
        const cursor = collection.find({});
        const out = [];
        for await (const doc of cursor) { out.push(doc); }
        const jsonBuffer = Buffer.from(JSON.stringify(out, null, 2), 'utf8');
        if (USE_DRIVE) {
          const up = await storageUpload({ buffer: jsonBuffer, filename, mimeType: 'application/json', subdir: 'backups' });
          job.fileId = up?.id || job.fileId;
        } else {
          fs.writeFileSync(filepath, jsonBuffer, 'utf8');
        }
      }

      job.status = 'completed';
      if (USE_DRIVE) {
        job.resultPath = `drive:${filename}`; // marker; could store file id if storageUpload returns it
      } else {
        job.resultPath = path.relative(process.cwd(), filepath);
      }
      await job.save();

      // record audit
      try {
        await AuditLog.create({
          action: 'backup:completed',
          performedBy: job.requestedBy,
          performedByName: job.requestedByName,
          details: { jobId: job._id.toString(), collection: job.collection, format: job.format, path: job.resultPath }
        });
      } catch (e) { console.error('Failed to create audit for backup', e); }
    } catch (err) {
      job.status = 'failed';
      job.error = err?.message || String(err);
      await job.save();
      console.error('Backup job failed', err);
    }
  } finally {
    running = false;
    // schedule next check
    setTimeout(() => processPendingJobs().catch(err => console.error(err)), 1500);
  }
}

// start processing immediately
setTimeout(() => processPendingJobs().catch(err => console.error(err)), 500);

export default { processPendingJobs };

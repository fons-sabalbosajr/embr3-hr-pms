import mongoose from 'mongoose';

const backupJobSchema = new mongoose.Schema({
  collection: { type: String, required: true },
  format: { type: String, enum: ['json','csv'], default: 'json' },
  status: { type: String, enum: ['pending','working','completed','failed'], default: 'pending' },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  requestedByName: { type: String },
  resultPath: { type: String },
  error: { type: String },
  meta: { type: Object },
}, { timestamps: true, suppressReservedKeysWarning: true });

export default mongoose.model('BackupJob', backupJobSchema);

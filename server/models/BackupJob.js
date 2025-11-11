import mongoose from 'mongoose';

const backupJobSchema = new mongoose.Schema({
  collection: { type: String, required: true },
  format: { type: String, enum: ['json','csv'], default: 'json' },
  status: { type: String, enum: ['pending','working','completed','failed'], default: 'pending' },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  requestedByName: { type: String },
  resultPath: { type: String }, // local path or marker like drive:<filename>
  provider: { type: String, enum: ['local','drive'], default: 'local' },
  fileId: { type: String }, // optional: store Drive file id for direct retrieval
  error: { type: String },
  meta: { type: Object },
}, { timestamps: true, suppressReservedKeysWarning: true });

export default mongoose.model('BackupJob', backupJobSchema);

import mongoose from 'mongoose';

const auditSchema = new mongoose.Schema({
  action: { type: String, required: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  performedByName: { type: String },
  details: { type: Object },
}, { timestamps: true });

export default mongoose.model('AuditLog', auditSchema);

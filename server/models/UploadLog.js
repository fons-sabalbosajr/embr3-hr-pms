import mongoose from 'mongoose';

const uploadLogSchema = new mongoose.Schema({
  uploadedBy: { type: String },  // or ObjectId if using users
  timestamp: { type: Date, default: Date.now },
  totalRecords: Number,
  fileType: String
}, { timestamps: true });

const UploadLog = mongoose.model('UploadLog', uploadLogSchema);
export default UploadLog;

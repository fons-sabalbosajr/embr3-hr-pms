import mongoose from 'mongoose';

const bugReportSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    pageUrl: { type: String },
    userAgent: { type: String },
    reporterEmail: { type: String },
    reporterName: { type: String },
    employeeId: { type: String },
    ip: { type: String },
    status: { type: String, enum: ['open', 'resolved'], default: 'open' },
    hasScreenshot: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

bugReportSchema.index({ createdAt: -1 });
bugReportSchema.index({ title: 'text', description: 'text', reporterEmail: 'text', reporterName: 'text' });

export default mongoose.model('BugReport', bugReportSchema);

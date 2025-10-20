import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String },
  type: { type: String, default: 'generic' },
  hidden: { type: Boolean, default: false },
  // When false, the notification's data/body should not be shown in UIs
  dataVisible: { type: Boolean, default: true },
  meta: { type: Object },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model('Notification', notificationSchema);

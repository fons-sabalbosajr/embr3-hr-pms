import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Encrypted content (AES-256-GCM)
    content: { type: String, required: true },
    // Encryption metadata
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    // Message type
    type: {
      type: String,
      enum: ["text", "image", "file", "system"],
      default: "text",
    },
    // @mentions (user IDs tagged in this message)
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    // Priority flag
    priority: {
      type: String,
      enum: ["normal", "urgent"],
      default: "normal",
    },
    // File attachment metadata (if type is file/image)
    fileName: { type: String },
    fileUrl: { type: String },
    fileSize: { type: Number },
    // Read receipts: array of { userId, readAt }
    readBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        readAt: { type: Date, default: Date.now },
      },
    ],
    // Soft delete
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });

export default mongoose.model("Message", messageSchema);

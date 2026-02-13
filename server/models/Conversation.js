import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    // Participants: references to User
    participants: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ],
    // Optional group chat metadata
    isGroup: { type: Boolean, default: false },
    groupName: { type: String, trim: true },
    groupAvatar: { type: String },
    // Creator of the group (optional, only for group chats)
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // Confidential / private conversation — only participants can see it
    isConfidential: { type: Boolean, default: false },
    // Cached last message for fast list rendering
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
    lastMessageAt: { type: Date },
  },
  { timestamps: true }
);

// Compound index for fast lookup of 1-on-1 conversations
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });

export default mongoose.model("Conversation", conversationSchema);

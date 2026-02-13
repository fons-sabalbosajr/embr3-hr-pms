import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { encrypt, decrypt } from "../utils/messageCrypto.js";
import { emitToUser, getSocketInstance } from "../socket.js";
import { sendMessageNotificationEmail } from "../utils/messageEmail.js";

// ────────────────────────────────── helpers ──────────────────────────────────

const decryptMessage = (msg) => {
  try {
    const plain = decrypt(msg.content, msg.iv, msg.tag);
    return { ...msg.toObject?.() || msg, content: plain };
  } catch {
    return { ...msg.toObject?.() || msg, content: "[unable to decrypt]" };
  }
};

const populateParticipants =
  "name username email avatarUrl isOnline lastSeenAt";

// ────────────────────────── Conversations CRUD ───────────────────────────────

/**
 * GET /api/messages/conversations
 * List conversations for the authenticated user, sorted by most recent message.
 */
export const getConversations = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate("participants", populateParticipants)
      .populate("lastMessage")
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .lean();

    // Decrypt last message preview
    const result = conversations.map((c) => {
      if (c.lastMessage) {
        c.lastMessage = decryptMessage(c.lastMessage);
      }
      return c;
    });

    // Attach unread count per conversation
    for (const conv of result) {
      const unread = await Message.countDocuments({
        conversation: conv._id,
        sender: { $ne: userId },
        "readBy.user": { $ne: userId },
        deletedFor: { $ne: userId },
        isDeleted: false,
      });
      conv.unreadCount = unread;
    }

    res.json(result);
  } catch (err) {
    console.error("[Messages] getConversations error:", err);
    res.status(500).json({ message: "Failed to load conversations" });
  }
};

/**
 * POST /api/messages/conversations
 * Create or find a 1-on-1 conversation, or create a group.
 * Body: { participantIds: [userId, ...], isGroup?, groupName?, isConfidential? }
 */
export const createConversation = async (req, res) => {
  try {
    const userId = String(req.user.id || req.user._id);
    let { participantIds = [], isGroup = false, groupName, isConfidential = false } = req.body;

    // Ensure creator is always included
    if (!participantIds.includes(userId)) participantIds.push(userId);

    if (participantIds.length < 2) {
      return res
        .status(400)
        .json({ message: "A conversation needs at least 2 participants" });
    }

    // For 1-on-1: find existing conversation with exact same participants
    if (!isGroup && participantIds.length === 2) {
      const existing = await Conversation.findOne({
        isGroup: false,
        participants: { $all: participantIds, $size: 2 },
      })
        .populate("participants", populateParticipants)
        .populate("lastMessage");

      if (existing) {
        const conv = existing.toObject();
        if (conv.lastMessage) conv.lastMessage = decryptMessage(conv.lastMessage);
        return res.json(conv);
      }
    }

    const conversation = await Conversation.create({
      participants: participantIds,
      isGroup,
      groupName: isGroup ? groupName || "Group Chat" : undefined,
      isConfidential: !!isConfidential,
      createdBy: userId,
    });

    const populated = await Conversation.findById(conversation._id)
      .populate("participants", populateParticipants)
      .lean();
    populated.unreadCount = 0;

    // Notify other participants via socket
    participantIds.forEach((pid) => {
      if (pid !== userId) {
        emitToUser(pid, "conversation-created", populated);
      }
    });

    res.status(201).json(populated);
  } catch (err) {
    console.error("[Messages] createConversation error:", err);
    res.status(500).json({ message: "Failed to create conversation" });
  }
};

/**
 * PATCH /api/messages/conversations/:conversationId
 * Update group conversation (rename, add/remove members, toggle confidential).
 */
export const updateConversation = async (req, res) => {
  try {
    const userId = String(req.user.id || req.user._id);
    const { conversationId } = req.params;
    const { groupName, addParticipants, removeParticipants, isConfidential } = req.body;

    const conv = await Conversation.findById(conversationId);
    if (!conv) return res.status(404).json({ message: "Conversation not found" });
    if (!conv.participants.map(String).includes(userId)) {
      return res.status(403).json({ message: "Not a participant" });
    }

    if (groupName !== undefined && conv.isGroup) conv.groupName = groupName;
    if (isConfidential !== undefined) conv.isConfidential = !!isConfidential;

    if (Array.isArray(addParticipants) && conv.isGroup) {
      for (const pid of addParticipants) {
        if (!conv.participants.map(String).includes(String(pid))) {
          conv.participants.push(pid);
        }
      }
    }
    if (Array.isArray(removeParticipants) && conv.isGroup) {
      conv.participants = conv.participants.filter(
        (p) => !removeParticipants.map(String).includes(String(p))
      );
    }

    await conv.save();
    const populated = await Conversation.findById(conv._id)
      .populate("participants", populateParticipants)
      .populate("lastMessage")
      .lean();
    if (populated.lastMessage) populated.lastMessage = decryptMessage(populated.lastMessage);

    // Notify all participants
    conv.participants.forEach((pid) => {
      emitToUser(String(pid), "conversation-updated", populated);
    });

    res.json(populated);
  } catch (err) {
    console.error("[Messages] updateConversation error:", err);
    res.status(500).json({ message: "Failed to update conversation" });
  }
};

// ──────────────────────────── Messages CRUD ──────────────────────────────────

/**
 * GET /api/messages/conversations/:conversationId/messages?page=1&limit=50
 */
export const getMessages = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { conversationId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    // Verify user is participant
    const conv = await Conversation.findById(conversationId);
    if (!conv || !conv.participants.map(String).includes(String(userId))) {
      return res.status(403).json({ message: "Not a participant" });
    }

    const total = await Message.countDocuments({
      conversation: conversationId,
      deletedFor: { $ne: userId },
      isDeleted: false,
    });

    const messages = await Message.find({
      conversation: conversationId,
      deletedFor: { $ne: userId },
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("sender", "name username avatarUrl")
      .lean();

    const decrypted = messages.map(decryptMessage).reverse();

    res.json({ messages: decrypted, total, page, limit });
  } catch (err) {
    console.error("[Messages] getMessages error:", err);
    res.status(500).json({ message: "Failed to load messages" });
  }
};

/**
 * POST /api/messages/conversations/:conversationId/messages
 * Body: { content, type? }
 */
export const sendMessage = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { conversationId } = req.params;
    const { content, type = "text", mentions = [], priority = "normal" } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Message content is required" });
    }

    // Verify participation
    const conv = await Conversation.findById(conversationId).populate(
      "participants",
      "name email isOnline"
    );
    if (!conv || !conv.participants.map((p) => String(p._id)).includes(String(userId))) {
      return res.status(403).json({ message: "Not a participant" });
    }

    // Encrypt
    const { ciphertext, iv, tag } = encrypt(content.trim());

    const message = await Message.create({
      conversation: conversationId,
      sender: userId,
      content: ciphertext,
      iv,
      tag,
      type,
      mentions: Array.isArray(mentions) ? mentions : [],
      priority: ["normal", "urgent"].includes(priority) ? priority : "normal",
      readBy: [{ user: userId, readAt: new Date() }],
    });

    // Update conversation's last message
    conv.lastMessage = message._id;
    conv.lastMessageAt = message.createdAt;
    await conv.save();

    // Populate sender for response
    const populated = await Message.findById(message._id)
      .populate("sender", "name username avatarUrl")
      .lean();

    const decrypted = decryptMessage(populated);

    // Real-time push to all participants
    const participantIds = conv.participants.map((p) => String(p._id));
    participantIds.forEach((pid) => {
      emitToUser(pid, "new-message", {
        conversationId,
        message: decrypted,
      });
    });

    // Email notification for offline participants
    const senderName = req.user.name || req.user.username || "Someone";
    const offlineParticipants = conv.participants.filter(
      (p) => String(p._id) !== String(userId) && !p.isOnline && p.email
    );
    for (const participant of offlineParticipants) {
      sendMessageNotificationEmail({
        to: participant.email,
        recipientName: participant.name,
        senderName,
        preview: content.trim().substring(0, 120),
        conversationId,
      }).catch((err) =>
        console.error("[Messages] Email notification failed:", err.message)
      );
    }

    res.status(201).json(decrypted);
  } catch (err) {
    console.error("[Messages] sendMessage error:", err);
    res.status(500).json({ message: "Failed to send message" });
  }
};

/**
 * PATCH /api/messages/conversations/:conversationId/read
 * Mark all messages in a conversation as read for the current user.
 */
export const markAsRead = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { conversationId } = req.params;

    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: userId },
        "readBy.user": { $ne: userId },
      },
      { $push: { readBy: { user: userId, readAt: new Date() } } }
    );

    // Notify sender(s) about read receipt
    const conv = await Conversation.findById(conversationId);
    if (conv) {
      conv.participants.forEach((pid) => {
        if (String(pid) !== String(userId)) {
          emitToUser(String(pid), "messages-read", {
            conversationId,
            readBy: userId,
          });
        }
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[Messages] markAsRead error:", err);
    res.status(500).json({ message: "Failed to mark as read" });
  }
};

/**
 * GET /api/messages/unread-count
 * Total unread messages across all conversations.
 */
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const conversations = await Conversation.find({ participants: userId }).select("_id");
    const convIds = conversations.map((c) => c._id);

    const count = await Message.countDocuments({
      conversation: { $in: convIds },
      sender: { $ne: userId },
      "readBy.user": { $ne: userId },
      isDeleted: false,
    });

    res.json({ count });
  } catch (err) {
    console.error("[Messages] getUnreadCount error:", err);
    res.status(500).json({ message: "Failed to get unread count" });
  }
};

/**
 * GET /api/messages/users
 * List all HR staff users available for messaging.
 */
export const getMessageableUsers = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const users = await User.find({
      _id: { $ne: userId },
      isVerified: true,
    })
      .select("name username email avatarUrl isOnline lastSeenAt designation position")
      .sort({ name: 1 })
      .lean();
    res.json(users);
  } catch (err) {
    console.error("[Messages] getMessageableUsers error:", err);
    res.status(500).json({ message: "Failed to load users" });
  }
};

/**
 * DELETE /api/messages/:messageId
 * Soft-delete a message (only for sender, or hide for current user).
 */
export const deleteMessage = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { messageId } = req.params;

    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ message: "Message not found" });

    if (String(msg.sender) === String(userId)) {
      // Sender can delete for everyone
      msg.isDeleted = true;
      msg.content = "";
      msg.iv = "";
      msg.tag = "";
      await msg.save({ validateBeforeSave: false });

      // Notify conversation participants
      const conv = await Conversation.findById(msg.conversation);
      if (conv) {
        conv.participants.forEach((pid) => {
          emitToUser(String(pid), "message-deleted", {
            conversationId: String(msg.conversation),
            messageId: String(msg._id),
          });
        });
      }
    } else {
      // Non-sender can only hide for themselves
      msg.deletedFor.push(userId);
      await msg.save();
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[Messages] deleteMessage error:", err);
    res.status(500).json({ message: "Failed to delete message" });
  }
};

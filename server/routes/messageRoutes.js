import { Router } from "express";
import verifyToken from "../middleware/authMiddleware.js";
import {
  getConversations,
  createConversation,
  updateConversation,
  getMessages,
  sendMessage,
  markAsRead,
  getUnreadCount,
  getMessageableUsers,
  deleteMessage,
  archiveConversation,
  deleteConversation,
} from "../controllers/messageController.js";

const router = Router();

// All messaging routes require authentication
router.use(verifyToken);

// Users available to message
router.get("/users", getMessageableUsers);

// Unread count (badge)
router.get("/unread-count", getUnreadCount);

// Conversations
router.get("/conversations", getConversations);
router.post("/conversations", createConversation);
router.patch("/conversations/:conversationId", updateConversation);

// Archive / delete a conversation (per-user)
router.patch("/conversations/:conversationId/archive", archiveConversation);
router.delete("/conversations/:conversationId", deleteConversation);

// Messages within a conversation
router.get("/conversations/:conversationId/messages", getMessages);
router.post("/conversations/:conversationId/messages", sendMessage);
router.patch("/conversations/:conversationId/read", markAsRead);

// Delete a message
router.delete("/:messageId", deleteMessage);

export default router;

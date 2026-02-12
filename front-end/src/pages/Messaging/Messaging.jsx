import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Avatar,
  Badge,
  Button,
  Input,
  Modal,
  Spin,
  Tooltip,
  Typography,
  Grid,
  Empty,
  Popconfirm,
  Dropdown,
  Tag,
} from "antd";
import {
  SendOutlined,
  MessageOutlined,
  PlusOutlined,
  ArrowLeftOutlined,
  SearchOutlined,
  UserOutlined,
  DeleteOutlined,
  CheckOutlined,
  CheckCircleFilled,
  MoreOutlined,
  InfoCircleOutlined,
  CopyOutlined,
  InboxOutlined,
  MailOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import axiosInstance from "../../api/axiosInstance";
import socket from "../../../utils/socket";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import calendar from "dayjs/plugin/calendar";
import UserAvatar from "../../components/common/UserAvatar";
import "./Messaging.css";

dayjs.extend(relativeTime);
dayjs.extend(calendar);

const { Text } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

const Messaging = ({ currentUser, tab = "inbox" }) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  // ── State ──────────────────────────────────────────────────────────────
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalMessages, setTotalMessages] = useState(0);
  const [showSidebar, setShowSidebar] = useState(true);
  const [typingUsers, setTypingUsers] = useState({});
  const [hoveredMsgId, setHoveredMsgId] = useState(null);

  // Drafts (local state)
  const [drafts, setDrafts] = useState(() => {
    try {
      const saved = localStorage.getItem("msg_drafts");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Conversation detail modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // New conversation modal
  const [newConvModalOpen, setNewConvModalOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);

  const messagesEndRef = useRef(null);
  const chatBodyRef = useRef(null);
  const typingTimerRef = useRef(null);
  const userId = currentUser?._id;

  // Persist drafts
  useEffect(() => {
    localStorage.setItem("msg_drafts", JSON.stringify(drafts));
  }, [drafts]);

  // ── API Calls ──────────────────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      setLoadingConvs(true);
      const { data } = await axiosInstance.get("/messages/conversations");
      setConversations(data);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  const fetchMessages = useCallback(
    async (conversationId, pageNum = 1, append = false) => {
      try {
        setLoadingMsgs(true);
        const { data } = await axiosInstance.get(
          `/messages/conversations/${conversationId}/messages?page=${pageNum}&limit=50`
        );
        if (append) {
          setMessages((prev) => [...data.messages, ...prev]);
        } else {
          setMessages(data.messages);
        }
        setTotalMessages(data.total);
        setHasMore(pageNum * 50 < data.total);
        setPage(pageNum);
      } catch (err) {
        console.error("Failed to load messages:", err);
      } finally {
        setLoadingMsgs(false);
      }
    },
    []
  );

  const markRead = useCallback(async (conversationId) => {
    try {
      await axiosInstance.patch(
        `/messages/conversations/${conversationId}/read`
      );
      setConversations((prev) =>
        prev.map((c) =>
          c._id === conversationId ? { ...c, unreadCount: 0 } : c
        )
      );
    } catch {}
  }, []);

  // ── Mount ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchConversations();
    const params = new URLSearchParams(window.location.search);
    const cid = params.get("cid");
    if (cid) openConversation(cid);
  }, []);

  // Socket events
  useEffect(() => {
    const handleNewMessage = ({ conversationId, message: msg }) => {
      setConversations((prev) => {
        const existing = prev.find((c) => c._id === conversationId);
        if (existing) {
          const updated = prev.map((c) =>
            c._id === conversationId
              ? {
                  ...c,
                  lastMessage: msg,
                  lastMessageAt: msg.createdAt,
                  unreadCount:
                    conversationId === activeConvId
                      ? 0
                      : (c.unreadCount || 0) + 1,
                }
              : c
          );
          return updated.sort(
            (a, b) =>
              new Date(b.lastMessageAt || b.updatedAt) -
              new Date(a.lastMessageAt || a.updatedAt)
          );
        }
        fetchConversations();
        return prev;
      });
      if (conversationId === activeConvId) {
        setMessages((prev) => {
          if (prev.find((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
        if (msg.sender?._id !== userId) markRead(conversationId);
      }
    };

    const handleConversationCreated = (conv) => {
      setConversations((prev) => {
        if (prev.find((c) => c._id === conv._id)) return prev;
        return [conv, ...prev];
      });
    };

    const handleTyping = ({ conversationId, userId: typerId, userName }) => {
      if (typerId === userId) return;
      setTypingUsers((prev) => ({ ...prev, [conversationId]: { userName, typerId } }));
    };

    const handleStopTyping = ({ conversationId, userId: typerId }) => {
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (next[conversationId]?.typerId === typerId) delete next[conversationId];
        return next;
      });
    };

    const handleMessageDeleted = ({ conversationId, messageId }) => {
      if (conversationId === activeConvId) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === messageId ? { ...m, isDeleted: true, content: "" } : m
          )
        );
      }
    };

    const handleMessagesRead = ({ conversationId, readBy }) => {
      if (conversationId === activeConvId) {
        setMessages((prev) =>
          prev.map((m) => {
            if (
              String(m.sender?._id || m.sender) === userId &&
              !(m.readBy || []).find((r) => String(r.user) === String(readBy))
            ) {
              return { ...m, readBy: [...(m.readBy || []), { user: readBy, readAt: new Date() }] };
            }
            return m;
          })
        );
      }
    };

    socket.on("new-message", handleNewMessage);
    socket.on("conversation-created", handleConversationCreated);
    socket.on("user-typing", handleTyping);
    socket.on("user-stop-typing", handleStopTyping);
    socket.on("message-deleted", handleMessageDeleted);
    socket.on("messages-read", handleMessagesRead);

    return () => {
      socket.off("new-message", handleNewMessage);
      socket.off("conversation-created", handleConversationCreated);
      socket.off("user-typing", handleTyping);
      socket.off("user-stop-typing", handleStopTyping);
      socket.off("message-deleted", handleMessageDeleted);
      socket.off("messages-read", handleMessagesRead);
    };
  }, [activeConvId, userId]);

  // Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // ── Actions ────────────────────────────────────────────────────────────
  const openConversation = async (convId) => {
    if (activeConvId) socket.emit("leave-conversation", activeConvId);
    setActiveConvId(convId);
    setMessages([]);
    setPage(1);
    socket.emit("join-conversation", convId);
    await fetchMessages(convId, 1);
    markRead(convId);
    if (isMobile) setShowSidebar(false);
  };

  const loadMoreMessages = async () => {
    if (!activeConvId || !hasMore || loadingMsgs) return;
    const prevScrollHeight = chatBodyRef.current?.scrollHeight || 0;
    await fetchMessages(activeConvId, page + 1, true);
    requestAnimationFrame(() => {
      if (chatBodyRef.current) {
        chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight - prevScrollHeight;
      }
    });
  };

  const handleSend = async () => {
    if (!messageText.trim() || !activeConvId || sending) return;
    const text = messageText.trim();
    setMessageText("");
    setSending(true);
    socket.emit("stop-typing", { conversationId: activeConvId, userId });
    // Remove draft for this conversation
    setDrafts((prev) => prev.filter((d) => d.conversationId !== activeConvId));
    try {
      await axiosInstance.post(
        `/messages/conversations/${activeConvId}/messages`,
        { content: text }
      );
    } catch (err) {
      console.error("Failed to send:", err);
      setMessageText(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTypingEmit = () => {
    if (!activeConvId) return;
    socket.emit("typing", { conversationId: activeConvId, userId, userName: currentUser?.name });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.emit("stop-typing", { conversationId: activeConvId, userId });
    }, 2000);
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await axiosInstance.delete(`/messages/${messageId}`);
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const handleCopyMessage = (content) => {
    navigator.clipboard.writeText(content).catch(() => {});
  };

  const handleSaveDraft = () => {
    if (!messageText.trim() || !activeConvId) return;
    const convName = activeConv ? getConversationName(activeConv) : "Unknown";
    setDrafts((prev) => {
      const filtered = prev.filter((d) => d.conversationId !== activeConvId);
      return [
        ...filtered,
        {
          conversationId: activeConvId,
          content: messageText.trim(),
          recipientName: convName,
          savedAt: new Date().toISOString(),
        },
      ];
    });
    setMessageText("");
  };

  const handleDeleteDraft = (conversationId) => {
    setDrafts((prev) => prev.filter((d) => d.conversationId !== conversationId));
  };

  const handleUseDraft = (draft) => {
    openConversation(draft.conversationId);
    setMessageText(draft.content);
  };

  // ── New Conversation ───────────────────────────────────────────────────
  const openNewConvModal = async () => {
    setNewConvModalOpen(true);
    setSelectedUserIds([]);
    setUserSearch("");
    setLoadingUsers(true);
    try {
      const { data } = await axiosInstance.get("/messages/users");
      setAvailableUsers(data);
    } catch {} finally {
      setLoadingUsers(false);
    }
  };

  const handleCreateConversation = async () => {
    if (!selectedUserIds.length) return;
    try {
      const isGroup = selectedUserIds.length > 1;
      const { data } = await axiosInstance.post("/messages/conversations", {
        participantIds: selectedUserIds,
        isGroup,
        groupName: isGroup ? "Group Chat" : undefined,
      });
      setNewConvModalOpen(false);
      setConversations((prev) => {
        if (prev.find((c) => c._id === data._id)) return prev;
        return [data, ...prev];
      });
      openConversation(data._id);
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  };

  const toggleUserSelection = (uid) => {
    setSelectedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  // ── Helpers ────────────────────────────────────────────────────────────
  const getConversationName = (conv) => {
    if (conv.isGroup) return conv.groupName || "Group Chat";
    const other = (conv.participants || []).find((p) => String(p._id) !== userId);
    return other?.name || "Unknown";
  };

  const getConversationAvatar = (conv) => {
    if (conv.isGroup) return null;
    return (conv.participants || []).find((p) => String(p._id) !== userId);
  };

  const getOtherParticipant = (conv) => {
    if (!conv) return null;
    return (conv.participants || []).find((p) => String(p._id) !== userId);
  };

  const formatLastActive = (user) => {
    if (!user) return "Offline";
    if (user.isOnline) return "Active now";
    if (user.lastSeenAt) {
      const d = dayjs(user.lastSeenAt);
      const diffMins = dayjs().diff(d, "minute");
      if (diffMins < 1) return "Active just now";
      if (diffMins < 60) return `Active ${diffMins}m ago`;
      const diffHours = dayjs().diff(d, "hour");
      if (diffHours < 24) return `Active ${diffHours}h ago`;
      return `Last active ${d.format("MMM D, h:mm A")}`;
    }
    return "Offline";
  };

  const formatTime = (date) => {
    const d = dayjs(date);
    const now = dayjs();
    if (d.isSame(now, "day")) return d.format("h:mm A");
    if (d.isSame(now.subtract(1, "day"), "day")) return "Yesterday";
    if (d.isSame(now, "year")) return d.format("MMM D");
    return d.format("MMM D, YYYY");
  };

  const formatMessageTime = (date) => dayjs(date).format("h:mm A");

  const groupMessagesByDate = (msgs) => {
    const groups = [];
    let currentDate = null;
    for (const msg of msgs) {
      const dateStr = dayjs(msg.createdAt).format("MMMM D, YYYY");
      if (dateStr !== currentDate) {
        currentDate = dateStr;
        groups.push({ type: "date", date: dateStr });
      }
      groups.push({ type: "message", data: msg });
    }
    return groups;
  };

  const activeConv = conversations.find((c) => c._id === activeConvId);

  // ── Tab filtering ──────────────────────────────────────────────────────
  const filteredConversations = (() => {
    if (tab === "sent") {
      // Show conversations where last message was sent by current user
      return conversations.filter(
        (c) =>
          c.lastMessage &&
          String(c.lastMessage.sender?._id || c.lastMessage.sender) === userId
      );
    }
    if (tab === "drafts") return []; // Drafts use a separate list
    // inbox: all conversations (default)
    return conversations;
  })();

  const filteredUsers = availableUsers.filter(
    (u) =>
      u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.designation?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const tabConfig = {
    inbox: { icon: <InboxOutlined />, title: "Inbox" },
    sent: { icon: <MailOutlined />, title: "Sent" },
    drafts: { icon: <FileTextOutlined />, title: "Drafts" },
  };

  // ── Message action menu ────────────────────────────────────────────────
  const getMessageActions = (msg, isMine) => {
    const items = [
      {
        key: "copy",
        icon: <CopyOutlined />,
        label: "Copy text",
        onClick: () => handleCopyMessage(msg.content),
      },
      {
        key: "info",
        icon: <InfoCircleOutlined />,
        label: `Sent ${dayjs(msg.createdAt).format("MMM D, YYYY h:mm A")}`,
        disabled: true,
      },
    ];
    if (isMine && !msg.isDeleted) {
      items.push({ type: "divider" });
      items.push({
        key: "delete",
        icon: <DeleteOutlined />,
        label: "Delete message",
        danger: true,
        onClick: () => {}, // handled via Popconfirm wrapper
      });
    }
    return items;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="messaging-container">
      {/* ─── Sidebar ──────────────────────────────────────────────────── */}
      <div className={`msg-sidebar ${isMobile && !showSidebar ? "hidden" : ""}`}>
        <div className="msg-sidebar-header">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {tabConfig[tab]?.icon}
              {tabConfig[tab]?.title || "Messages"}
            </h3>
            <Tooltip title="New conversation">
              <Button
                type="primary"
                shape="circle"
                icon={<PlusOutlined />}
                size="small"
                onClick={openNewConvModal}
              />
            </Tooltip>
          </div>
          {tab !== "drafts" && (
            <Input
              className="msg-sidebar-search"
              placeholder="Search conversations..."
              prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
              allowClear
              size="middle"
              onChange={(e) => {
                const q = e.target.value.toLowerCase();
                if (!q) { fetchConversations(); return; }
                setConversations((prev) =>
                  prev.filter((c) => getConversationName(c).toLowerCase().includes(q))
                );
              }}
            />
          )}
        </div>

        <div className="msg-sidebar-list">
          {tab === "drafts" ? (
            drafts.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No drafts saved"
                style={{ marginTop: 60 }}
              />
            ) : (
              drafts.map((draft, idx) => (
                <div
                  key={idx}
                  className="msg-conv-item"
                  onClick={() => handleUseDraft(draft)}
                >
                  <Avatar
                    icon={<FileTextOutlined />}
                    style={{ backgroundColor: "#faad14", flexShrink: 0 }}
                    size={42}
                  />
                  <div className="msg-conv-meta">
                    <div className="msg-conv-name">{draft.recipientName}</div>
                    <div className="msg-conv-preview">{draft.content}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="msg-conv-time">{formatTime(draft.savedAt)}</div>
                    <Tooltip title="Delete draft">
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                        onClick={(e) => { e.stopPropagation(); handleDeleteDraft(draft.conversationId); }}
                        style={{ marginTop: 4 }}
                      />
                    </Tooltip>
                  </div>
                </div>
              ))
            )
          ) : loadingConvs ? (
            <div style={{ textAlign: "center", padding: 40 }}><Spin /></div>
          ) : filteredConversations.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={tab === "sent" ? "No sent messages" : "No conversations yet"}
              style={{ marginTop: 60 }}
            />
          ) : (
            filteredConversations.map((conv) => {
              const other = getConversationAvatar(conv);
              const otherUser = getOtherParticipant(conv);
              return (
                <div
                  key={conv._id}
                  className={`msg-conv-item ${conv._id === activeConvId ? "active" : ""}`}
                  onClick={() => openConversation(conv._id)}
                >
                  <div style={{ position: "relative" }}>
                    {conv.isGroup ? (
                      <Avatar style={{ backgroundColor: "#1677ff" }} icon={<TeamIcon />} size={42} />
                    ) : other ? (
                      <UserAvatar user={other} size={42} />
                    ) : (
                      <Avatar icon={<UserOutlined />} size={42} />
                    )}
                    {!conv.isGroup && otherUser?.isOnline && (
                      <span className="msg-online-dot" />
                    )}
                  </div>
                  <div className="msg-conv-meta">
                    <div className="msg-conv-name">{getConversationName(conv)}</div>
                    <div className="msg-conv-preview">
                      {conv.lastMessage
                        ? conv.lastMessage.isDeleted
                          ? "Message deleted"
                          : conv.lastMessage.content
                        : "No messages yet"}
                    </div>
                    {!conv.isGroup && otherUser && !otherUser.isOnline && otherUser.lastSeenAt && (
                      <div className="msg-conv-last-active">
                        <ClockCircleOutlined style={{ fontSize: 10, marginRight: 3 }} />
                        {formatLastActive(otherUser)}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {conv.lastMessageAt && (
                      <div className="msg-conv-time">{formatTime(conv.lastMessageAt)}</div>
                    )}
                    {conv.unreadCount > 0 && (
                      <Badge count={conv.unreadCount} size="small" className="msg-conv-unread" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─── Chat Window ──────────────────────────────────────────────── */}
      <div className={`msg-chat ${isMobile && showSidebar ? "hidden" : ""}`}>
        {!activeConvId ? (
          <div className="msg-empty-state">
            <MessageOutlined />
            <h3>Welcome to HR Messaging</h3>
            <p>Select a conversation or start a new one to begin chatting with your colleagues.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="msg-chat-header">
              <Button
                className="msg-back-btn"
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={() => {
                  setShowSidebar(true);
                  setActiveConvId(null);
                  socket.emit("leave-conversation", activeConvId);
                }}
              />
              <div style={{ position: "relative" }}>
                {activeConv && !activeConv.isGroup && getOtherParticipant(activeConv) ? (
                  <UserAvatar user={getOtherParticipant(activeConv)} size={40} />
                ) : (
                  <Avatar style={{ backgroundColor: "#1677ff" }} icon={<UserOutlined />} size={40} />
                )}
                {activeConv && !activeConv.isGroup && getOtherParticipant(activeConv)?.isOnline && (
                  <span className="msg-online-dot" style={{ bottom: 1, right: 1 }} />
                )}
              </div>
              <div className="msg-chat-header-info">
                <div className="msg-chat-header-name">
                  {activeConv ? getConversationName(activeConv) : ""}
                </div>
                {activeConv && !activeConv.isGroup && (
                  <div className={`msg-chat-header-status ${getOtherParticipant(activeConv)?.isOnline ? "online" : ""}`}>
                    {formatLastActive(getOtherParticipant(activeConv))}
                  </div>
                )}
                {activeConv?.isGroup && (
                  <div className="msg-chat-header-status">
                    {(activeConv.participants || []).length} members
                  </div>
                )}
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                <Tooltip title="Conversation details">
                  <Button
                    type="text"
                    icon={<InfoCircleOutlined />}
                    onClick={() => setDetailModalOpen(true)}
                  />
                </Tooltip>
              </div>
            </div>

            {/* Messages body */}
            <div className="msg-chat-body" ref={chatBodyRef}>
              {hasMore && (
                <div className="msg-load-more">
                  <Button size="small" type="link" onClick={loadMoreMessages} loading={loadingMsgs}>
                    Load earlier messages
                  </Button>
                </div>
              )}

              {loadingMsgs && page === 1 ? (
                <div style={{ textAlign: "center", padding: 40 }}><Spin /></div>
              ) : messages.length === 0 ? (
                <div className="msg-empty-state" style={{ flex: 1 }}>
                  <MessageOutlined style={{ fontSize: 48 }} />
                  <p>No messages yet. Say hello!</p>
                </div>
              ) : (
                groupMessagesByDate(messages).map((item, idx) => {
                  if (item.type === "date") {
                    return (
                      <div key={`date-${idx}`} className="msg-date-divider">
                        <span>{item.date}</span>
                      </div>
                    );
                  }
                  const msg = item.data;
                  const isMine = String(msg.sender?._id || msg.sender) === userId;
                  const isRead = isMine && (msg.readBy || []).some((r) => String(r.user) !== userId);
                  const isHovered = hoveredMsgId === msg._id;

                  return (
                    <div
                      key={msg._id}
                      className={`msg-bubble-row ${isMine ? "mine" : ""}`}
                      onMouseEnter={() => setHoveredMsgId(msg._id)}
                      onMouseLeave={() => setHoveredMsgId(null)}
                    >
                      {!isMine && activeConv?.isGroup && msg.sender?.avatarUrl && (
                        <UserAvatar user={msg.sender} size={28} />
                      )}
                      <div className={`msg-bubble ${isMine ? "mine" : "theirs"}`}>
                        {!isMine && activeConv?.isGroup && (
                          <div className="msg-bubble-sender">{msg.sender?.name}</div>
                        )}
                        {msg.isDeleted ? (
                          <span className="msg-bubble-deleted">This message was deleted</span>
                        ) : (
                          <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
                        )}
                        <div className="msg-bubble-footer">
                          <span className="msg-bubble-time">{formatMessageTime(msg.createdAt)}</span>
                          {isMine && (
                            <span className="msg-read-icon">
                              {isRead ? (
                                <CheckCircleFilled style={{ fontSize: 11, color: isMine ? "rgba(255,255,255,0.7)" : "#52c41a" }} />
                              ) : (
                                <CheckOutlined style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }} />
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons — appear on hover outside the bubble */}
                      {isHovered && !msg.isDeleted && (
                        <div className={`msg-bubble-actions ${isMine ? "mine" : "theirs"}`}>
                          <Tooltip title="Copy">
                            <Button
                              type="text"
                              size="small"
                              icon={<CopyOutlined />}
                              className="msg-action-btn"
                              onClick={() => handleCopyMessage(msg.content)}
                            />
                          </Tooltip>
                          {isMine && (
                            <Popconfirm
                              title="Delete this message?"
                              description="This will be deleted for everyone."
                              onConfirm={() => handleDeleteMessage(msg._id)}
                              okText="Delete"
                              okButtonProps={{ danger: true }}
                              cancelText="Cancel"
                              placement={isMine ? "topLeft" : "topRight"}
                            >
                              <Tooltip title="Delete">
                                <Button
                                  type="text"
                                  size="small"
                                  danger
                                  icon={<DeleteOutlined />}
                                  className="msg-action-btn"
                                />
                              </Tooltip>
                            </Popconfirm>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Typing indicator */}
            <div className="msg-typing-indicator" style={{ padding: "0 24px" }}>
              {typingUsers[activeConvId] && (
                <span>{typingUsers[activeConvId].userName} is typing...</span>
              )}
            </div>

            {/* Input */}
            <div className="msg-chat-input">
              <TextArea
                placeholder="Type a message..."
                autoSize={{ minRows: 1, maxRows: 4 }}
                value={messageText}
                onChange={(e) => { setMessageText(e.target.value); handleTypingEmit(); }}
                onKeyDown={handleKeyDown}
                disabled={sending}
              />
              {messageText.trim() && (
                <Tooltip title="Save as draft">
                  <Button
                    type="text"
                    icon={<FileTextOutlined />}
                    onClick={handleSaveDraft}
                    className="msg-draft-btn"
                  />
                </Tooltip>
              )}
              <Button
                className="msg-send-btn"
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSend}
                loading={sending}
                disabled={!messageText.trim()}
              />
            </div>
          </>
        )}
      </div>

      {/* ─── Conversation Details Modal ────────────────────────────────── */}
      <Modal
        title="Conversation Details"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={400}
      >
        {activeConv && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              {activeConv.isGroup ? (
                <Avatar style={{ backgroundColor: "#1677ff" }} icon={<TeamIcon />} size={64} />
              ) : getOtherParticipant(activeConv) ? (
                <UserAvatar user={getOtherParticipant(activeConv)} size={64} />
              ) : (
                <Avatar icon={<UserOutlined />} size={64} />
              )}
              <h3 style={{ margin: "12px 0 4px" }}>{getConversationName(activeConv)}</h3>
              {!activeConv.isGroup && getOtherParticipant(activeConv) && (
                <>
                  <Tag color={getOtherParticipant(activeConv)?.isOnline ? "green" : "default"}>
                    {getOtherParticipant(activeConv)?.isOnline ? "Online" : "Offline"}
                  </Tag>
                  <div style={{ marginTop: 8, color: "#8c8c8c", fontSize: 12 }}>
                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                    {formatLastActive(getOtherParticipant(activeConv))}
                  </div>
                  {getOtherParticipant(activeConv)?.email && (
                    <div style={{ marginTop: 6, color: "#595959", fontSize: 13 }}>
                      {getOtherParticipant(activeConv).email}
                    </div>
                  )}
                  {getOtherParticipant(activeConv)?.designation && (
                    <div style={{ color: "#8c8c8c", fontSize: 12, marginTop: 2 }}>
                      {getOtherParticipant(activeConv).designation}
                    </div>
                  )}
                </>
              )}
            </div>

            {activeConv.isGroup && (
              <div>
                <Text strong style={{ fontSize: 13 }}>Participants ({(activeConv.participants || []).length})</Text>
                <div style={{ marginTop: 10, maxHeight: 240, overflowY: "auto" }}>
                  {(activeConv.participants || []).map((p) => (
                    <div key={p._id} className="msg-user-list-item" style={{ cursor: "default" }}>
                      <div style={{ position: "relative" }}>
                        <UserAvatar user={p} size={32} />
                        {p.isOnline && <span className="msg-online-dot" style={{ width: 8, height: 8, bottom: 0, right: 0 }} />}
                      </div>
                      <div className="msg-user-list-info">
                        <div className="msg-user-list-name">
                          {p.name}
                          {String(p._id) === userId && <Tag style={{ marginLeft: 6 }} color="blue">You</Tag>}
                        </div>
                        <div className="msg-user-list-role">{formatLastActive(p)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 16, padding: "12px 0", borderTop: "1px solid #f0f0f0" }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Conversation started {dayjs(activeConv.createdAt).format("MMMM D, YYYY")}
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {totalMessages} messages total
              </Text>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── New Conversation Modal ───────────────────────────────────── */}
      <Modal
        title="New Conversation"
        open={newConvModalOpen}
        onCancel={() => setNewConvModalOpen(false)}
        onOk={handleCreateConversation}
        okText="Start Chat"
        okButtonProps={{ disabled: !selectedUserIds.length }}
        width={460}
      >
        <Input
          placeholder="Search staff by name, email, or designation..."
          prefix={<SearchOutlined />}
          allowClear
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          style={{ marginBottom: 16 }}
        />
        {selectedUserIds.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {selectedUserIds.length} selected
              {selectedUserIds.length > 1 && " (group chat)"}
            </Text>
          </div>
        )}
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {loadingUsers ? (
            <div style={{ textAlign: "center", padding: 40 }}><Spin /></div>
          ) : filteredUsers.length === 0 ? (
            <Empty description="No staff found" />
          ) : (
            filteredUsers.map((u) => (
              <div
                key={u._id}
                className={`msg-user-list-item ${selectedUserIds.includes(u._id) ? "selected" : ""}`}
                onClick={() => toggleUserSelection(u._id)}
              >
                <div style={{ position: "relative" }}>
                  <UserAvatar user={u} size={36} />
                  {u.isOnline && <span className="msg-online-dot" style={{ width: 8, height: 8 }} />}
                </div>
                <div className="msg-user-list-info">
                  <div className="msg-user-list-name">{u.name}</div>
                  <div className="msg-user-list-role">
                    {u.designation || u.position || u.email}
                    <span style={{ marginLeft: 8, fontSize: 11, color: "#bfbfbf" }}>
                      {formatLastActive(u)}
                    </span>
                  </div>
                </div>
                {selectedUserIds.includes(u._id) && (
                  <CheckOutlined style={{ color: "#1677ff" }} />
                )}
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
};

// Simple group icon
const TeamIcon = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor">
    <path d="M16 11a3 3 0 10-6 0 3 3 0 006 0zm-8-1a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm12 0a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM13 16c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm-7.5 1.5c-.73.42-1.5 1.07-1.5 2.5v2H2v-2c0-1.52 2-2.5 3.5-2.5zm15 0c1.5 0 3.5.98 3.5 2.5v2h-2v-2c0-1.43-.77-2.08-1.5-2.5z" />
  </svg>
);

export default Messaging;

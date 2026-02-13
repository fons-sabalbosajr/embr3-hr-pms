import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  Tag,
  Switch,
  Dropdown,
  Divider,
  Select,
  message as antMsg,
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
  InfoCircleOutlined,
  CopyOutlined,
  InboxOutlined,
  MailOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  LockOutlined,
  TeamOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  UserAddOutlined,
  MoreOutlined,
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
  const [searchQuery, setSearchQuery] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);

  // Drafts (local state)
  const [drafts, setDrafts] = useState(() => {
    try {
      const saved = localStorage.getItem("msg_drafts");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Conversation detail / edit modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editGroupName, setEditGroupName] = useState("");
  const [editConfidential, setEditConfidential] = useState(false);

  // New conversation modal
  const [newConvModalOpen, setNewConvModalOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newIsConfidential, setNewIsConfidential] = useState(false);

  // Add members modal
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState("");
  const [addMemberIds, setAddMemberIds] = useState([]);

  // Mention state
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionAnchorIdx, setMentionAnchorIdx] = useState(-1);

  const messagesEndRef = useRef(null);
  const chatBodyRef = useRef(null);
  const typingTimerRef = useRef(null);
  const inputRef = useRef(null);
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
      await axiosInstance.patch(`/messages/conversations/${conversationId}/read`);
      setConversations((prev) =>
        prev.map((c) => (c._id === conversationId ? { ...c, unreadCount: 0 } : c))
      );
    } catch {}
  }, []);

  const fetchAvailableUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const { data } = await axiosInstance.get("/messages/users");
      setAvailableUsers(data);
    } catch {} finally {
      setLoadingUsers(false);
    }
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
                  unreadCount: conversationId === activeConvId ? 0 : (c.unreadCount || 0) + 1,
                }
              : c
          );
          return updated.sort(
            (a, b) => new Date(b.lastMessageAt || b.updatedAt) - new Date(a.lastMessageAt || a.updatedAt)
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

    const handleConversationUpdated = (conv) => {
      setConversations((prev) => prev.map((c) => (c._id === conv._id ? { ...conv, unreadCount: c.unreadCount } : c)));
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
          prev.map((m) => (m._id === messageId ? { ...m, isDeleted: true, content: "" } : m))
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
    socket.on("conversation-updated", handleConversationUpdated);
    socket.on("user-typing", handleTyping);
    socket.on("user-stop-typing", handleStopTyping);
    socket.on("message-deleted", handleMessageDeleted);
    socket.on("messages-read", handleMessagesRead);

    return () => {
      socket.off("new-message", handleNewMessage);
      socket.off("conversation-created", handleConversationCreated);
      socket.off("conversation-updated", handleConversationUpdated);
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

  const activeConv = conversations.find((c) => c._id === activeConvId);

  // ── Actions ────────────────────────────────────────────────────────────
  const openConversation = async (convId) => {
    if (activeConvId) socket.emit("leave-conversation", activeConvId);
    setActiveConvId(convId);
    setMessages([]);
    setPage(1);
    setIsUrgent(false);
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

  // Extract @mentions from text
  const extractMentions = (text) => {
    const mentionRegex = /@(\w[\w\s]*?)(?=\s@|\s|$)/g;
    const found = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      const name = match[1].trim().toLowerCase();
      const participant = (activeConv?.participants || []).find(
        (p) => p.name?.toLowerCase() === name || p.username?.toLowerCase() === name
      );
      if (participant) found.push(String(participant._id));
    }
    return [...new Set(found)];
  };

  const handleSend = async () => {
    if (!messageText.trim() || !activeConvId || sending) return;
    const text = messageText.trim();
    setMessageText("");
    setMentionOpen(false);
    setSending(true);
    socket.emit("stop-typing", { conversationId: activeConvId, userId });
    setDrafts((prev) => prev.filter((d) => d.conversationId !== activeConvId));
    try {
      const mentions = extractMentions(text);
      await axiosInstance.post(`/messages/conversations/${activeConvId}/messages`, {
        content: text,
        mentions,
        priority: isUrgent ? "urgent" : "normal",
      });
      setIsUrgent(false);
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

  const handleInputChange = (e) => {
    const val = e.target.value;
    setMessageText(val);
    handleTypingEmit();

    // Detect @mention trigger
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.substring(0, cursorPos);
    const atIdx = textBeforeCursor.lastIndexOf("@");
    if (atIdx >= 0 && (atIdx === 0 || textBeforeCursor[atIdx - 1] === " ")) {
      const query = textBeforeCursor.substring(atIdx + 1);
      if (!query.includes(" ") || query.length < 20) {
        setMentionOpen(true);
        setMentionQuery(query.toLowerCase());
        setMentionAnchorIdx(atIdx);
        return;
      }
    }
    setMentionOpen(false);
  };

  const insertMention = (user) => {
    const before = messageText.substring(0, mentionAnchorIdx);
    const after = messageText.substring(mentionAnchorIdx + mentionQuery.length + 1);
    const mention = `@${user.name} `;
    setMessageText(before + mention + after);
    setMentionOpen(false);
    inputRef.current?.focus();
  };

  const mentionCandidates = useMemo(() => {
    if (!mentionOpen || !activeConv) return [];
    return (activeConv.participants || [])
      .filter((p) => String(p._id) !== userId)
      .filter(
        (p) =>
          p.name?.toLowerCase().includes(mentionQuery) ||
          p.username?.toLowerCase().includes(mentionQuery)
      )
      .slice(0, 6);
  }, [mentionOpen, mentionQuery, activeConv, userId]);

  const handleDeleteMessage = async (messageId) => {
    try {
      await axiosInstance.delete(`/messages/${messageId}`);
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const handleCopyMessage = (content) => {
    navigator.clipboard.writeText(content).catch(() => {});
    antMsg.success("Copied to clipboard");
  };

  const handleSaveDraft = () => {
    if (!messageText.trim() || !activeConvId) return;
    const convName = activeConv ? getConversationName(activeConv) : "Unknown";
    setDrafts((prev) => {
      const filtered = prev.filter((d) => d.conversationId !== activeConvId);
      return [
        ...filtered,
        { conversationId: activeConvId, content: messageText.trim(), recipientName: convName, savedAt: new Date().toISOString() },
      ];
    });
    setMessageText("");
    antMsg.success("Draft saved");
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
    setNewGroupName("");
    setNewIsConfidential(false);
    fetchAvailableUsers();
  };

  const handleCreateConversation = async () => {
    if (!selectedUserIds.length) return;
    try {
      const isGroup = selectedUserIds.length > 1;
      const { data } = await axiosInstance.post("/messages/conversations", {
        participantIds: selectedUserIds,
        isGroup,
        groupName: isGroup ? newGroupName || "Group Chat" : undefined,
        isConfidential: newIsConfidential,
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

  // ── Group management ───────────────────────────────────────────────────
  const handleUpdateGroup = async () => {
    if (!activeConvId) return;
    try {
      await axiosInstance.patch(`/messages/conversations/${activeConvId}`, {
        groupName: editGroupName,
        isConfidential: editConfidential,
      });
      antMsg.success("Conversation updated");
      setDetailModalOpen(false);
      fetchConversations();
    } catch (err) {
      antMsg.error("Failed to update conversation");
    }
  };

  const handleAddMembers = async () => {
    if (!activeConvId || !addMemberIds.length) return;
    try {
      await axiosInstance.patch(`/messages/conversations/${activeConvId}`, {
        addParticipants: addMemberIds,
      });
      antMsg.success("Members added");
      setAddMembersOpen(false);
      setAddMemberIds([]);
      fetchConversations();
    } catch {
      antMsg.error("Failed to add members");
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!activeConvId) return;
    try {
      await axiosInstance.patch(`/messages/conversations/${activeConvId}`, {
        removeParticipants: [memberId],
      });
      antMsg.success("Member removed");
      fetchConversations();
    } catch {
      antMsg.error("Failed to remove member");
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────
  const getConversationName = (conv) => {
    if (conv.isGroup) return conv.groupName || "Group Chat";
    const other = (conv.participants || []).find((p) => String(p._id) !== userId);
    return other?.name || "Unknown";
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
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = dayjs().diff(d, "hour");
      if (diffHours < 24) return `${diffHours}h ago`;
      return d.format("MMM D, h:mm A");
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

  // Render message content with highlighted @mentions
  const renderContent = (content) => {
    if (!content) return null;
    const parts = content.split(/(@\w[\w\s]*?)(?=\s@|\s|$)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        const name = part.substring(1).trim().toLowerCase();
        const isParticipant = (activeConv?.participants || []).some(
          (p) => p.name?.toLowerCase() === name || p.username?.toLowerCase() === name
        );
        if (isParticipant) {
          return (
            <span key={i} className="msg-mention">
              {part}
            </span>
          );
        }
      }
      return part;
    });
  };

  // ── Tab / search filtering ─────────────────────────────────────────────
  const filteredConversations = useMemo(() => {
    let list = conversations;
    if (tab === "sent") {
      list = list.filter(
        (c) => c.lastMessage && String(c.lastMessage.sender?._id || c.lastMessage.sender) === userId
      );
    }
    if (tab === "drafts") return [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) => {
        const name = getConversationName(c).toLowerCase();
        const preview = c.lastMessage?.content?.toLowerCase() || "";
        return name.includes(q) || preview.includes(q);
      });
    }
    return list;
  }, [conversations, tab, searchQuery, userId]);

  const filteredUsers = useMemo(() => {
    return availableUsers.filter(
      (u) =>
        u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.designation?.toLowerCase().includes(userSearch.toLowerCase())
    );
  }, [availableUsers, userSearch]);

  const addMemberCandidates = useMemo(() => {
    const currentIds = (activeConv?.participants || []).map((p) => String(p._id));
    return availableUsers
      .filter((u) => !currentIds.includes(String(u._id)))
      .filter(
        (u) =>
          u.name?.toLowerCase().includes(addMemberSearch.toLowerCase()) ||
          u.email?.toLowerCase().includes(addMemberSearch.toLowerCase())
      );
  }, [availableUsers, activeConv, addMemberSearch]);

  const tabConfig = {
    inbox: { icon: <InboxOutlined />, title: "Inbox" },
    sent: { icon: <MailOutlined />, title: "Sent" },
    drafts: { icon: <FileTextOutlined />, title: "Drafts" },
  };

  // ═══════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="messaging-container">
      {/* ─── Sidebar ──────────────────────────────────────────────────── */}
      <div className={`msg-sidebar ${isMobile && !showSidebar ? "hidden" : ""}`}>
        <div className="msg-sidebar-header">
          <div className="msg-sidebar-header-row">
            <h3>
              {tabConfig[tab]?.icon}
              <span style={{ marginLeft: 8 }}>{tabConfig[tab]?.title || "Messages"}</span>
            </h3>
            <Tooltip title="New conversation">
              <Button type="primary" shape="circle" icon={<PlusOutlined />} size="small" onClick={openNewConvModal} />
            </Tooltip>
          </div>
          {tab !== "drafts" && (
            <Input
              className="msg-sidebar-search"
              placeholder="Search conversations..."
              prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
              allowClear
              size="middle"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          )}
        </div>

        <div className="msg-sidebar-list">
          {tab === "drafts" ? (
            drafts.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No drafts saved" style={{ marginTop: 60 }} />
            ) : (
              drafts.map((draft, idx) => (
                <div key={idx} className="msg-conv-item" onClick={() => handleUseDraft(draft)}>
                  <Avatar icon={<FileTextOutlined />} style={{ backgroundColor: "#faad14", flexShrink: 0 }} size={42} />
                  <div className="msg-conv-meta">
                    <div className="msg-conv-name">{draft.recipientName}</div>
                    <div className="msg-conv-preview">{draft.content}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="msg-conv-time">{formatTime(draft.savedAt)}</div>
                    <Tooltip title="Delete draft">
                      <Button
                        type="text" size="small" danger icon={<DeleteOutlined style={{ fontSize: 12 }} />}
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
              description={searchQuery ? "No results found" : tab === "sent" ? "No sent messages" : "No conversations yet"}
              style={{ marginTop: 60 }}
            />
          ) : (
            filteredConversations.map((conv) => {
              const other = getOtherParticipant(conv);
              return (
                <div
                  key={conv._id}
                  className={`msg-conv-item ${conv._id === activeConvId ? "active" : ""}`}
                  onClick={() => openConversation(conv._id)}
                >
                  <div className="msg-conv-avatar-wrap">
                    {conv.isGroup ? (
                      <Avatar className="msg-group-avatar" icon={<TeamOutlined />} size={42} />
                    ) : other ? (
                      <UserAvatar user={other} size={42} />
                    ) : (
                      <Avatar icon={<UserOutlined />} size={42} />
                    )}
                    {!conv.isGroup && other?.isOnline && <span className="msg-online-dot" />}
                  </div>
                  <div className="msg-conv-meta">
                    <div className="msg-conv-name">
                      {conv.isConfidential && <LockOutlined style={{ fontSize: 11, marginRight: 4, color: "#faad14" }} />}
                      {getConversationName(conv)}
                      {conv.isGroup && (
                        <span className="msg-conv-badge">{(conv.participants || []).length}</span>
                      )}
                    </div>
                    <div className="msg-conv-preview">
                      {conv.lastMessage
                        ? conv.lastMessage.isDeleted
                          ? "Message deleted"
                          : conv.lastMessage.priority === "urgent"
                          ? `🔴 ${conv.lastMessage.content}`
                          : conv.lastMessage.content
                        : "No messages yet"}
                    </div>
                    {!conv.isGroup && other && !other.isOnline && other.lastSeenAt && (
                      <div className="msg-conv-last-active">
                        <ClockCircleOutlined style={{ fontSize: 10, marginRight: 3 }} />
                        {formatLastActive(other)}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {conv.lastMessageAt && <div className="msg-conv-time">{formatTime(conv.lastMessageAt)}</div>}
                    {conv.unreadCount > 0 && <Badge count={conv.unreadCount} size="small" className="msg-conv-unread" />}
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
            <div className="msg-empty-icon"><MessageOutlined /></div>
            <h3>Welcome to Messaging</h3>
            <p>Select a conversation or start a new one to begin chatting with your colleagues.</p>
            <Button type="primary" icon={<PlusOutlined />} onClick={openNewConvModal} style={{ marginTop: 12 }}>
              New Conversation
            </Button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="msg-chat-header">
              <Button className="msg-back-btn" type="text" icon={<ArrowLeftOutlined />}
                onClick={() => { setShowSidebar(true); setActiveConvId(null); socket.emit("leave-conversation", activeConvId); }}
              />
              <div className="msg-conv-avatar-wrap">
                {activeConv && !activeConv.isGroup && getOtherParticipant(activeConv) ? (
                  <UserAvatar user={getOtherParticipant(activeConv)} size={40} />
                ) : (
                  <Avatar className="msg-group-avatar" icon={activeConv?.isGroup ? <TeamOutlined /> : <UserOutlined />} size={40} />
                )}
                {activeConv && !activeConv.isGroup && getOtherParticipant(activeConv)?.isOnline && (
                  <span className="msg-online-dot" style={{ bottom: 1, right: 1 }} />
                )}
              </div>
              <div className="msg-chat-header-info">
                <div className="msg-chat-header-name">
                  {activeConv?.isConfidential && <LockOutlined style={{ fontSize: 12, marginRight: 4, color: "#faad14" }} />}
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
                    {activeConv.isConfidential && " • Confidential"}
                  </div>
                )}
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                {activeConv?.isGroup && (
                  <Tooltip title="Add members">
                    <Button type="text" icon={<UserAddOutlined />}
                      onClick={() => { setAddMembersOpen(true); setAddMemberSearch(""); setAddMemberIds([]); fetchAvailableUsers(); }}
                    />
                  </Tooltip>
                )}
                <Tooltip title="Conversation details">
                  <Button type="text" icon={<InfoCircleOutlined />}
                    onClick={() => {
                      setDetailModalOpen(true);
                      setEditGroupName(activeConv?.groupName || "");
                      setEditConfidential(activeConv?.isConfidential || false);
                    }}
                  />
                </Tooltip>
              </div>
            </div>

            {/* Confidential banner */}
            {activeConv?.isConfidential && (
              <div className="msg-confidential-banner">
                <LockOutlined /> This is a confidential conversation. Messages are private to participants only.
              </div>
            )}

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
                      <div key={`date-${idx}`} className="msg-date-divider"><span>{item.date}</span></div>
                    );
                  }
                  const msg = item.data;
                  const isMine = String(msg.sender?._id || msg.sender) === userId;
                  const isRead = isMine && (msg.readBy || []).some((r) => String(r.user) !== userId);
                  const isHovered = hoveredMsgId === msg._id;
                  const isMentioned = (msg.mentions || []).map(String).includes(userId);

                  return (
                    <div
                      key={msg._id}
                      className={`msg-bubble-row ${isMine ? "mine" : ""}`}
                      onMouseEnter={() => setHoveredMsgId(msg._id)}
                      onMouseLeave={() => setHoveredMsgId(null)}
                    >
                      {!isMine && activeConv?.isGroup && (
                        <UserAvatar user={msg.sender} size={28} />
                      )}
                      <div className={`msg-bubble ${isMine ? "mine" : "theirs"} ${msg.priority === "urgent" ? "urgent" : ""} ${isMentioned ? "mentioned" : ""}`}>
                        {msg.priority === "urgent" && (
                          <div className="msg-urgent-label"><ExclamationCircleOutlined /> Urgent</div>
                        )}
                        {!isMine && activeConv?.isGroup && (
                          <div className="msg-bubble-sender">{msg.sender?.name}</div>
                        )}
                        {msg.isDeleted ? (
                          <span className="msg-bubble-deleted">This message was deleted</span>
                        ) : (
                          <div className="msg-bubble-content">{renderContent(msg.content)}</div>
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

                      {isHovered && !msg.isDeleted && (
                        <div className={`msg-bubble-actions ${isMine ? "mine" : "theirs"}`}>
                          <Tooltip title="Copy">
                            <Button type="text" size="small" icon={<CopyOutlined />} className="msg-action-btn"
                              onClick={() => handleCopyMessage(msg.content)}
                            />
                          </Tooltip>
                          {isMine && (
                            <Popconfirm
                              title="Delete this message?" description="This will be deleted for everyone."
                              onConfirm={() => handleDeleteMessage(msg._id)} okText="Delete" okButtonProps={{ danger: true }}
                              cancelText="Cancel" placement={isMine ? "topLeft" : "topRight"}
                            >
                              <Tooltip title="Delete">
                                <Button type="text" size="small" danger icon={<DeleteOutlined />} className="msg-action-btn" />
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
            {typingUsers[activeConvId] && (
              <div className="msg-typing-indicator">
                <div className="msg-typing-dots"><span /><span /><span /></div>
                <span>{typingUsers[activeConvId].userName} is typing…</span>
              </div>
            )}

            {/* @Mention popup */}
            {mentionOpen && mentionCandidates.length > 0 && (
              <div className="msg-mention-popup">
                {mentionCandidates.map((p) => (
                  <div key={p._id} className="msg-mention-item" onClick={() => insertMention(p)}>
                    <UserAvatar user={p} size={24} />
                    <span>{p.name}</span>
                    <Text type="secondary" style={{ fontSize: 11, marginLeft: "auto" }}>@{p.username}</Text>
                  </div>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="msg-chat-input">
              <div className="msg-input-toolbar">
                <Tooltip title={isUrgent ? "Remove urgent flag" : "Mark as urgent"}>
                  <Button
                    type="text" size="small"
                    icon={<ExclamationCircleOutlined />}
                    className={`msg-toolbar-btn ${isUrgent ? "active" : ""}`}
                    onClick={() => setIsUrgent(!isUrgent)}
                  />
                </Tooltip>
                <Tooltip title="Mention someone (@)">
                  <Button type="text" size="small" className="msg-toolbar-btn"
                    onClick={() => { setMessageText((prev) => prev + "@"); inputRef.current?.focus(); }}
                  >@</Button>
                </Tooltip>
                {messageText.trim() && (
                  <Tooltip title="Save as draft">
                    <Button type="text" size="small" icon={<FileTextOutlined />} className="msg-toolbar-btn"
                      onClick={handleSaveDraft}
                    />
                  </Tooltip>
                )}
                {isUrgent && <Tag color="red" style={{ marginLeft: 4, fontSize: 11 }}>Urgent</Tag>}
              </div>
              <div className="msg-input-row">
                <TextArea
                  ref={inputRef}
                  placeholder={activeConv?.isConfidential ? "Type a confidential message..." : "Type a message..."}
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  value={messageText}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  disabled={sending}
                />
                <Button className="msg-send-btn" type="primary" icon={<SendOutlined />}
                  onClick={handleSend} loading={sending} disabled={!messageText.trim()}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ─── Conversation Details Modal ────────────────────────────────── */}
      <Modal
        title={activeConv?.isGroup ? "Group Details" : "Conversation Details"}
        open={detailModalOpen} onCancel={() => setDetailModalOpen(false)}
        footer={activeConv?.isGroup ? (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={() => setDetailModalOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleUpdateGroup}>Save Changes</Button>
          </div>
        ) : null}
        width={440}
      >
        {activeConv && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              {activeConv.isGroup ? (
                <Avatar className="msg-group-avatar" icon={<TeamOutlined />} size={64} />
              ) : getOtherParticipant(activeConv) ? (
                <UserAvatar user={getOtherParticipant(activeConv)} size={64} />
              ) : (
                <Avatar icon={<UserOutlined />} size={64} />
              )}
              {activeConv.isGroup ? (
                <div style={{ marginTop: 12 }}>
                  <Input
                    value={editGroupName} onChange={(e) => setEditGroupName(e.target.value)}
                    placeholder="Group name" style={{ maxWidth: 240, margin: "0 auto" }}
                  />
                </div>
              ) : (
                <h3 style={{ margin: "12px 0 4px" }}>{getConversationName(activeConv)}</h3>
              )}
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
                </>
              )}
            </div>

            {/* Confidential toggle */}
            <div className="msg-detail-row">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <LockOutlined style={{ color: "#faad14" }} />
                <Text>Confidential Conversation</Text>
              </div>
              <Switch size="small" checked={editConfidential} onChange={setEditConfidential} />
            </div>

            {activeConv.isGroup && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <Text strong style={{ fontSize: 13 }}>
                    Participants ({(activeConv.participants || []).length})
                  </Text>
                  <Button type="link" size="small" icon={<UserAddOutlined />}
                    onClick={() => { setAddMembersOpen(true); setAddMemberSearch(""); setAddMemberIds([]); fetchAvailableUsers(); }}
                  >Add</Button>
                </div>
                <div style={{ maxHeight: 240, overflowY: "auto" }}>
                  {(activeConv.participants || []).map((p) => (
                    <div key={p._id} className="msg-user-list-item" style={{ cursor: "default" }}>
                      <div className="msg-conv-avatar-wrap" style={{ position: "relative" }}>
                        <UserAvatar user={p} size={32} />
                        {p.isOnline && <span className="msg-online-dot" style={{ width: 8, height: 8, bottom: 0, right: 0 }} />}
                      </div>
                      <div className="msg-user-list-info">
                        <div className="msg-user-list-name">
                          {p.name}
                          {String(p._id) === userId && <Tag style={{ marginLeft: 6 }} color="blue">You</Tag>}
                          {String(p._id) === String(activeConv.createdBy) && <Tag style={{ marginLeft: 4 }} color="gold">Creator</Tag>}
                        </div>
                        <div className="msg-user-list-role">{formatLastActive(p)}</div>
                      </div>
                      {String(p._id) !== userId && activeConv.participants.length > 2 && (
                        <Popconfirm title={`Remove ${p.name}?`} onConfirm={() => handleRemoveMember(p._id)}>
                          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Divider style={{ margin: "16px 0 12px" }} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Conversation started {dayjs(activeConv.createdAt).format("MMMM D, YYYY")}
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {totalMessages} messages total
            </Text>
          </div>
        )}
      </Modal>

      {/* ─── New Conversation Modal ───────────────────────────────────── */}
      <Modal
        title="New Conversation"
        open={newConvModalOpen} onCancel={() => setNewConvModalOpen(false)}
        onOk={handleCreateConversation}
        okText={selectedUserIds.length > 1 ? "Create Group" : "Start Chat"}
        okButtonProps={{ disabled: !selectedUserIds.length }}
        width={480}
      >
        <Input
          placeholder="Search by name, email, or designation..."
          prefix={<SearchOutlined />} allowClear value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          style={{ marginBottom: 12 }}
        />

        {selectedUserIds.length > 0 && (
          <div className="msg-new-conv-selections">
            {selectedUserIds.map((uid) => {
              const u = availableUsers.find((x) => x._id === uid);
              return u ? (
                <Tag key={uid} closable onClose={() => toggleUserSelection(uid)} style={{ marginBottom: 4 }}>
                  {u.name}
                </Tag>
              ) : null;
            })}
          </div>
        )}

        {/* Group options — visible when >1 selected */}
        {selectedUserIds.length > 1 && (
          <div className="msg-new-conv-group-opts">
            <Input
              placeholder="Group name (optional)" value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              prefix={<TeamOutlined style={{ color: "#bfbfbf" }} />}
              style={{ marginBottom: 8 }}
            />
            <div className="msg-detail-row" style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <LockOutlined style={{ color: "#faad14" }} />
                <Text style={{ fontSize: 13 }}>Confidential</Text>
              </div>
              <Switch size="small" checked={newIsConfidential} onChange={setNewIsConfidential} />
            </div>
          </div>
        )}

        {/* 1:1 confidential option */}
        {selectedUserIds.length === 1 && (
          <div className="msg-detail-row" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <LockOutlined style={{ color: "#faad14" }} />
              <Text style={{ fontSize: 13 }}>Confidential</Text>
            </div>
            <Switch size="small" checked={newIsConfidential} onChange={setNewIsConfidential} />
          </div>
        )}

        <div style={{ maxHeight: 320, overflowY: "auto" }}>
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
                <div className="msg-conv-avatar-wrap">
                  <UserAvatar user={u} size={36} />
                  {u.isOnline && <span className="msg-online-dot" style={{ width: 8, height: 8 }} />}
                </div>
                <div className="msg-user-list-info">
                  <div className="msg-user-list-name">{u.name}</div>
                  <div className="msg-user-list-role">
                    {u.designation || u.position || u.email}
                    <span style={{ marginLeft: 8, fontSize: 11, color: "#bfbfbf" }}>{formatLastActive(u)}</span>
                  </div>
                </div>
                {selectedUserIds.includes(u._id) && <CheckOutlined style={{ color: "#1677ff" }} />}
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* ─── Add Members Modal ────────────────────────────────────────── */}
      <Modal
        title="Add Members"
        open={addMembersOpen} onCancel={() => setAddMembersOpen(false)}
        onOk={handleAddMembers}
        okText={`Add ${addMemberIds.length || ""}`}
        okButtonProps={{ disabled: !addMemberIds.length }}
        width={420}
      >
        <Input
          placeholder="Search by name or email..." prefix={<SearchOutlined />} allowClear
          value={addMemberSearch} onChange={(e) => setAddMemberSearch(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        <div style={{ maxHeight: 300, overflowY: "auto" }}>
          {addMemberCandidates.length === 0 ? (
            <Empty description="No available users" />
          ) : (
            addMemberCandidates.map((u) => (
              <div
                key={u._id}
                className={`msg-user-list-item ${addMemberIds.includes(u._id) ? "selected" : ""}`}
                onClick={() => setAddMemberIds((prev) => prev.includes(u._id) ? prev.filter((id) => id !== u._id) : [...prev, u._id])}
              >
                <UserAvatar user={u} size={32} />
                <div className="msg-user-list-info">
                  <div className="msg-user-list-name">{u.name}</div>
                  <div className="msg-user-list-role">{u.email}</div>
                </div>
                {addMemberIds.includes(u._id) && <CheckOutlined style={{ color: "#1677ff" }} />}
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Messaging;

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { List, Avatar, Badge } from "antd";
import { getUsers } from "../../../api/userAPI";
import socket from "../../../../utils/socket";
import useAuth from "../../../hooks/useAuth";
import "./OnlineUsers.css";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

// Format like "0 min ago", "1 min ago" for the first hour; fallback to dayjs for longer
// If lastSeenAt is older than 48 hours, treat as Offline
const HOURS_OFFLINE_THRESHOLD = 48;
const formatShortLastSeen = (dateLike) => {
  if (!dateLike) return "";
  const t = new Date(dateLike).getTime();
  if (Number.isNaN(t)) return "";
  const diffMs = Date.now() - t;
  const hours = diffMs / (1000 * 60 * 60);
  if (hours >= HOURS_OFFLINE_THRESHOLD) return null; // signal that user should be considered offline
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins} min ago`;
  return dayjs(t).fromNow();
};

const OnlineUsers = () => {
  const [users, setUsers] = useState([]);
  const { user: currentUser } = useAuth();

  const fetchUsers = useCallback(async () => {
    try {
      const usersArray = await getUsers(); // getUsers() directly returns the array
      if (Array.isArray(usersArray)) {
        const enrichedUsers = usersArray.map((u) => {
          let lastSeen = "Offline";
          if (u.isOnline) lastSeen = "Online now";
          else if (u.lastSeenAt) {
            const short = formatShortLastSeen(u.lastSeenAt);
            if (short === null) {
              // older than threshold, treat as offline
              lastSeen = "Offline";
            } else {
              lastSeen = `Last seen ${short}`;
            }
          }
          return { ...u, lastSeen };
        });
        setUsers(enrichedUsers);
      } else {
        console.error("getUsers did not return an array:", usersArray);
        setUsers([]);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
      setUsers([]);
    }
  }, []);

  // Effect for initial user fetch
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Effect for real-time socket updates on user status
  useEffect(() => {
    const onPresenceSnapshot = ({ onlineUserIds = [] }) => {
      setUsers((prev) =>
        prev.map((u) => ({
          ...u,
          isOnline: onlineUserIds.includes(u._id),
          lastSeen: onlineUserIds.includes(u._id) ? "Online now" : u.lastSeen,
        }))
      );
    };
    socket.on("presence-snapshot", onPresenceSnapshot);

    const handleStatusChange = ({ userId, status, lastSeenAt }) => {
      setUsers((prevUsers) => {
        const idx = prevUsers.findIndex((u) => u._id === userId);
        if (idx === -1) {
          // User might not be loaded yet; refresh list once
          fetchUsers();
          return prevUsers;
        }
        const effectiveLastSeenAt = lastSeenAt ? new Date(lastSeenAt) : new Date();
        const updated = [...prevUsers];
        updated[idx] = {
          ...updated[idx],
          isOnline: status === "online",
          lastSeenAt: status === "online" ? undefined : effectiveLastSeenAt,
          lastSeen: (function () {
            if (status === "online") return "Online now";
            const short = formatShortLastSeen(effectiveLastSeenAt);
            return short === null ? "Offline" : `Last seen ${short}`;
          })(),
        };
        return updated;
      });
    };

    socket.on("user-status-changed", handleStatusChange);
    return () => {
      socket.off("presence-snapshot", onPresenceSnapshot);
      socket.off("user-status-changed", handleStatusChange);
    };
  }, [fetchUsers]);

  // Refresh "x min ago" every minute for offline users
  useEffect(() => {
    const interval = setInterval(() => {
      setUsers((prev) =>
        prev.map((u) => {
          if (u.isOnline) return u;
          if (!u.lastSeenAt) return u;
          return {
            ...u,
            lastSeen: `Last seen ${formatShortLastSeen(u.lastSeenAt)}`,
          };
        })
      );
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Memoize sorted user list for performance
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      // Current user always comes first
      if (a._id === currentUser?._id) return -1;
      if (b._id === currentUser?._id) return 1;
      // Sort by online status (online users first)
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      // For users with the same status, sort alphabetically by name
      return a.name.localeCompare(b.name);
    });
  }, [users, currentUser]);

  // Memoize user counts for performance
  const { onlineCount, offlineCount } = useMemo(() => {
    const online = users.filter((u) => u.isOnline).length;
    return {
      onlineCount: online,
      offlineCount: users.length - online,
    };
  }, [users]);

  const renderUserItem = (user) => {
    const isCurrentUser = user._id === currentUser?._id;
    const itemClasses = `user-list-item ${
      isCurrentUser ? "current-user-item" : ""
    }`;

    return (
      <List.Item className={itemClasses}>
        <List.Item.Meta
          avatar={
            <Badge
              dot
              offset={[-4, 24]} // Adjusted for smaller avatar
              color={user.isOnline ? "limegreen" : "red"}
            >
              <Avatar className="user-avatar">
                {user.name ? user.name.charAt(0).toUpperCase() : "?"}
              </Avatar>
            </Badge>
          }
          title={
            <span className="user-title">
              {user.name} {isCurrentUser && <span className="you-indicator">(You)</span>}
            </span>
          }
          description={<span className="user-description">{user.lastSeen}</span>}
        />
      </List.Item>
    );
  };

  return (
    <div className="online-users-container">
      <h3 className="online-users-header">People</h3>

      <div className="status-counts">
        <span>🟢 Online: {onlineCount}</span>
        <span>🔴 Offline: {offlineCount}</span>
      </div>

      <div className="user-list-wrapper user-list-scroll">
        <List
          itemLayout="horizontal"
          dataSource={sortedUsers}
          renderItem={renderUserItem}
        />
      </div>
    </div>
  );
};

export default OnlineUsers;

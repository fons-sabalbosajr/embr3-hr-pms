import React, { useState, useEffect, useMemo, useCallback } from "react";
import { List, Avatar, Badge, Input } from "antd";
import { getUsers } from "../../../api/userAPI";
import socket from "../../../../utils/socket";
import useAuth from "../../../hooks/useAuth";
import "./OnlineUsers.css";

const OnlineUsers = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const { user: currentUser } = useAuth();

  const fetchUsers = useCallback(async () => {
    try {
      const usersArray = await getUsers(); // getUsers() directly returns the array
      if (Array.isArray(usersArray)) {
        const enrichedUsers = usersArray.map((u) => ({
          ...u,
          lastSeen: u.isOnline ? "Online now" : "Offline",
        }));
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
    const handleStatusChange = ({ userId, status }) => {
      console.log("Received user-status-changed event:", { userId, status });
      setUsers((prevUsers) => {
        const userExists = prevUsers.some((u) => u._id === userId);
        if (userExists) {
          const timestamp = new Date().toLocaleString();
          return prevUsers.map((u) =>
            u._id === userId
              ? {
                  ...u,
                  isOnline: status === "online",
                  lastSeen:
                    status === "online"
                      ? "Online now"
                      : `Last seen: ${timestamp}`,
                }
              : u
          );
        } else {
          // A new user has connected who wasn't in the initial list.
          // Refetch the entire list to get the new user's details.
          fetchUsers();
          return prevUsers; // Return current state, the fetch will update it.
        }
      });
    };

    socket.on("user-status-changed", handleStatusChange);

    return () => {
      socket.off("user-status-changed", handleStatusChange);
    };
  }, [fetchUsers]);

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

  // Memoize filtered user list for performance
  const filteredUsers = useMemo(() => {
    const searchTerm = search.toLowerCase();
    if (!searchTerm) return sortedUsers;
    return sortedUsers.filter((u) =>
      u.name?.toLowerCase().includes(searchTerm)
    );
  }, [sortedUsers, search]);

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

      <Input
        placeholder="Search users..."
        allowClear
        onChange={(e) => setSearch(e.target.value)}
        className="online-users-search"
      />

      <div className="status-counts">
        <span>🟢 Online: {onlineCount}</span>
        <span>🔴 Offline: {offlineCount}</span>
      </div>

      <div className="user-list-wrapper">
        <List
          itemLayout="horizontal"
          dataSource={filteredUsers}
          renderItem={renderUserItem}
        />
      </div>
    </div>
  );
};

export default OnlineUsers;

import React, { createContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  secureGet,
  secureStore,
  secureRemove,
  secureSessionGet,
  secureSessionStore,
  secureSessionRemove,
  secureClearAll,
} from "../../utils/secureStorage";
import axiosInstance from "../api/axiosInstance";
import socket from "../../utils/socket";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  // Initialize from sessionStorage first; migrate from localStorage if present
  const [user, setUser] = useState(() => {
    const sess = secureSessionGet("user");
    if (sess) return sess;
    const legacy = secureGet("user");
    if (legacy) {
      try { secureSessionStore("user", legacy); } catch {}
      try { secureRemove("user"); } catch {}
    }
    return legacy || null;
  });
  const [token, setToken] = useState(() => {
    const sess = secureSessionGet("token");
    if (sess) return sess;
    const legacy = secureGet("token");
    if (legacy) {
      try { secureSessionStore("token", legacy); } catch {}
      try { secureRemove("token"); } catch {}
    }
    return legacy || null;
  });

  useEffect(() => {
    if (token) {
      axiosInstance.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${token}`;
    } else {
      delete axiosInstance.defaults.headers.common["Authorization"];
    }

    if (user) {
      socket.connect(); // Connect the socket
      socket.emit("store-user", user); // Tell the server who is connected
      // When socket reconnects (e.g., network hiccup), re-announce the user
      const onConnect = () => {
        socket.emit("store-user", user);
      };
      const onAvatarUpdated = (payload) => {
        try {
          if (payload && String(payload.userId) === String(user._id) && payload.avatarUrl) {
            // Skip cache-busting for data: URLs (base64) – they are unique by content
            const url = payload.avatarUrl;
            const finalUrl = url.startsWith('data:') ? url : `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
            const updated = { ...user, avatarUrl: finalUrl };
            setUser(updated);
            secureStore("user", updated);
          }
        } catch (_) {}
      };

      const onUserAccessUpdated = (payload) => {
        try {
          const targetId = payload?.userId;
          const updated = payload?.user;
          if (!targetId || !updated) return;
          if (String(targetId) !== String(user._id)) return;
          // Update current user in-session so route guards/menus refresh immediately
          setUser(updated);
          secureSessionStore("user", updated);
        } catch (_) {}
      };
      socket.on("connect", onConnect);
      socket.on("user-avatar-updated", onAvatarUpdated);
      socket.on("user-access-updated", onUserAccessUpdated);
      // Clean listener on effect cleanup
      return () => {
        socket.off("connect", onConnect);
        socket.off("user-avatar-updated", onAvatarUpdated);
        socket.off("user-access-updated", onUserAccessUpdated);
        socket.disconnect(); // Disconnect on logout
      };
    } else {
      socket.disconnect(); // Disconnect on logout
    }
    return () => {
      socket.disconnect();
    };
  }, [user, token]);

  const login = async (credentials) => {
    const res = await axiosInstance.post("/users/login", credentials);
    const { token, user } = res.data;

    // Persist to per-tab session storage for isolation
    secureSessionStore("token", token);
    secureSessionStore("user", user);
    setToken(token);
    setUser(user);

    axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    // ✅ Immediately tell server user is online
    socket.connect();
    socket.emit("store-user", user);

    // no-op: ThemeContext now listens to AuthContext directly

    return user;
  };

  const logout = async () => {
    if (user) {
      try {
        await axiosInstance.post("/users/logout", { userId: user._id });
      } catch (error) {
        console.error("Logout failed on server", error);
      }

      // ✅ Explicitly tell server user logged out
      socket.emit("logout", user._id);
      socket.disconnect();
    }

    // Wipe ALL encrypted/obfuscated keys from localStorage & sessionStorage
    secureClearAll();
    setToken(null);
    setUser(null);
    delete axiosInstance.defaults.headers.common["Authorization"];

    // ✅ Always redirect to login page after logout
    // Note: BrowserRouter is mounted with basename="/hrpms", so "/auth" resolves to "/hrpms/auth"
    navigate("/auth", { replace: true });
  };

  const updateCurrentUser = (updatedUser) => {
    setUser(updatedUser);
    secureSessionStore("user", updatedUser);
  };

  const hasPermission = (permissions) => {
    if (!user) return false;
    if (user.isAdmin) return true;
    if (!permissions || permissions.length === 0) return true; // No specific permission required

    return permissions.every((p) => user[p]);
  };

  const value = {
    user,
    token,
    login,
    logout,
    updateCurrentUser,
    isAuthenticated: !!token,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;

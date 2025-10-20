import React, { createContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  secureGet,
  secureStore,
  secureRemove,
} from "../../utils/secureStorage";
import axiosInstance from "../api/axiosInstance";
import socket from "../../utils/socket";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => secureGet("user"));
  const [token, setToken] = useState(() => secureGet("token"));

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
      socket.on("connect", onConnect);
      // Clean listener on effect cleanup
      return () => {
        socket.off("connect", onConnect);
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

    secureStore("token", token);
    secureStore("user", user);
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

    secureRemove("token");
    secureRemove("user");
    setToken(null);
    setUser(null);
    delete axiosInstance.defaults.headers.common["Authorization"];

    // ✅ Always redirect to login page after logout
    // Note: BrowserRouter is mounted with basename="/hrpms", so "/auth" resolves to "/hrpms/auth"
    navigate("/auth", { replace: true });
  };

  const updateCurrentUser = (updatedUser) => {
    setUser(updatedUser);
    secureStore("user", updatedUser);
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

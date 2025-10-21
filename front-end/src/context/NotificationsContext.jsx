import React, { createContext, useEffect, useState } from "react";
import { secureGet, secureStore } from "../../utils/secureStorage";

export const NotificationsContext = createContext();

export const NotificationsProvider = ({ children }) => {
  const [notifications, setNotifications] = useState(() => secureGet("notifications") || []);
  // Reserve messages for future chat feature: always expose an empty array and a no-op setter
  const messages = [];
  const setMessages = () => {};

  useEffect(() => {
    // Persist encrypted notifications whenever they change
    try { secureStore("notifications", notifications); } catch {}
  }, [notifications]);

  return (
    <NotificationsContext.Provider
      value={{ notifications, setNotifications, messages, setMessages }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

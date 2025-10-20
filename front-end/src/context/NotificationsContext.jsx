import React, { createContext, useState } from "react";

export const NotificationsContext = createContext();

export const NotificationsProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  // Reserve messages for future chat feature: always expose an empty array and a no-op setter
  const messages = [];
  const setMessages = () => {};

  return (
    <NotificationsContext.Provider
      value={{ notifications, setNotifications, messages, setMessages }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

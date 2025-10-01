import React, { createContext, useState } from "react";

export const NotificationsContext = createContext();

export const NotificationsProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [messages, setMessages] = useState([]);

  return (
    <NotificationsContext.Provider
      value={{ notifications, setNotifications, messages, setMessages }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

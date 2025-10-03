// client/src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "antd/dist/reset.css";
import "./index.css";

import { AuthProvider } from "./context/AuthContext.jsx"; // 👈 1. Import the provider
import { NotificationsProvider } from "./context/NotificationsContext.jsx";
import { App as AntApp } from "antd";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename="/hrpms">
      <AuthProvider>
        {" "}
        <NotificationsProvider>
          <AntApp>
            <App />
          </AntApp>
        </NotificationsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

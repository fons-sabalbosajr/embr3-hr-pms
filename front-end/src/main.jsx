// client/src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "antd/dist/reset.css";
import "./index.css";

import { AuthProvider } from "./context/AuthContext.jsx"; // 👈 1. Import the provider
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { NotificationsProvider } from "./context/NotificationsContext.jsx";
import { App as AntApp } from "antd";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
  {/* Use the Vite injected BASE_URL so dev ('/') and prod ('/hrpms/') both work without manual edits */}
  <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <ThemeProvider>
        <AuthProvider>
          <NotificationsProvider>
            <AntApp>
              <App />
            </AntApp>
          </NotificationsProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);

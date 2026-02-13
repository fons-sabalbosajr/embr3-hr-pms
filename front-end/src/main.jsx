// client/src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "antd/dist/reset.css";
import "modern-normalize";
import "nprogress/nprogress.css";
import "./index.css";

import { AuthProvider } from "./context/AuthContext.jsx"; // 👈 1. Import the provider
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { NotificationsProvider } from "./context/NotificationsContext.jsx";
import { LoadingProvider } from "./context/LoadingContext.jsx";
import { App as AntApp } from "antd";
import NProgress from "nprogress";
import GlobalLoadingOverlay from "./components/GlobalLoadingOverlay.jsx";
import SessionManager from "./components/SessionManager.jsx";

// Configure NProgress (thin bar, no spinner – overlay has its own Spin)
NProgress.configure({ showSpinner: false, trickleSpeed: 120, minimum: 0.08 });

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
  {/* Use the Vite injected BASE_URL so dev ('/') and prod ('/hrpms/') both work without manual edits */}
  <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <AuthProvider>
        <ThemeProvider>
          <NotificationsProvider>
            <LoadingProvider>
              <AntApp>
                <App />
                <SessionManager />
                <GlobalLoadingOverlay />
              </AntApp>
            </LoadingProvider>
          </NotificationsProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// landing/src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage.jsx";
import DTRManagementApp from "./pages/DTRManagementApp.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Root landing page */}
        <Route path="/" element={<LandingPage />} />

        {/* Marketing page for EMB R3 DTR System */}
        <Route path="/dtr-management-system" element={<DTRManagementApp />} />

        {/* Proxy HRPMS app – handled by Vite proxy */}
        <Route path="/hrpms/*" element={<div />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

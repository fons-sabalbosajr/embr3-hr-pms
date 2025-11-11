// client/src/App.jsx
import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import useAuth from "./hooks/useAuth";

// Route-level code splitting
const AuthPage = lazy(() => import("./pages/AuthPage/AuthPage"));
const ResetPassword = lazy(() => import("./pages/ResetPassword/ResetPassword"));
const HomePage = lazy(() => import("./pages/HomePage/HomePage"));
const EmailVerification = lazy(() => import("./pages/EmailVerification"));
const PayslipRequest = lazy(() => import("./pages/RequestPayslipClient/PayslipRequest"));
const RequestDTRClient = lazy(() => import("./pages/RequestDTRClient/RequestDTRClient"));
const PublicRequests = lazy(() => import("./pages/PublicRequests/PublicRequests"));
const Unauthorized = lazy(() => import("./pages/Unauthorized/Unauthorized"));

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
      <Routes>
      {/* 🔑 Auth routes */}
      <Route
        path="/auth"
        element={isAuthenticated ? <Navigate to="/" replace /> : <AuthPage />}
      />
      <Route path="/verify/:token" element={<EmailVerification />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* 🌐 Public Requests (no login required) */}
      <Route path="/requests" element={<PublicRequests />} />
      {/* Back-compat: singular "/request" should go to the public portal */}
      <Route path="/request" element={<Navigate to="/requests" replace />} />
      <Route path="/payslip" element={<PayslipRequest />} />
      <Route path="/dtr-employee-request" element={<RequestDTRClient />} />

      {/* 🔒 Protected app (requires login) */}
      <Route
        path="/*"
        element={
          isAuthenticated ? <HomePage /> : <Navigate to="/auth" replace />
        }
      />
      </Routes>
    </Suspense>
  );
};

const App = () => <AppRoutes />;

export default App;

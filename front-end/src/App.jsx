// client/src/App.jsx
import React, { Suspense, lazy, useEffect } from "react";
import { Spin } from "antd";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import useAuth from "./hooks/useAuth";
import NProgress from "nprogress";

// Route-level code splitting
const AuthPage = lazy(() => import("./pages/AuthPage/AuthPage"));
const ResetPassword = lazy(() => import("./pages/ResetPassword/ResetPassword"));
const ConfirmPasswordChange = lazy(() => import("./pages/ConfirmPasswordChange/ConfirmPasswordChange"));
const HomePage = lazy(() => import("./pages/HomePage/HomePage"));
const EmailVerification = lazy(() => import("./pages/EmailVerification"));
const PayslipRequest = lazy(() => import("./pages/RequestPayslipClient/PayslipRequest"));
const RequestDTRClient = lazy(() => import("./pages/RequestDTRClient/RequestDTRClient"));
const PublicRequests = lazy(() => import("./pages/PublicRequests/PublicRequests"));
const Unauthorized = lazy(() => import("./pages/Unauthorized/Unauthorized"));

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  // ── NProgress on route change ────────────────────────────────────────────
  useEffect(() => {
    NProgress.start();
    // Tiny delay so NProgress has time to animate before done()
    const t = setTimeout(() => NProgress.done(), 150);
    return () => {
      clearTimeout(t);
      NProgress.done();
    };
  }, [location.pathname]);

  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
          }}
        >
          <Spin size="large" tip="Loading…">
            {/* Spin requires a child when using tip */}
            <div style={{ padding: 50 }} />
          </Spin>
        </div>
      }
    >
      <Routes>
      {/* 🔑 Auth routes */}
      <Route
        path="/auth"
        element={isAuthenticated ? <Navigate to="/" replace /> : <AuthPage />}
      />
      <Route path="/verify/:token" element={<EmailVerification />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
  <Route path="/confirm-password-change/:token" element={<ConfirmPasswordChange />} />
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

const App = () => (
  <ErrorBoundary>
    <AppRoutes />
  </ErrorBoundary>
);

export default App;

// client/src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import useAuth from "./hooks/useAuth";

import AuthPage from "./pages/AuthPage/AuthPage";
import ResetPassword from "./pages/ResetPassword/ResetPassword";
import HomePage from "./pages/HomePage/HomePage";
import EmailVerification from "./pages/EmailVerification";

import PayslipRequest from "./pages/RequestPayslipClient/PayslipRequest";
import RequestDTRClient from "./pages/RequestDTRClient/RequestDTRClient";
import PublicRequests from "./pages/PublicRequests/PublicRequests";

import Unauthorized from "./pages/Unauthorized/Unauthorized";

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
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
  );
};

const App = () => <AppRoutes />;

export default App;

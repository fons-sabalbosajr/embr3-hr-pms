// client/src/App.jsx
import {
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useEffect, useState } from "react";

import AuthPage from "./pages/AuthPage/AuthPage";
import ResetPassword from "./pages/ResetPassword/ResetPassword";
import HomePage from "./pages/HomePage/HomePage";
import EmailVerification from "./pages/EmailVerification";
import { secureGet } from "../utils/secureStorage";

const AppRoutes = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(!!secureGet("token"));
  const location = useLocation();

  // Refresh auth status when route changes
  useEffect(() => {
    const token = secureGet("token");
    setIsAuthenticated(!!token);
  }, [location]);

  return (
    <Routes>
      <Route
        path="/auth"
        element={
          isAuthenticated ? <Navigate to="/" replace /> : <AuthPage />
        }
      />
      <Route path="/verify/:token" element={<EmailVerification />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route
        path="/*"
        element={
          isAuthenticated ? <HomePage /> : <Navigate to="/auth" replace />
        }
      />
    </Routes>
  );
};

const App = () => <AppRoutes />; // ✅ no extra <Router>

export default App;

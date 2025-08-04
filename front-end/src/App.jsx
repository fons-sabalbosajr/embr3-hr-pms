import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage'; // combines Login and Signup
import HomePage from './pages/HomePage';
import { secureGet } from './utils/secureStorage';

const App = () => {
  const isAuthenticated = !!secureGet('token');

  return (
    <Router>
      <Routes>
        {/* Unified login/signup under /auth */}
        <Route path="/auth" element={<AuthPage />} />

        {/* Protected routes */}
        <Route
          path="/*"
          element={isAuthenticated ? <HomePage /> : <Navigate to="/auth" replace />}
        />
      </Routes>
    </Router>
  );
};

export default App;

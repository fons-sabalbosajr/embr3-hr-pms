import { useContext } from "react";
import AuthContext from "../context/AuthContext";

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  const { user, updateCurrentUser, ...rest } = context;

  // ✅ Simple helper for feature access
  const hasAccess = (key) => {
    if (!user) return false;
    return Boolean(user[key]);
  };

  return {
    user,
    updateCurrentUser,
    hasAccess,  // <-- use this in components
    ...rest,
  };
};

export default useAuth;

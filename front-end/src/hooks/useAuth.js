import { useContext } from "react";
import AuthContext from "../context/AuthContext";

const useAuth = () => {
  const { user, updateCurrentUser, ...rest } = useContext(AuthContext);

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
